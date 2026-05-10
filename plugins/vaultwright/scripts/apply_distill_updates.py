#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obsidian_knowledge_shared.context_loader import detect_active_vault
from obsidian_knowledge_shared.distill_updater import apply_distill_update_draft, build_distill_update_draft


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare or apply distill updates for a knowledge-base session.")
    parser.add_argument("session_path", help="Session note path relative to the vault, e.g. 02_timeline/sessions/session_x.md")
    parser.add_argument("--summary", required=True, help="One-line summary for log and recent session tracking.")
    parser.add_argument("--session-label", help="Optional display label for the session link in active_context.")
    parser.add_argument("--project-progress", help="Optional replacement for the project_overview latest_progress line.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--apply", action="store_true", help="Write the log and active-context updates into the vault.")
    parser.add_argument("--json", action="store_true", help="Emit the draft payload as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    draft = build_distill_update_draft(
        vault_path,
        session_path=args.session_path,
        session_summary=args.summary,
        session_label=args.session_label,
        project_progress=args.project_progress,
    )
    if args.apply:
        apply_distill_update_draft(vault_path, draft)

    payload = asdict(draft)
    payload["applied"] = args.apply
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"session_path: {payload['session_path']}")
        print(f"applied: {payload['applied']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
