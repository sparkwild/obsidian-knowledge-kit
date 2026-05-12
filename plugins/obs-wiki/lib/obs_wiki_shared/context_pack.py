from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .context_loader import load_context
from .obsidian_runtime import list_markdown_notes as list_markdown_note_paths, read_note_content, write_note_content

CONTEXT_PACK_DIRECTORY = "01_ai_core/context_packs"
RAW_PREFIX = "03_raw/"
KNOWLEDGE_PREFIXES = ("04_projects/", "05_knowledge/", "06_experience/")
EXCLUDED_SCAN_PREFIXES = (".obsidian/", ".trash/")


@dataclass
class NoteMetadata:
    path: str
    title: str
    aliases: list[str]
    tags: list[str]
    note_type: str
    preview: str
    block_ids: set[str]
    evidence_blocks: list[str]
    claim_blocks: list[str]


def tokenize(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9_\-\u4e00-\u9fff]+", text.lower())


def compact_preview(text: str, line_limit: int = 12) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines[:line_limit])


def parse_frontmatter(raw_text: str) -> tuple[dict[str, str | list[str]], str]:
    if not raw_text.startswith("---\n"):
        return {}, raw_text

    parts = raw_text.split("\n---\n", 1)
    if len(parts) != 2:
        return {}, raw_text

    frontmatter_text, body_text = parts
    metadata: dict[str, str | list[str]] = {}
    current_key: str | None = None
    list_values: list[str] = []

    for line in frontmatter_text.splitlines()[1:]:
        if line.startswith("  - ") and current_key:
            list_values.append(line[4:].strip())
            metadata[current_key] = list_values[:]
            continue

        current_key = None
        list_values = []
        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value:
            metadata[key] = value
        else:
            metadata[key] = []
            current_key = key

    return metadata, body_text


def extract_block_ids(body: str) -> set[str]:
    block_ids: set[str] = set()
    for line in body.splitlines():
        match = re.fullmatch(r"\^([A-Za-z0-9_-]+)", line.strip())
        if match:
            block_ids.add(match.group(1))
    return block_ids


def extract_structured_blocks(body: str) -> tuple[list[str], list[str]]:
    evidence_blocks: list[str] = []
    claim_blocks: list[str] = []
    current_kind: str | None = None
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("### evidence_"):
            current_kind = "evidence"
            continue
        if stripped.lower().startswith("> [!claim]"):
            current_kind = "claim"
            continue
        match = re.fullmatch(r"\^([A-Za-z0-9_-]+)", stripped)
        if not match:
            continue
        block_id = match.group(1)
        if current_kind == "evidence":
            evidence_blocks.append(block_id)
        elif current_kind == "claim":
            claim_blocks.append(block_id)
        current_kind = None
    return evidence_blocks, claim_blocks


def build_note_metadata(vault_path: Path, note_path: Path) -> NoteMetadata:
    relative_path = note_path.relative_to(vault_path).as_posix()
    raw_text = read_note_content(vault_path, relative_path)
    if raw_text is None:
        raise FileNotFoundError(f"Missing note while building metadata: {relative_path}")
    frontmatter, body_text = parse_frontmatter(raw_text)
    body_preview = compact_preview(body_text)
    title = str(frontmatter.get("title") or note_path.stem)
    aliases = [alias for alias in frontmatter.get("aliases", []) if isinstance(alias, str)]
    tags = [tag for tag in frontmatter.get("tags", []) if isinstance(tag, str)]
    note_type = str(frontmatter.get("type") or "")
    evidence_blocks, claim_blocks = extract_structured_blocks(body_text)
    return NoteMetadata(
        path=relative_path,
        title=title,
        aliases=aliases,
        tags=tags,
        note_type=note_type,
        preview=body_preview,
        block_ids=extract_block_ids(body_text),
        evidence_blocks=evidence_blocks,
        claim_blocks=claim_blocks,
    )


def iter_markdown_notes(vault_path: Path) -> list[Path]:
    note_paths: list[Path] = []
    for relative in list_markdown_note_paths(vault_path):
        if any(relative.startswith(prefix) for prefix in EXCLUDED_SCAN_PREFIXES):
            continue
        note_paths.append(vault_path / relative)
    return sorted(note_paths)


def boost_from_reference_text(note: NoteMetadata, reference_text: str) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    stem = Path(note.path).stem.lower()
    if note.path in reference_text:
        score += 4
        reasons.append("mentioned_in_loaded_context")
    elif stem and stem in reference_text:
        score += 2
        reasons.append("stem_seen_in_loaded_context")
    return score, reasons


def score_note(note: NoteMetadata, query_tokens: list[str], reference_text: str) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    title_blob = " ".join([note.title, *note.aliases]).lower()
    path_blob = note.path.lower()
    tag_blob = " ".join(note.tags).lower()
    preview_blob = note.preview.lower()
    type_blob = note.note_type.lower()

    if note.path.startswith(RAW_PREFIX):
        score += 1

    context_score, context_reasons = boost_from_reference_text(note, reference_text)
    score += context_score
    reasons.extend(context_reasons)

    for token in query_tokens:
        if token in title_blob:
            score += 8
            reasons.append(f"title_match:{token}")
        if token in path_blob:
            score += 6
            reasons.append(f"path_match:{token}")
        if token in tag_blob or token == type_blob:
            score += 5
            reasons.append(f"metadata_match:{token}")
        if token in preview_blob:
            score += 2
            reasons.append(f"body_match:{token}")

    if any(note.path.startswith(prefix) for prefix in KNOWLEDGE_PREFIXES):
        score += 1

    return score, reasons


def candidate_entry(note: NoteMetadata, score: int, reasons: list[str]) -> dict:
    primary_block = sorted(note.block_ids)[0] if note.block_ids else None
    primary_evidence_block = note.evidence_blocks[0] if note.evidence_blocks else None
    primary_claim_block = note.claim_blocks[0] if note.claim_blocks else None
    return {
        "path": note.path,
        "title": note.title,
        "type": note.note_type or None,
        "tags": note.tags,
        "score": score,
        "reasons": reasons,
        "primary_block": primary_block,
        "primary_evidence_block": primary_evidence_block,
        "primary_claim_block": primary_claim_block,
    }


def detect_source_candidates(candidates: list[dict]) -> list[dict]:
    selected = []
    for candidate in candidates:
        path = candidate["path"]
        note_type = candidate.get("type") or ""
        if path.startswith(RAW_PREFIX) or note_type == "raw":
            selected.append(candidate)
    return selected[:6]


def detect_knowledge_gaps(candidates: list[dict]) -> list[dict]:
    gaps = []
    for candidate in candidates:
        path = candidate["path"].lower()
        title = str(candidate["title"]).lower()
        tags = [str(tag).lower() for tag in candidate.get("tags", [])]
        if "gap" in path or "gap" in title or "knowledge-gap" in tags or "gap" in tags:
            gaps.append(candidate)
    return gaps[:6]


def suggest_writeback_target(candidates: list[dict]) -> str | None:
    for candidate in candidates:
        path = candidate["path"]
        if any(path.startswith(prefix) for prefix in KNOWLEDGE_PREFIXES) and not path.startswith(RAW_PREFIX):
            return path
    return None


def context_pack_note_path() -> str:
    timestamp = datetime.now().strftime("context_%Y%m%d_%H%M%S.md")
    return f"{CONTEXT_PACK_DIRECTORY}/{timestamp}"


def render_context_pack_note(pack: dict) -> str:
    candidate_lines = "\n".join(
        f"- [[{candidate['path']}|{candidate['title']}]] (score: {candidate['score']})"
        for candidate in pack["candidate_notes"]
    ) or "- 无高相关候选笔记"
    source_lines = "\n".join(
        (
            f"- [[{candidate['path']}#^{candidate['primary_claim_block']}|{candidate['title']} claim]]"
            if candidate.get("primary_claim_block")
            else (
                f"- [[{candidate['path']}#^{candidate['primary_evidence_block']}|{candidate['title']} evidence]]"
                if candidate.get("primary_evidence_block")
                else (
                    f"- [[{candidate['path']}#^{candidate['primary_block']}|{candidate['title']} block]]"
                    if candidate.get("primary_block")
                    else f"- [[{candidate['path']}|{candidate['title']}]]"
                )
            )
        )
        for candidate in pack["source_candidates"]
    ) or "- 暂无明显 source candidate"
    gap_lines = "\n".join(
        f"- [[{candidate['path']}|{candidate['title']}]]"
        for candidate in pack["knowledge_gaps"]
    ) or "- 暂未命中明确 knowledge gap note"
    notes_read_lines = "\n".join(f"- [[{item['path']}]]" for item in pack["notes_read_by_codex"]) or "- 暂无"
    required_rules = "\n".join(f"- {rule}" for rule in pack["required_operating_rules"])
    writeback_target = pack["suggested_writeback_target"] or "待人工判断"
    follow_up_lines = "\n".join(f"- {item}" for item in pack["follow_up_actions"]) or "- 暂无"

    return f"""---
title: {Path(pack['context_pack_path']).stem}
created: {pack['created']}
updated: {pack['created']}
type: codex-context-pack
query: "{pack['query']}"
status: active
source: obs-wiki
---

# Context Pack（{pack['query']}）

## User question 用户问题

{pack['query']}

## Required operating rules 必要操作规则

{required_rules}

## Candidate notes 候选笔记

{candidate_lines}

## Source candidates 来源候选

{source_lines}

## Knowledge gaps 知识缺口

{gap_lines}

## Suggested writeback target 建议回写目标

- {writeback_target}

## Notes read by Codex Codex 已读取笔记

{notes_read_lines}

## Follow-up actions 后续动作

{follow_up_lines}
"""


def build_context_pack(vault_path: Path, query: str, candidate_limit: int = 8, read_limit: int = 5) -> dict:
    startup_context = load_context(vault_path, session_limit=2)
    startup_notes = startup_context["startup_notes"]
    recent_sessions = startup_context["recent_sessions"]
    reference_text = "\n".join(item["content"].lower() for item in [*startup_notes, *recent_sessions])
    query_tokens = tokenize(query)

    ranked: list[tuple[int, list[str], NoteMetadata]] = []
    for path in iter_markdown_notes(vault_path):
        note = build_note_metadata(vault_path, path)
        score, reasons = score_note(note, query_tokens, reference_text)
        if score > 0:
            ranked.append((score, reasons, note))

    ranked.sort(key=lambda item: (item[0], item[2].path), reverse=True)
    top_ranked = ranked[:candidate_limit]
    candidates = [candidate_entry(note, score, reasons) for score, reasons, note in top_ranked]
    source_candidates = detect_source_candidates(candidates)
    knowledge_gaps = detect_knowledge_gaps(candidates)
    writeback_target = suggest_writeback_target(candidates)

    notes_read_by_codex = [
        {"path": item["path"], "kind": "startup"}
        for item in startup_notes
    ]
    notes_read_by_codex.extend({"path": item["path"], "kind": "recent_session"} for item in recent_sessions)
    notes_read_by_codex.extend(
        {"path": candidate["path"], "kind": "candidate_note"} for candidate in candidates[:read_limit]
    )

    if writeback_target:
        follow_up_actions = [
            "先只读取 context pack 列出的高相关候选笔记，不要全库暴力读取。",
            f"如果形成稳定结论，优先回写到 `{writeback_target}` 或相关 session/log。",
        ]
    else:
        follow_up_actions = [
            "先只读取 context pack 列出的高相关候选笔记，不要全库暴力读取。",
            "如果证据仍不足，建议创建或补充 knowledge gap note，而不是写入稳定结论。",
        ]

    pack = {
        "vault_path": str(vault_path),
        "created": datetime.now().isoformat(timespec="seconds"),
        "query": query,
        "context_pack_path": context_pack_note_path(),
        "required_operating_rules": [
            "Use the active Obsidian vault as the only knowledge carrier.",
            "Do not create external raw/wiki directory systems outside the vault.",
            "Read system.md and the workflow manual before targeted note retrieval.",
            "Prefer updating existing notes, and create new stable notes only when the structure truly needs them.",
        ],
        "candidate_notes": candidates,
        "source_candidates": source_candidates,
        "knowledge_gaps": knowledge_gaps,
        "suggested_writeback_target": writeback_target,
        "notes_read_by_codex": notes_read_by_codex,
        "missing_startup_notes": startup_context["missing_startup_notes"],
        "follow_up_actions": follow_up_actions,
    }
    pack["note_content"] = render_context_pack_note(pack)
    return pack


def write_context_pack(vault_path: Path, pack: dict) -> Path:
    absolute = vault_path / pack["context_pack_path"]
    write_note_content(vault_path, pack["context_pack_path"], pack["note_content"])
    return absolute
