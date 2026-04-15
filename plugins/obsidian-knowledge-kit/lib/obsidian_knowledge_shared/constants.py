from __future__ import annotations

from pathlib import Path

REPO_OWNER = "kepano"
REPO_NAME = "obsidian-skills"
REPO_REF = "main"

REQUIRED_OFFICIAL_SKILLS = ("obsidian-cli", "obsidian-markdown")
CONDITIONAL_SKILL_MAP = {
    "url": "defuddle",
    "canvas": "json-canvas",
    "base": "obsidian-bases",
}

CORE_NOTE_PATHS = (
    "00_system/system.md",
    "00_system/index.md",
    "01_ai_core/active_context.md",
    "01_ai_core/longterm_context.md",
)

BASE_DIRECTORIES = (
    "00_system",
    "01_ai_core",
    "02_timeline/daily_notes",
    "02_timeline/sessions",
    "02_timeline/weekly_reviews",
    "03_raw",
    "04_projects",
    "05_knowledge",
    "06_experience",
    "07_archive",
)

ROOT_NOTE_PATHS = (
    "00_system/system.md",
    "00_system/index.md",
    "00_system/log.md",
    "00_system/decision_records.md",
    "01_ai_core/active_context.md",
    "01_ai_core/longterm_context.md",
    "04_projects/knowledge_base/project_overview.md",
    "05_knowledge/manuals/codex_native_workflow.md",
    "05_knowledge/manuals/external_material_ingest_guide.md",
)


def default_codex_home() -> Path:
    return Path.home() / ".codex"
