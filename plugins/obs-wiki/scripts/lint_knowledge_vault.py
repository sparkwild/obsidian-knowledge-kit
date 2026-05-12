#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obs_wiki_shared.context_loader import detect_active_vault
from obs_wiki_shared.knowledge_lint import build_lint_report, write_lint_report


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the obs-wiki knowledge lint workflow against an Obsidian vault.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--stale-days", type=int, default=30, help="Mark conceptual notes older than this many days as stale.")
    parser.add_argument("--session-limit", type=int, default=8, help="How many recent sessions to inspect for log-trail checks.")
    parser.add_argument("--apply", action="store_true", help="Write the lint report into the vault.")
    parser.add_argument("--json", action="store_true", help="Emit the lint report payload as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    payload = build_lint_report(vault_path, stale_days=args.stale_days, session_limit=args.session_limit)

    if args.apply:
        written = write_lint_report(vault_path, payload)
        payload["written_path"] = str(written.relative_to(vault_path))
    else:
        payload["written_path"] = None

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"report_path: {payload['report_path']}")
        print(f"errors: {payload['summary']['error']}")
        print(f"warnings: {payload['summary']['warning']}")
        print(f"info: {payload['summary']['info']}")
        if payload["written_path"]:
            print(f"written_path: {payload['written_path']}")
    return 0 if payload["summary"]["error"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
