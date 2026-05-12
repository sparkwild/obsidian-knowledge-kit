from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterable

from .constants import CONDITIONAL_SKILL_MAP, CORE_NOTE_PATHS, REQUIRED_OFFICIAL_SKILLS, default_codex_home


def detect_codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME", default_codex_home())).expanduser()


def skill_path(skill_name: str, codex_home: Path) -> Path:
    return codex_home / "skills" / skill_name


def is_skill_installed(skill_name: str, codex_home: Path) -> bool:
    path = skill_path(skill_name, codex_home)
    if path.is_symlink():
        try:
            target = path.resolve(strict=True)
        except FileNotFoundError:
            return False
        return (target / "SKILL.md").exists()
    return (path / "SKILL.md").exists()


def required_skill_set(extra_needs: Iterable[str]) -> tuple[list[str], list[str]]:
    required = list(REQUIRED_OFFICIAL_SKILLS)
    conditional = []
    for need in extra_needs:
        mapped = CONDITIONAL_SKILL_MAP.get(need)
        if mapped and mapped not in conditional:
            conditional.append(mapped)
    return required, conditional


def run_obsidian_info() -> tuple[bool, str]:
    if shutil.which("obsidian") is None:
        return False, ""
    proc = subprocess.run(
        ["obsidian", "vault", "info=path"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if proc.returncode != 0:
        return False, ""
    value = proc.stdout.strip()
    return bool(value), value


def check_core_notes(vault_path: Path) -> list[str]:
    return [path for path in CORE_NOTE_PATHS if not (vault_path / path).exists()]


def build_report(task: str, needs: Iterable[str], require_core_notes: bool) -> dict:
    codex_home = detect_codex_home()
    required, conditional = required_skill_set(needs)
    missing_required = [name for name in required if not is_skill_installed(name, codex_home)]
    missing_conditional = [name for name in conditional if not is_skill_installed(name, codex_home)]

    obsidian_command_exists = shutil.which("obsidian") is not None
    connected, raw_vault = run_obsidian_info()
    vault_path = Path(raw_vault).expanduser() if raw_vault else None
    core_missing = []
    if connected and vault_path and require_core_notes:
        core_missing = check_core_notes(vault_path)

    issues = []
    if missing_required:
        issues.append("missing_required_skills")
    if missing_conditional:
        issues.append("missing_conditional_skills")
    if not obsidian_command_exists:
        issues.append("missing_obsidian_cli_command")
    if not connected:
        issues.append("obsidian_not_connected")
    if require_core_notes and core_missing:
        issues.append("missing_core_knowledge_base_notes")

    return {
        "task": task,
        "ok": not issues,
        "codex_home": str(codex_home),
        "required_skills": required,
        "conditional_skills": conditional,
        "missing_required_skills": missing_required,
        "missing_conditional_skills": missing_conditional,
        "obsidian_command_exists": obsidian_command_exists,
        "obsidian_connected": connected,
        "active_vault_path": str(vault_path) if vault_path else None,
        "missing_core_notes": core_missing,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Obsidian knowledge-skill preflight requirements.")
    parser.add_argument("--task", required=True, choices=["init", "ingest", "refine"])
    parser.add_argument("--need", action="append", default=[], help="Optional feature needs: url|canvas|base")
    parser.add_argument("--check-core-notes", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    report = build_report(args.task, args.need, args.check_core_notes)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for key, value in report.items():
            print(f"{key}: {value}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
