from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class DistillUpdateDraft:
    vault_path: str
    session_path: str
    session_label: str
    session_summary: str
    log_entry: str
    active_context_entry: str
    project_overview_path: str | None
    project_progress: str | None


def detect_project_overview_path(vault_path: Path) -> str | None:
    project_overviews = sorted(
        path.relative_to(vault_path).as_posix()
        for path in (vault_path / "04_projects").glob("*/project_overview.md")
        if path.is_file()
    )
    return project_overviews[0] if project_overviews else None


def derive_session_label(session_content: str, default_label: str) -> str:
    for line in session_content.splitlines():
        if line.startswith("# "):
            return line.removeprefix("# ").strip()
    return default_label


def build_log_entry(created_date: str, session_path: str, summary: str) -> str:
    event_name = Path(session_path).stem
    return f"""

## [{created_date}] session | {event_name}

- created `{session_path}`
- {summary}
""".rstrip()


def build_active_context_entry(session_path: str, session_label: str, summary: str) -> str:
    target = session_path.removesuffix(".md")
    return f"- [[{target}|{session_label}]] - {summary}"


def build_distill_update_draft(
    vault_path: Path,
    session_path: str,
    session_summary: str,
    session_label: str | None = None,
    project_progress: str | None = None,
) -> DistillUpdateDraft:
    absolute_session = vault_path / session_path
    if not absolute_session.exists():
        raise FileNotFoundError(f"Session note does not exist: {absolute_session}")

    session_content = absolute_session.read_text(encoding="utf-8")
    derived_label = session_label or derive_session_label(session_content, default_label=Path(session_path).stem)
    created_date = datetime.now().date().isoformat()
    project_overview_path = detect_project_overview_path(vault_path)
    return DistillUpdateDraft(
        vault_path=str(vault_path),
        session_path=session_path,
        session_label=derived_label,
        session_summary=session_summary,
        log_entry=build_log_entry(created_date, session_path, session_summary),
        active_context_entry=build_active_context_entry(session_path, derived_label, session_summary),
        project_overview_path=project_overview_path,
        project_progress=project_progress,
    )


def update_frontmatter_updated(content: str, updated_date: str) -> str:
    if not content.startswith("---\n"):
        return content
    pattern = re.compile(r"(?m)^updated:\s*.*$")
    if pattern.search(content):
        return pattern.sub(f"updated: {updated_date}", content, count=1)
    return content


def append_log_entry(log_content: str, log_entry: str) -> str:
    if log_entry in log_content:
        return log_content
    return log_content.rstrip() + log_entry + "\n"


def prepend_recent_session(active_context_content: str, entry: str) -> str:
    if entry in active_context_content:
        return active_context_content
    pattern = re.compile(r"(## recent_sessions[^\n]*\n\n)", re.MULTILINE)
    match = pattern.search(active_context_content)
    if not match:
        return active_context_content.rstrip() + f"\n\n## recent_sessions 最近会话\n\n{entry}\n"
    insert_at = match.end()
    return active_context_content[:insert_at] + entry + "\n" + active_context_content[insert_at:]


def update_project_progress(project_content: str, progress: str) -> str:
    pattern = re.compile(r"(?m)^- latest_progress:.*$")
    if pattern.search(project_content):
        return pattern.sub(f"- latest_progress: {progress}", project_content, count=1)
    section_pattern = re.compile(r"(## current_stage[^\n]*\n\n(?:- .*\n)+)")
    match = section_pattern.search(project_content)
    if not match:
        return project_content.rstrip() + f"\n\n## current_stage 当前阶段\n\n- latest_progress: {progress}\n"
    insert_at = match.end()
    return project_content[:insert_at] + f"- latest_progress: {progress}\n" + project_content[insert_at:]


def apply_distill_update_draft(vault_path: Path, draft: DistillUpdateDraft) -> None:
    today = datetime.now().date().isoformat()

    log_path = vault_path / "00_system/log.md"
    if log_path.exists():
        log_content = log_path.read_text(encoding="utf-8")
        log_path.write_text(append_log_entry(log_content, draft.log_entry), encoding="utf-8")

    active_context_path = vault_path / "01_ai_core/active_context.md"
    if active_context_path.exists():
        active_context_content = active_context_path.read_text(encoding="utf-8")
        active_context_content = prepend_recent_session(active_context_content, draft.active_context_entry)
        active_context_content = update_frontmatter_updated(active_context_content, today)
        active_context_path.write_text(active_context_content, encoding="utf-8")

    if draft.project_overview_path and draft.project_progress:
        project_path = vault_path / draft.project_overview_path
        if project_path.exists():
            project_content = project_path.read_text(encoding="utf-8")
            project_content = update_project_progress(project_content, draft.project_progress)
            project_content = update_frontmatter_updated(project_content, today)
            project_path.write_text(project_content, encoding="utf-8")
