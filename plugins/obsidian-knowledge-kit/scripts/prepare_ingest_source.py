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
from obsidian_knowledge_shared.ingest_register import apply_ingest_register_draft, build_ingest_register_draft


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a raw source register draft for knowledge-base ingest.")
    parser.add_argument("source", help="Local file, local directory, or URL to register for ingest.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--project-overview", help="Explicit project overview note path relative to the vault.")
    parser.add_argument("--apply", action="store_true", help="Write the register note and append a log entry.")
    parser.add_argument("--json", action="store_true", help="Emit the draft payload as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    draft = build_ingest_register_draft(vault_path, args.source, project_overview_path=args.project_overview)
    if args.apply:
        apply_ingest_register_draft(vault_path, draft)

    payload = asdict(draft)
    payload["applied"] = args.apply
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"source_kind: {payload['source_kind']}")
        print(f"source_mode: {payload['source_mode']}")
        print(f"register_path: {payload['register_path']}")
        print(f"applied: {payload['applied']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
