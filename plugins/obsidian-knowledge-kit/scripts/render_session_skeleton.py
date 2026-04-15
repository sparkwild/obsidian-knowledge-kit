#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obsidian_knowledge_shared.context_loader import detect_active_vault


@dataclass
class SessionSkeleton:
    vault_path: str
    session_path: str
    daily_note_path: str
    content: str


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def detect_project_overview_path(vault_path: Path) -> str:
    project_overviews = sorted(
        path.relative_to(vault_path).as_posix()
        for path in (vault_path / "04_projects").glob("*/project_overview.md")
        if path.is_file()
    )
    if project_overviews:
        return project_overviews[0].removesuffix(".md")
    return "04_projects/knowledge_base/project_overview"


def build_content(session_slug: str, today: str, now_value: str, project_overview_path: str) -> str:
    return f"""---
title: {session_slug}
created: {now_value}
updated: {now_value}
type: session
---

# {session_slug}

## objective 目标

## context_loaded 已读取上下文

- [[00_system/index]]
- [[{project_overview_path}]]
- [[05_knowledge/manuals/codex_native_workflow]]

## work_log 工作记录

## outcomes 结果

## next_actions 下一步

## related_daily_note 关联日记

- [[02_timeline/daily_notes/{today}]]
"""


def render_skeleton(vault_path: Path) -> SessionSkeleton:
    now = datetime.now()
    today = now.date().isoformat()
    stamp = now.strftime("%Y%m%d_%H%M%S")
    session_slug = f"session_{stamp}"
    session_path = f"02_timeline/sessions/{session_slug}.md"
    daily_note_path = f"02_timeline/daily_notes/{today}.md"
    project_overview_path = detect_project_overview_path(vault_path)
    content = build_content(session_slug, today, now.isoformat(timespec="seconds"), project_overview_path)
    return SessionSkeleton(
        vault_path=str(vault_path),
        session_path=session_path,
        daily_note_path=daily_note_path,
        content=content,
    )


def apply_skeleton(vault_path: Path, skeleton: SessionSkeleton) -> None:
    absolute_path = vault_path / skeleton.session_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_text(skeleton.content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Render or create a session note skeleton for the knowledge vault.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--apply", action="store_true", help="Write the rendered session skeleton into the vault.")
    parser.add_argument("--json", action="store_true", help="Emit the skeleton payload as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    skeleton = render_skeleton(vault_path)
    if args.apply:
        apply_skeleton(vault_path, skeleton)

    payload = asdict(skeleton)
    payload["applied"] = args.apply
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"session_path: {payload['session_path']}")
        print(f"daily_note_path: {payload['daily_note_path']}")
        print(f"applied: {payload['applied']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
