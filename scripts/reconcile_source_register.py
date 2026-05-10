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
from obsidian_knowledge_shared.source_register_state import apply_reconciled_register, reconcile_source_register


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def main() -> int:
    parser = argparse.ArgumentParser(description="Reconcile a Vaultwright raw/source register with actual claim/evidence and synthesis-target state.")
    parser.add_argument("register_path", help="Register note path relative to the vault, e.g. 03_raw/registers/example_2026_05.md")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--apply", action="store_true", help="Write the reconciled register fields back into the vault.")
    parser.add_argument("--json", action="store_true", help="Emit the reconciliation payload as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    draft = reconcile_source_register(vault_path, args.register_path)
    if args.apply:
        apply_reconciled_register(vault_path, draft)

    payload = asdict(draft)
    payload["applied"] = args.apply
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"register_path: {payload['register_path']}")
        print(f"claim_count: {payload['claim_count']}")
        print(f"capture_status: {payload['capture_status']}")
        print(f"distill_status: {payload['distill_status']}")
        print(f"verification_status: {payload['verification_status']}")
        print(f"synthesis_targets: {len(payload['synthesis_targets'])}")
        print(f"applied: {payload['applied']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
