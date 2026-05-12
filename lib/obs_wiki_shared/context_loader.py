from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .obsidian_runtime import detect_active_vault_info, list_markdown_notes, read_note_content

STARTUP_NOTE_PATHS = (
    "00_system/system.md",
    "01_ai_core/active_context.md",
    "01_ai_core/longterm_context.md",
    "00_system/index.md",
    "05_knowledge/manuals/codex_native_workflow.md",
    "05_knowledge/manuals/external_material_ingest_guide.md",
)

SESSION_DIRECTORY = "02_timeline/sessions"


@dataclass
class LoadedNote:
    path: str
    content: str


def detect_active_vault() -> Path | None:
    info = detect_active_vault_info()
    if info is None:
        return None
    return info.path


def read_note(vault_path: Path, note_path: str) -> LoadedNote | None:
    content = read_note_content(vault_path, note_path)
    if content is None:
        return None
    return LoadedNote(path=note_path, content=content)


def latest_session_notes(vault_path: Path, limit: int = 2) -> list[LoadedNote]:
    session_paths = sorted(list_markdown_notes(vault_path, folder=SESSION_DIRECTORY), reverse=True)
    loaded_notes: list[LoadedNote] = []
    for note_path in session_paths[:limit]:
        content = read_note_content(vault_path, note_path)
        if content is not None:
            loaded_notes.append(LoadedNote(path=note_path, content=content))
    return loaded_notes


def load_context(vault_path: Path, session_limit: int = 2) -> dict:
    notes = []
    missing_notes = []
    for note_path in STARTUP_NOTE_PATHS:
        loaded = read_note(vault_path, note_path)
        if loaded is None:
            missing_notes.append(note_path)
        else:
            notes.append({"path": loaded.path, "content": loaded.content})

    project_overviews = sorted(
        path for path in list_markdown_notes(vault_path, folder="04_projects") if path.endswith("/project_overview.md")
    )
    if not project_overviews:
        missing_notes.append("04_projects/*/project_overview.md")
    else:
        for note_path in project_overviews:
            loaded = read_note(vault_path, note_path)
            if loaded is not None:
                notes.append({"path": loaded.path, "content": loaded.content})

    sessions = [
        {"path": loaded.path, "content": loaded.content}
        for loaded in latest_session_notes(vault_path, limit=session_limit)
    ]

    return {
        "vault_path": str(vault_path),
        "loaded_at": datetime.now().isoformat(timespec="seconds"),
        "startup_notes": notes,
        "missing_startup_notes": missing_notes,
        "recent_sessions": sessions,
    }
