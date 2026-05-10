from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .obsidian_runtime import list_markdown_notes as list_markdown_note_paths, read_note_content, write_note_content
REPORT_DIRECTORY = "00_system/reports"
LOG_PATH = "00_system/log.md"
INDEX_PATH = "00_system/index.md"
RAW_PREFIX = "03_raw/"
REGISTER_PREFIX = "03_raw/registers/"
KNOWLEDGE_PREFIX = "05_knowledge/"
MANUALS_PREFIX = "05_knowledge/manuals/"
EVERGREEN_PREFIX = "05_knowledge/evergreen_notes/"
SESSIONS_PREFIX = "02_timeline/sessions/"
BLOCK_ID_PATTERN = re.compile(r"\^([A-Za-z0-9_-]+)\s*$")
WIKILINK_PATTERN = re.compile(r"\[\[([^\]]+)\]\]")
CLAIM_CALLOUT_PATTERN = re.compile(r"^\s*>\s*\[!claim\]", re.IGNORECASE)


@dataclass
class LintIssue:
    severity: str
    code: str
    path: str
    message: str
    detail: str | None = None


@dataclass
class NoteState:
    path: str
    title: str
    note_type: str
    tags: list[str]
    frontmatter: dict[str, object]
    body: str
    updated: str | None
    block_ids: set[str]
    headings: set[str]
    claim_block_ids: list[str]


def parse_frontmatter(raw_text: str) -> tuple[dict[str, object], str]:
    if not raw_text.startswith("---\n"):
        return {}, raw_text

    parts = raw_text.split("\n---\n", 1)
    if len(parts) != 2:
        return {}, raw_text

    frontmatter_text, body_text = parts
    metadata: dict[str, object] = {}
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


def normalize_heading(line: str) -> str:
    return re.sub(r"\s+", " ", line.lstrip("#").strip()).lower()


def extract_block_ids(body: str) -> set[str]:
    block_ids: set[str] = set()
    for line in body.splitlines():
        match = BLOCK_ID_PATTERN.search(line)
        if match:
            block_ids.add(match.group(1))
    return block_ids


def extract_headings(body: str) -> set[str]:
    headings: set[str] = set()
    for line in body.splitlines():
        if line.startswith("#"):
            headings.add(normalize_heading(line))
    return headings


def list_markdown_notes(vault_path: Path) -> list[Path]:
    return sorted(vault_path / path for path in list_markdown_note_paths(vault_path))


def coerce_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    if isinstance(value, str) and value:
        return [value]
    return []


def extract_claim_block_ids(body: str) -> list[str]:
    block_ids: list[str] = []
    current_is_claim = False
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("> [!claim]"):
            current_is_claim = True
            continue
        match = BLOCK_ID_PATTERN.search(line)
        if current_is_claim and match:
            block_ids.append(match.group(1))
            current_is_claim = False
        elif stripped and not stripped.startswith(">"):
            current_is_claim = False
    return block_ids


def parse_note_state(vault_path: Path, note_path: Path) -> NoteState:
    relative_path = note_path.relative_to(vault_path).as_posix()
    raw_text = read_note_content(vault_path, relative_path)
    if raw_text is None:
        raise FileNotFoundError(f"Missing note while linting: {relative_path}")
    frontmatter, body = parse_frontmatter(raw_text)
    title = str(frontmatter.get("title") or note_path.stem)
    note_type = str(frontmatter.get("type") or "")
    tags = coerce_list(frontmatter.get("tags"))
    updated = frontmatter.get("updated")
    return NoteState(
        path=relative_path,
        title=title,
        note_type=note_type,
        tags=tags,
        frontmatter=frontmatter,
        body=body,
        updated=str(updated) if isinstance(updated, str) else None,
        block_ids=extract_block_ids(body),
        headings=extract_headings(body),
        claim_block_ids=extract_claim_block_ids(body),
    )


def build_note_maps(vault_path: Path) -> tuple[dict[str, NoteState], dict[str, str]]:
    notes: dict[str, NoteState] = {}
    names: dict[str, str] = {}
    for path in list_markdown_notes(vault_path):
        state = parse_note_state(vault_path, path)
        notes[state.path] = state
        names[Path(state.path).stem.lower()] = state.path
        names[state.title.lower()] = state.path
    return notes, names


def resolve_link_target(raw_target: str, notes: dict[str, NoteState], names: dict[str, str]) -> tuple[str | None, str | None, str | None]:
    target = raw_target.strip()
    display_split = target.split("|", 1)[0]
    anchor = None
    block = None
    if "#^" in display_split:
        display_split, block = display_split.split("#^", 1)
    elif "#" in display_split:
        display_split, anchor = display_split.split("#", 1)

    note_key = display_split[:-3] if display_split.endswith(".md") else display_split
    if not note_key:
        return None, anchor, block

    normalized_path = note_key if note_key.endswith(".md") else f"{note_key}.md"
    if normalized_path in notes:
        return normalized_path, anchor, block

    if note_key in notes:
        return note_key, anchor, block

    mapped = names.get(Path(note_key).stem.lower()) or names.get(note_key.lower())
    return mapped, anchor, block


def collect_wikilinks(body: str) -> list[str]:
    return WIKILINK_PATTERN.findall(body)


def incoming_backlinks(notes: dict[str, NoteState], names: dict[str, str]) -> dict[str, int]:
    backlinks: dict[str, int] = defaultdict(int)
    for state in notes.values():
        for raw_target in collect_wikilinks(state.body):
            target_path, _anchor, _block = resolve_link_target(raw_target, notes, names)
            if target_path:
                backlinks[target_path] += 1
    return backlinks


def parse_iso_date(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None
    candidates = [raw_value]
    if "T" not in raw_value and len(raw_value) == 10:
        candidates.append(f"{raw_value}T00:00:00")
    for candidate in candidates:
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue
    return None


def is_conceptual_note(state: NoteState) -> bool:
    if state.note_type == "concept":
        return True
    if state.path.startswith(KNOWLEDGE_PREFIX) and not state.path.startswith(MANUALS_PREFIX):
        return True
    return False


def check_pending_raw_sources(notes: dict[str, NoteState]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        if not state.path.startswith(REGISTER_PREFIX):
            continue
        ingest_status = str(state.frontmatter.get("ingest_status") or "")
        if ingest_status.lower() == "pending":
            issues.append(
                LintIssue(
                    severity="warning",
                    code="pending_raw_source",
                    path=state.path,
                    message="Raw/register source is still pending.",
                    detail="Consider ingest, refinement, or triage before the source queue grows stale.",
                )
            )
    return issues


def check_processed_raw_missing_synthesis(notes: dict[str, NoteState]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        if not state.path.startswith(RAW_PREFIX):
            continue
        ingest_status = str(state.frontmatter.get("ingest_status") or "").lower()
        if ingest_status != "processed":
            continue
        synthesis_targets = coerce_list(state.frontmatter.get("synthesis_targets"))
        if not synthesis_targets:
            issues.append(
                LintIssue(
                    severity="warning",
                    code="processed_raw_missing_synthesis_targets",
                    path=state.path,
                    message="Processed raw note is missing synthesis_targets.",
                    detail="The source claims to be processed, but there is no stable target trail.",
                )
            )
    return issues


def check_knowledge_without_sources(notes: dict[str, NoteState]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        if not state.path.startswith(KNOWLEDGE_PREFIX) or state.path.startswith(MANUALS_PREFIX):
            continue
        sources = coerce_list(state.frontmatter.get("sources"))
        if not sources:
            issues.append(
                LintIssue(
                    severity="error",
                    code="stable_knowledge_missing_sources",
                    path=state.path,
                    message="Stable knowledge note is missing sources.",
                    detail="Add source references or evidence blocks before treating the note as stable knowledge.",
                )
            )
    return issues


def check_claim_count_consistency(notes: dict[str, NoteState]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        if not state.path.startswith(RAW_PREFIX):
            continue
        claim_count_value = state.frontmatter.get("claim_count")
        if claim_count_value in (None, ""):
            continue
        try:
            expected = int(str(claim_count_value))
        except ValueError:
            issues.append(
                LintIssue(
                    severity="warning",
                    code="claim_count_not_numeric",
                    path=state.path,
                    message="claim_count is present but not numeric.",
                    detail="Use a numeric claim_count so lint and query can track source maturity.",
                )
            )
            continue
        actual = len(state.claim_block_ids)
        if expected != actual:
            issues.append(
                LintIssue(
                    severity="warning",
                    code="claim_count_mismatch",
                    path=state.path,
                    message=f"claim_count says {expected}, but lint found {actual} claim block(s).",
                    detail="Update claim_count or the claim scaffolds so the source state remains trustworthy.",
                )
            )
    return issues


def check_knowledge_sources_without_block_refs(notes: dict[str, NoteState]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        if not state.path.startswith(KNOWLEDGE_PREFIX) or state.path.startswith(MANUALS_PREFIX):
            continue
        sources = coerce_list(state.frontmatter.get("sources"))
        if not sources:
            continue
        if any("#^" in source_ref or "#" in source_ref for source_ref in sources):
            continue
        issues.append(
            LintIssue(
                severity="warning",
                code="knowledge_sources_missing_block_refs",
                path=state.path,
                message="Stable knowledge note only points to note-level sources, not heading/block-level evidence.",
                detail="Prefer linking key conclusions to a source heading, evidence block, or claim block.",
            )
        )
    return issues


def check_claims_without_source(notes: dict[str, NoteState]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        lines = state.body.splitlines()
        for index, line in enumerate(lines):
            if not CLAIM_CALLOUT_PATTERN.match(line):
                continue
            window = "\n".join(lines[index : index + 8]).lower()
            if "source:" not in window and "sources:" not in window and "[[" not in window:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="claim_without_source",
                        path=state.path,
                        message="Claim callout is missing a local source reference.",
                        detail="Attach a source line, sources field, or Obsidian link near the claim block.",
                    )
                )
    return issues


def check_broken_links(notes: dict[str, NoteState], names: dict[str, str]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        for raw_target in collect_wikilinks(state.body):
            target_path, anchor, block = resolve_link_target(raw_target, notes, names)
            if target_path is None:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="broken_wikilink",
                        path=state.path,
                        message=f"Broken wikilink: [[{raw_target}]].",
                    )
                )
                continue

            target_state = notes[target_path]
            if anchor and normalize_heading(anchor) not in target_state.headings:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="missing_heading_target",
                        path=state.path,
                        message=f"Wikilink heading target is missing: [[{raw_target}]].",
                    )
                )
            if block and block not in target_state.block_ids:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="missing_block_target",
                        path=state.path,
                        message=f"Wikilink block target is missing: [[{raw_target}]].",
                    )
                )
    return issues


def check_source_references(notes: dict[str, NoteState], names: dict[str, str]) -> list[LintIssue]:
    issues: list[LintIssue] = []
    for state in notes.values():
        for source_ref in coerce_list(state.frontmatter.get("sources")):
            target_path, anchor, block = resolve_link_target(source_ref, notes, names)
            if target_path is None:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="missing_source_target",
                        path=state.path,
                        message=f"Source reference cannot be resolved: {source_ref}",
                    )
                )
                continue
            target_state = notes[target_path]
            if anchor and normalize_heading(anchor) not in target_state.headings:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="missing_source_heading_target",
                        path=state.path,
                        message=f"Source heading target is missing: {source_ref}",
                    )
                )
            if block and block not in target_state.block_ids:
                issues.append(
                    LintIssue(
                        severity="error",
                        code="missing_source_block_target",
                        path=state.path,
                        message=f"Source block target is missing: {source_ref}",
                    )
                )
    return issues


def check_stale_and_orphan_concepts(notes: dict[str, NoteState], backlinks: dict[str, int], stale_days: int) -> list[LintIssue]:
    issues: list[LintIssue] = []
    now = datetime.now()
    for state in notes.values():
        if not is_conceptual_note(state):
            continue
        updated = parse_iso_date(state.updated)
        if updated and (now - updated).days >= stale_days:
            issues.append(
                LintIssue(
                    severity="warning",
                    code="stale_concept",
                    path=state.path,
                    message=f"Concept note looks stale (updated {state.updated}).",
                    detail=f"Review notes older than {stale_days} days before they silently drift.",
                )
            )
        if backlinks.get(state.path, 0) == 0:
            issues.append(
                LintIssue(
                    severity="warning",
                    code="orphan_concept",
                    path=state.path,
                    message="Concept note has no incoming vault links.",
                    detail="Consider linking it from index, project notes, or related knowledge maps.",
                )
            )
    return issues


def check_important_notes_missing_from_index(notes: dict[str, NoteState], index_content: str) -> list[LintIssue]:
    issues: list[LintIssue] = []
    index_lower = index_content.lower()
    for state in notes.values():
        if not (state.path.startswith(MANUALS_PREFIX) or state.path.startswith(EVERGREEN_PREFIX)):
            continue
        stem = Path(state.path).stem.lower()
        if state.path.lower() not in index_lower and stem not in index_lower:
            issues.append(
                LintIssue(
                    severity="info",
                    code="important_note_missing_from_index",
                    path=state.path,
                    message="Important knowledge note is not discoverable from index.md.",
                    detail="Consider adding a quick route or explicit index entry if the note should be user-facing.",
                )
            )
    return issues


def check_recent_session_log_trail(notes: dict[str, NoteState], log_content: str, session_limit: int) -> list[LintIssue]:
    session_notes = [
        state for state in notes.values() if state.path.startswith(SESSIONS_PREFIX)
    ]
    session_notes.sort(key=lambda state: state.path, reverse=True)
    issues: list[LintIssue] = []
    log_lower = log_content.lower()
    for state in session_notes[:session_limit]:
        body_lower = state.body.lower()
        if not any(keyword in body_lower for keyword in ("ingest", "refine", "distill")):
            continue
        stem = Path(state.path).stem.lower()
        if stem not in log_lower:
            issues.append(
                LintIssue(
                    severity="warning",
                    code="recent_session_missing_log_trail",
                    path=state.path,
                    message="Recent ingest/refine/distill session does not appear in log.md.",
                    detail="Leave a durable log trail so future review does not depend on reading session files manually.",
                )
            )
    return issues


def summarize_issues(issues: list[LintIssue]) -> dict[str, int]:
    counts = {"error": 0, "warning": 0, "info": 0}
    for issue in issues:
        counts[issue.severity] = counts.get(issue.severity, 0) + 1
    return counts


def render_report(report: dict) -> str:
    summary = report["summary"]
    by_severity: dict[str, list[dict]] = {"error": [], "warning": [], "info": []}
    for issue in report["issues"]:
        by_severity.setdefault(issue["severity"], []).append(issue)

    def render_items(items: list[dict]) -> str:
        if not items:
            return "- None"
        lines = []
        for item in items:
            lines.append(f"- [[{item['path']}]] — {item['message']}")
            if item.get("detail"):
                lines.append(f"  - {item['detail']}")
        return "\n".join(lines)

    touched_paths = "\n".join(f"- [[{path}]]" for path in report["touched_areas"]) or "- None"

    return f"""---
title: {Path(report['report_path']).stem}
created: {report['created']}
updated: {report['created']}
type: note
report_kind: knowledge_lint
source: vaultwright
status: generated
---

# Knowledge Lint Report

## Summary

- errors: {summary['error']}
- warnings: {summary['warning']}
- info: {summary['info']}

## Errors

{render_items(by_severity.get('error', []))}

## Warnings

{render_items(by_severity.get('warning', []))}

## Suggestions

{render_items(by_severity.get('info', []))}

## Touched areas

{touched_paths}

## Suggested next command

- {report['suggested_next_command']}
"""


def build_lint_report(vault_path: Path, stale_days: int = 30, session_limit: int = 8) -> dict:
    notes, names = build_note_maps(vault_path)
    backlinks = incoming_backlinks(notes, names)
    log_content = notes.get(LOG_PATH).body if LOG_PATH in notes else ""
    index_content = notes.get(INDEX_PATH).body if INDEX_PATH in notes else ""

    issues = []
    issues.extend(check_pending_raw_sources(notes))
    issues.extend(check_processed_raw_missing_synthesis(notes))
    issues.extend(check_claim_count_consistency(notes))
    issues.extend(check_knowledge_without_sources(notes))
    issues.extend(check_knowledge_sources_without_block_refs(notes))
    issues.extend(check_claims_without_source(notes))
    issues.extend(check_source_references(notes, names))
    issues.extend(check_broken_links(notes, names))
    issues.extend(check_stale_and_orphan_concepts(notes, backlinks, stale_days=stale_days))
    issues.extend(check_important_notes_missing_from_index(notes, index_content=index_content))
    issues.extend(check_recent_session_log_trail(notes, log_content=log_content, session_limit=session_limit))

    touched_areas = sorted({issue.path for issue in issues})
    summary = summarize_issues(issues)
    created = datetime.now().isoformat(timespec="seconds")
    report_name = datetime.now().strftime("knowledge_lint_%Y%m%d_%H%M%S.md")
    report_path = f"{REPORT_DIRECTORY}/{report_name}"

    if summary["error"] > 0:
        suggested_next_command = "refine"
    elif summary["warning"] > 0:
        suggested_next_command = "query"
    else:
        suggested_next_command = "distill"

    payload = {
        "vault_path": str(vault_path),
        "created": created,
        "report_path": report_path,
        "summary": summary,
        "issues": [
            {
                "severity": issue.severity,
                "code": issue.code,
                "path": issue.path,
                "message": issue.message,
                "detail": issue.detail,
            }
            for issue in issues
        ],
        "touched_areas": touched_areas,
        "suggested_next_command": suggested_next_command,
        "stale_days": stale_days,
        "session_limit": session_limit,
    }
    payload["report_content"] = render_report(payload)
    return payload


def write_lint_report(vault_path: Path, report: dict) -> Path:
    absolute = vault_path / report["report_path"]
    write_note_content(vault_path, report["report_path"], report["report_content"])
    return absolute
