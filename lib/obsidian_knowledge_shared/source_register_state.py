from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .obsidian_runtime import list_markdown_notes, read_note_content, write_note_content

REGISTER_PREFIX = "03_raw/registers/"
PROJECT_PREFIX = "04_projects/"
KNOWLEDGE_PREFIX = "05_knowledge/"
EXPERIENCE_PREFIX = "06_experience/"
CLAIM_HEADER_PATTERN = re.compile(r"^\s*>\s*\[!claim\]", re.IGNORECASE)
CLAIM_STATUS_PATTERN = re.compile(r"^\s*>\s*status:\s*(.+?)\s*$", re.IGNORECASE)
BLOCK_ID_PATTERN = re.compile(r"\^([A-Za-z0-9_-]+)\s*$")


@dataclass
class SourceRegisterReconcileDraft:
    vault_path: str
    register_path: str
    source_id: str
    snapshot_path: str | None
    extracted_at: str | None
    capture_status: str
    distill_status: str
    verification_status: str
    claim_count: int
    synthesis_targets: list[str]
    claim_statuses: list[str]
    referenced_by: list[str]
    content: str


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


def serialize_frontmatter(metadata: dict[str, object]) -> str:
    lines = ["---"]
    for key, value in metadata.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            if value:
                lines.extend(f"  - {item}" for item in value)
            else:
                lines.append("  - ")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def replace_status_line(body: str, key: str, value: str) -> str:
    pattern = re.compile(rf"(^\s*(?:- |> )\s*{re.escape(key)}:\s*).*$", re.MULTILINE)
    return pattern.sub(rf"\1`{value}`", body)


def replace_claim_count_line(body: str, value: int) -> str:
    pattern = re.compile(r"(^\s*-\s*claim_count:\s*).*$", re.MULTILINE)
    return pattern.sub(rf"\1`{value}`", body)


def coerce_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    if isinstance(value, str) and value:
        return [value]
    return []


def extract_claim_statuses(body: str) -> list[str]:
    statuses: list[str] = []
    claim_open = False
    for line in body.splitlines():
        if CLAIM_HEADER_PATTERN.match(line):
            claim_open = True
            continue
        if not claim_open:
            continue
        status_match = CLAIM_STATUS_PATTERN.match(line)
        if status_match:
            statuses.append(status_match.group(1).strip().lower())
            continue
        if line.strip() and not line.lstrip().startswith(">"):
            claim_open = False
    return statuses


def extract_block_ids(body: str) -> set[str]:
    block_ids: set[str] = set()
    for line in body.splitlines():
        match = BLOCK_ID_PATTERN.search(line)
        if match:
            block_ids.add(match.group(1))
    return block_ids


def scan_references(vault_path: Path, register_path: str, register_block_ids: set[str]) -> list[str]:
    hits: list[str] = []
    for relative in list_markdown_notes(vault_path):
        if relative == register_path:
            continue
        text = read_note_content(vault_path, relative)
        if text is None:
            continue
        if register_path in text:
            hits.append(relative)
            continue
        if any(f"#^{block_id}" in text for block_id in register_block_ids):
            hits.append(relative)
    return hits


def infer_synthesis_targets(referenced_by: list[str]) -> list[str]:
    targets = []
    for path in referenced_by:
        if path.startswith((PROJECT_PREFIX, KNOWLEDGE_PREFIX, EXPERIENCE_PREFIX)):
            targets.append(path)
    return sorted(dict.fromkeys(targets))


def infer_distill_status(synthesis_targets: list[str]) -> str:
    if not synthesis_targets:
        return "pending"
    if any(path.startswith((KNOWLEDGE_PREFIX, EXPERIENCE_PREFIX)) for path in synthesis_targets):
        return "distilled"
    return "in_progress"


def infer_capture_status(snapshot_path: str | None, vault_path: Path, body: str) -> str:
    if snapshot_path and (vault_path / snapshot_path).exists():
        return "captured"
    if "source_excerpt: [TODO]" not in body:
        return "captured"
    return "registered"


def infer_verification_status(claim_statuses: list[str]) -> str:
    if not claim_statuses:
        return "unverified"
    if all(status == "verified" for status in claim_statuses):
        return "verified"
    if any(status != "pending" for status in claim_statuses):
        return "in_review"
    return "unverified"


def reconcile_source_register(vault_path: Path, register_path: str) -> SourceRegisterReconcileDraft:
    absolute = vault_path / register_path
    raw_text = read_note_content(vault_path, register_path)
    if raw_text is None:
        raise FileNotFoundError(f"Source register does not exist: {absolute}")
    frontmatter, body = parse_frontmatter(raw_text)

    source_id = str(frontmatter.get("source_id") or Path(register_path).stem)
    snapshot_path = str(frontmatter.get("snapshot_path") or "") or None
    extracted_at = str(frontmatter.get("extracted_at") or "") or None

    block_ids = extract_block_ids(body)
    claim_statuses = extract_claim_statuses(body)
    claim_count = len(claim_statuses)
    referenced_by = scan_references(vault_path, register_path, block_ids)
    synthesis_targets = infer_synthesis_targets(referenced_by)
    distill_status = infer_distill_status(synthesis_targets)
    capture_status = infer_capture_status(snapshot_path, vault_path, body)
    verification_status = infer_verification_status(claim_statuses)

    if capture_status == "captured" and not extracted_at:
        extracted_at = datetime.now().isoformat(timespec="seconds")

    frontmatter["claim_count"] = claim_count
    frontmatter["capture_status"] = capture_status
    frontmatter["distill_status"] = distill_status
    frontmatter["verification_status"] = verification_status
    frontmatter["synthesis_targets"] = synthesis_targets
    frontmatter["extracted_at"] = extracted_at or ""

    body = replace_status_line(body, "capture_status", capture_status)
    body = replace_status_line(body, "distill_status", distill_status)
    body = replace_status_line(body, "verification_status", verification_status)
    body = replace_claim_count_line(body, claim_count)

    content = serialize_frontmatter(frontmatter) + "\n\n" + body.lstrip("\n")

    return SourceRegisterReconcileDraft(
        vault_path=str(vault_path),
        register_path=register_path,
        source_id=source_id,
        snapshot_path=snapshot_path,
        extracted_at=extracted_at,
        capture_status=capture_status,
        distill_status=distill_status,
        verification_status=verification_status,
        claim_count=claim_count,
        synthesis_targets=synthesis_targets,
        claim_statuses=claim_statuses,
        referenced_by=referenced_by,
        content=content,
    )


def apply_reconciled_register(vault_path: Path, draft: SourceRegisterReconcileDraft) -> Path:
    absolute = vault_path / draft.register_path
    write_note_content(vault_path, draft.register_path, draft.content)
    return absolute
