#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obsidian_knowledge_shared.context_loader import detect_active_vault, load_context


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def main() -> int:
    parser = argparse.ArgumentParser(description="Load the core Obsidian knowledge-base context.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--session-count", type=int, default=2, help="How many recent session notes to include.")
    parser.add_argument("--json", action="store_true", help="Emit the context as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    payload = load_context(vault_path, session_limit=args.session_count)
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"loaded_startup_notes: {len(payload['startup_notes'])}")
        print(f"recent_sessions: {len(payload['recent_sessions'])}")
        if payload["missing_startup_notes"]:
            print(f"missing_startup_notes: {payload['missing_startup_notes']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
