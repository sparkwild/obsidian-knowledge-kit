#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


KNOWLEDGE_HINT = """# Global Working Rules

- The user uses an Obsidian knowledge base.
- For knowledge-base-related tasks, first use `obsidian vault info=path` to detect the active vault.
- Then read:
- `00_system/system.md`
- `05_knowledge/manuals/codex_native_workflow.md`
- Read `00_system/index.md`, `04_projects/*/project_overview.md`, or specialized manuals only when the task needs them.
"""


def target_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    return Path.home() / ".codex" / "AGENTS.md"


def has_knowledge_hint(content: str) -> bool:
    markers = (
        "The user uses an Obsidian knowledge base.",
        "obsidian vault info=path",
        "00_system/system.md",
        "05_knowledge/manuals/codex_native_workflow.md",
    )
    return all(marker in content for marker in markers)


def apply_hint(path: Path) -> str:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if has_knowledge_hint(existing):
        return "already_present"

    path.parent.mkdir(parents=True, exist_ok=True)
    if existing.strip():
        new_content = existing.rstrip() + "\n\n" + KNOWLEDGE_HINT.rstrip() + "\n"
        status = "appended"
    else:
        new_content = KNOWLEDGE_HINT.rstrip() + "\n"
        status = "created"
    path.write_text(new_content, encoding="utf-8")
    return status


def build_report(path: Path, apply: bool) -> dict:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    report = {
        "target_path": str(path),
        "exists": path.exists(),
        "has_knowledge_hint": has_knowledge_hint(existing),
        "applied": False,
        "status": "unchanged",
    }
    if apply:
        status = apply_hint(path)
        updated = path.read_text(encoding="utf-8")
        report.update(
            {
                "exists": path.exists(),
                "has_knowledge_hint": has_knowledge_hint(updated),
                "applied": status in {"created", "appended"},
                "status": status,
            }
        )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Check or install the global knowledge-base hint in Codex AGENTS.md.")
    parser.add_argument("--path", help="Explicit AGENTS.md path. Defaults to ~/.codex/AGENTS.md.")
    parser.add_argument("--apply", action="store_true", help="Append the minimal knowledge-base hint if missing.")
    parser.add_argument("--json", action="store_true", help="Emit the report as JSON.")
    args = parser.parse_args()

    path = target_path(args.path)
    report = build_report(path, apply=args.apply)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for key, value in report.items():
            print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
