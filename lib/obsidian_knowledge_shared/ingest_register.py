from __future__ import annotations

import hashlib
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


@dataclass
class IngestRegisterDraft:
    vault_path: str
    source: str
    source_kind: str
    source_mode: str
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


def detect_project_overview_path(vault_path: Path) -> str | None:
    project_overviews = sorted(
        path.relative_to(vault_path).as_posix()
        for path in (vault_path / "04_projects").glob("*/project_overview.md")
        if path.is_file()
    )
    return project_overviews[0] if project_overviews else None


def build_register_content(
    title: str,
    alias: str,
    created_date: str,
    source_mode: str,
    source: str,
    material_types: list[str],
    project_overview_path: str | None,
    source_kind: str,
) -> str:
    related_lines = []
    if project_overview_path:
        related_lines.append(f"  - {project_overview_path}")

    material_type_lines = "\n".join(f"  - {material_type}" for material_type in material_types)
    related_block = "\n".join(related_lines) if related_lines else "  - 04_projects/*/project_overview.md"
    overview_label = "外部链接" if source_kind == "url" else "本地路径"

    return f"""---
title: {title}
aliases:
  - {alias}
created: {created_date}
updated: {created_date}
type: raw
source_mode: {source_mode}
external_path: {source}
ingest_status: pending
material_types:
{material_type_lines}
related:
{related_block}
---

# {alias}（{title}）

## source_overview 来源概览

本批来源的{overview_label}：

`{source}`

## source_assessment 来源判断

- source_kind: `{source_kind}`
- source_mode: `{source_mode}`
- material_types: `{", ".join(material_types)}`

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
    source_kind = detect_source_kind(source)
    source_mode = default_source_mode(source_kind)
    batch_token = infer_batch_token(source, source_kind)
    title, alias = infer_title(source, source_kind, batch_token)
    register_path = f"03_raw/registers/{batch_token}_{now.strftime('%Y_%m')}.md"
    material_types = infer_material_types(source, source_kind)
    project_overview_path = project_overview_path or detect_project_overview_path(vault_path)
    content = build_register_content(
        title=title,
        alias=alias,
        created_date=created_date,
        source_mode=source_mode,
        source=source,
        material_types=material_types,
        project_overview_path=project_overview_path,
        source_kind=source_kind,
    )
    log_entry = build_log_entry(created_date, register_path, source, source_kind)
    return IngestRegisterDraft(
        vault_path=str(vault_path),
        source=source,
        source_kind=source_kind,
        source_mode=source_mode,
        register_path=register_path,
        title=title,
        alias=alias,
        material_types=material_types,
        project_overview_path=project_overview_path,
        content=content,
        log_entry=log_entry,
    )


def apply_ingest_register_draft(vault_path: Path, draft: IngestRegisterDraft) -> None:
    register_absolute = vault_path / draft.register_path
    register_absolute.parent.mkdir(parents=True, exist_ok=True)
    register_absolute.write_text(draft.content, encoding="utf-8")

    log_absolute = vault_path / "00_system/log.md"
    if log_absolute.exists():
        existing = log_absolute.read_text(encoding="utf-8").rstrip()
        log_absolute.write_text(existing + draft.log_entry + "\n", encoding="utf-8")
