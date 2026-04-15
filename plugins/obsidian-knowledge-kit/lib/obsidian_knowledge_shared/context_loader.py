from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .preflight import run_obsidian_info

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
    connected, raw_vault = run_obsidian_info()
    if not connected or not raw_vault:
        return None
    return Path(raw_vault).expanduser()


def read_note(vault_path: Path, note_path: str) -> LoadedNote | None:
    absolute = vault_path / note_path
    if not absolute.exists():
        return None
    return LoadedNote(path=note_path, content=absolute.read_text(encoding="utf-8"))


def latest_session_notes(vault_path: Path, limit: int = 2) -> list[LoadedNote]:
    session_dir = vault_path / SESSION_DIRECTORY
    if not session_dir.exists():
        return []

    session_paths = sorted(
        (path for path in session_dir.glob("*.md") if path.is_file()),
        key=lambda path: (path.stat().st_mtime, path.name),
        reverse=True,
    )
    return [
        LoadedNote(
            path=str(path.relative_to(vault_path)),
            content=path.read_text(encoding="utf-8"),
        )
        for path in session_paths[:limit]
    ]


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
        path.relative_to(vault_path).as_posix()
        for path in (vault_path / "04_projects").glob("*/project_overview.md")
        if path.is_file()
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
