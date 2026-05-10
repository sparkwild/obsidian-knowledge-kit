#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obsidian_knowledge_shared.context_loader import detect_active_vault
from obsidian_knowledge_shared.context_pack import build_context_pack, write_context_pack


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Vaultwright context pack note for an Obsidian knowledge-base query.")
    parser.add_argument("query", help="The user question or retrieval task to focus the context pack on.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--candidate-limit", type=int, default=8, help="How many ranked candidate notes to include.")
    parser.add_argument("--read-limit", type=int, default=5, help="How many ranked candidate notes count as notes read by Codex.")
    parser.add_argument("--apply", action="store_true", help="Write the context pack note into the vault.")
    parser.add_argument("--json", action="store_true", help="Emit the context pack as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    payload = build_context_pack(
        vault_path=vault_path,
        query=args.query,
        candidate_limit=args.candidate_limit,
        read_limit=args.read_limit,
    )

    if args.apply:
        written = write_context_pack(vault_path, payload)
        payload["written_path"] = str(written.relative_to(vault_path))
    else:
        payload["written_path"] = None

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"context_pack_path: {payload['context_pack_path']}")
        print(f"candidate_notes: {len(payload['candidate_notes'])}")
        print(f"source_candidates: {len(payload['source_candidates'])}")
        print(f"knowledge_gaps: {len(payload['knowledge_gaps'])}")
        if payload["written_path"]:
            print(f"written_path: {payload['written_path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
