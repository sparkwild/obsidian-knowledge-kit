from __future__ import annotations

import hashlib
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from .obsidian_runtime import append_note_content, list_markdown_notes, write_note_content

@dataclass
class IngestRegisterDraft:
    vault_path: str
    source: str
    source_kind: str
    source_mode: str
    source_id: str
    source_hash: str
    captured_at: str
    extracted_at: str | None
    snapshot_path: str | None
    capture_status: str
    distill_status: str
    verification_status: str
    claim_count: int
    synthesis_targets: list[str]
    register_path: str
    title: str
    alias: str
    material_types: list[str]
    project_overview_path: str | None
    content: str
    log_entry: str


def looks_like_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def detect_source_kind(source: str) -> str:
    if looks_like_url(source):
        return "url"
    source_path = Path(source).expanduser()
    if source_path.is_dir():
        return "directory"
    if source_path.is_file():
        return "file"
    raise FileNotFoundError(f"Source does not exist or is unsupported: {source}")


def default_source_mode(source_kind: str) -> str:
    if source_kind == "url":
        return "extracted_snapshot"
    return "external_reference"


def normalize_token(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized


def infer_batch_token(source: str, source_kind: str) -> str:
    if source_kind == "url":
        parsed = urlparse(source)
        host = normalize_token(parsed.netloc)
        path = normalize_token(Path(parsed.path).stem or "page")
        return compact_token(f"{host}_{path}", source, source_kind)
    source_path = Path(source).expanduser()
    raw_token = normalize_token(source_path.stem if source_path.is_file() else source_path.name)
    return compact_token(raw_token, source, source_kind)


def compact_token(raw_token: str, source: str, source_kind: str) -> str:
    if raw_token:
        return raw_token
    digest = hashlib.sha1(source.encode("utf-8")).hexdigest()[:8]
    return f"{source_kind}_{digest}"


def build_source_id(batch_token: str) -> str:
    return f"src_{batch_token}"


def build_source_hash(source: str) -> str:
    return hashlib.sha1(source.encode("utf-8")).hexdigest()


def infer_title(source: str, source_kind: str, batch_token: str) -> tuple[str, str]:
    if source_kind == "url":
        parsed = urlparse(source)
        host = parsed.netloc
        return batch_token, f"{host} 来源登记"
    source_path = Path(source).expanduser()
    return batch_token, f"{source_path.name} 资料登记"


def infer_material_types(source: str, source_kind: str) -> list[str]:
    if source_kind == "url":
        return ["web"]

    source_path = Path(source).expanduser()
    if source_kind == "file":
        extension = source_path.suffix.lower().lstrip(".")
        return [extension or "unknown"]

    counter: Counter[str] = Counter()
    for path in source_path.rglob("*"):
        if path.is_file():
            extension = path.suffix.lower().lstrip(".") or "unknown"
            counter[extension] += 1
    if not counter:
        return ["unknown"]
    return [item for item, _count in counter.most_common(6)]


def infer_snapshot_path(batch_token: str, source_mode: str) -> str | None:
    if source_mode != "extracted_snapshot":
        return None
    return f"03_raw/snapshots/{batch_token}.md"


def detect_project_overview_path(vault_path: Path) -> str | None:
    project_overviews = sorted(
        path for path in list_markdown_notes(vault_path, folder="04_projects") if path.endswith("/project_overview.md")
    )
    return project_overviews[0] if project_overviews else None


def build_register_content(
    title: str,
    alias: str,
    created_date: str,
    captured_at: str,
    register_path: str,
    source_mode: str,
    source_id: str,
    source_hash: str,
    source: str,
    material_types: list[str],
    project_overview_path: str | None,
    source_kind: str,
    snapshot_path: str | None,
    capture_status: str,
    distill_status: str,
    verification_status: str,
    claim_count: int,
    synthesis_targets: list[str],
) -> str:
    related_lines = []
    if project_overview_path:
        related_lines.append(f"  - {project_overview_path}")

    material_type_lines = "\n".join(f"  - {material_type}" for material_type in material_types)
    related_block = "\n".join(related_lines) if related_lines else "  - 04_projects/*/project_overview.md"
    overview_label = "外部链接" if source_kind == "url" else "本地路径"
    synthesis_target_lines = "\n".join(f"  - {target}" for target in synthesis_targets) if synthesis_targets else "  - "
    extracted_at_line = ""
    snapshot_path_line = snapshot_path or ""
    evidence_block_id = f"evidence_{source_id}_001"
    claim_block_id = f"claim_{source_id}_001"

    return f"""---
title: {title}
aliases:
  - {alias}
created: {created_date}
updated: {created_date}
type: raw
source_id: {source_id}
source_hash: {source_hash}
captured_at: {captured_at}
extracted_at: {extracted_at_line}
source_mode: {source_mode}
external_path: {source}
snapshot_path: {snapshot_path_line}
capture_status: {capture_status}
distill_status: {distill_status}
verification_status: {verification_status}
ingest_status: pending
claim_count: {claim_count}
material_types:
{material_type_lines}
synthesis_targets:
{synthesis_target_lines}
related:
{related_block}
---

# {alias}（{title}）

## source_overview 来源概览

本批来源的{overview_label}：

`{source}`

## source_assessment 来源判断

- source_id: `{source_id}`
- source_hash: `{source_hash}`
- source_kind: `{source_kind}`
- source_mode: `{source_mode}`
- material_types: `{", ".join(material_types)}`
- capture_status: `{capture_status}`
- distill_status: `{distill_status}`
- verification_status: `{verification_status}`
- claim_count: `{claim_count}`

## evidence_blocks 证据块

### evidence_001

- source_excerpt: [TODO]
- interpretation: [TODO]
- capture_status: `{capture_status}`
- verification_status: `{verification_status}`
^{evidence_block_id}

## claim_candidates 断言候选

> [!claim]
> claim: [TODO]
> source: [[{register_path}#^{evidence_block_id}]]
> status: pending
> confidence: low
> reviewed_at:
> synthesis_target:
^{claim_block_id}

## current_result 当前结果

- 已创建来源登记，等待后续 ingest 处理。

## next_step 下一步

- 读取原始来源
- 提取高价值内容
- 更新相关知识页、项目页、索引和日志
"""


def build_log_entry(created_date: str, register_path: str, source: str, source_kind: str) -> str:
    return f"""

## [{created_date}] ingest | register_{source_kind}

- registered source `{source}`
- created `{register_path}`
""".rstrip()


def build_ingest_register_draft(vault_path: Path, source: str, project_overview_path: str | None = None) -> IngestRegisterDraft:
    now = datetime.now()
    created_date = now.date().isoformat()
    captured_at = now.isoformat(timespec="seconds")
    source_kind = detect_source_kind(source)
    source_mode = default_source_mode(source_kind)
    batch_token = infer_batch_token(source, source_kind)
    source_id = build_source_id(batch_token)
    source_hash = build_source_hash(source)
    snapshot_path = infer_snapshot_path(batch_token, source_mode)
    title, alias = infer_title(source, source_kind, batch_token)
    register_path = f"03_raw/registers/{batch_token}_{now.strftime('%Y_%m')}.md"
    material_types = infer_material_types(source, source_kind)
    capture_status = "registered"
    distill_status = "pending"
    verification_status = "unverified"
    claim_count = 1
    synthesis_targets: list[str] = []
    project_overview_path = project_overview_path or detect_project_overview_path(vault_path)
    content = build_register_content(
        title=title,
        alias=alias,
        created_date=created_date,
        captured_at=captured_at,
        register_path=register_path,
        source_mode=source_mode,
        source_id=source_id,
        source_hash=source_hash,
        source=source,
        material_types=material_types,
        project_overview_path=project_overview_path,
        source_kind=source_kind,
        snapshot_path=snapshot_path,
        capture_status=capture_status,
        distill_status=distill_status,
        verification_status=verification_status,
        claim_count=claim_count,
        synthesis_targets=synthesis_targets,
    )
    log_entry = build_log_entry(created_date, register_path, source, source_kind)
    return IngestRegisterDraft(
        vault_path=str(vault_path),
        source=source,
        source_kind=source_kind,
        source_mode=source_mode,
        source_id=source_id,
        source_hash=source_hash,
        captured_at=captured_at,
        extracted_at=None,
        snapshot_path=snapshot_path,
        capture_status=capture_status,
        distill_status=distill_status,
        verification_status=verification_status,
        claim_count=claim_count,
        synthesis_targets=synthesis_targets,
        register_path=register_path,
        title=title,
        alias=alias,
        material_types=material_types,
        project_overview_path=project_overview_path,
        content=content,
        log_entry=log_entry,
    )


def apply_ingest_register_draft(vault_path: Path, draft: IngestRegisterDraft) -> None:
    write_note_content(vault_path, draft.register_path, draft.content)
    append_note_content(vault_path, "00_system/log.md", draft.log_entry)
