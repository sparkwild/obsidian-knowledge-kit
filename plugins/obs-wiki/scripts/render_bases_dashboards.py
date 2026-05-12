#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obs_wiki_shared.context_loader import detect_active_vault
from obs_wiki_shared.obsidian_runtime import write_note_content


DASHBOARDS = {
    "00_system/dashboards/knowledge_inbox.base": """filters:
  and:
    - 'file.ext == "md"'
    - 'type == "raw"'

properties:
  file.name:
    displayName: Note
  external_path:
    displayName: Source
  source_mode:
    displayName: Mode
  capture_status:
    displayName: Capture
  distill_status:
    displayName: Distill
  verification_status:
    displayName: Verification
  claim_count:
    displayName: Claims

views:
  - type: table
    name: "Needs Attention"
    filters:
      or:
        - 'ingest_status == "pending"'
        - 'capture_status != "captured"'
        - 'distill_status != "distilled"'
        - 'verification_status != "verified"'
    order:
      - file.name
      - external_path
      - source_mode
      - capture_status
      - distill_status
      - verification_status
      - claim_count
      - file.mtime
""",
    "00_system/dashboards/unverified_claims.base": """filters:
  and:
    - 'file.ext == "md"'
    - 'type == "raw"'
    - 'claim_count > 0'

properties:
  file.name:
    displayName: Source Note
  verification_status:
    displayName: Verification
  claim_count:
    displayName: Claims
  distill_status:
    displayName: Distill
  synthesis_targets:
    displayName: Synthesis Targets

views:
  - type: table
    name: "Unverified Claims"
    filters:
      or:
        - 'verification_status == "unverified"'
        - 'verification_status == "pending"'
        - 'verification_status == "in_review"'
    order:
      - file.name
      - claim_count
      - verification_status
      - distill_status
      - synthesis_targets
      - file.mtime
""",
    "00_system/dashboards/stale_concepts.base": """filters:
  and:
    - 'file.inFolder("05_knowledge")'
    - 'file.ext == "md"'
  not:
    - 'file.inFolder("05_knowledge/manuals")'

formulas:
  review_age_days: 'if(last_reviewed, (today() - date(last_reviewed)).days, if(updated, (today() - date(updated)).days, ""))'

properties:
  file.name:
    displayName: Note
  formula.review_age_days:
    displayName: Review Age (days)
  last_reviewed:
    displayName: Last Reviewed

views:
  - type: table
    name: "Stale Concepts"
    filters:
      and:
        - 'formula.review_age_days >= 30'
    order:
      - file.name
      - last_reviewed
      - updated
      - formula.review_age_days
      - file.path
""",
    "00_system/dashboards/low_evidence_concepts.base": """filters:
  and:
    - 'file.inFolder("05_knowledge")'
    - 'file.ext == "md"'
  not:
    - 'file.inFolder("05_knowledge/manuals")'

formulas:
  source_count: 'if(sources, sources.length, 0)'

properties:
  file.name:
    displayName: Note
  formula.source_count:
    displayName: Source Count

views:
  - type: table
    name: "Low Evidence Concepts"
    filters:
      and:
        - 'formula.source_count < 2'
    order:
      - file.name
      - formula.source_count
      - sources
      - updated
      - file.path
""",
    "00_system/dashboards/knowledge_gaps.base": """filters:
  or:
    - 'type == "gap"'
    - 'status == "gap"'
    - 'file.hasTag("gap")'
    - 'file.hasTag("knowledge-gap")'

properties:
  file.name:
    displayName: Gap
  status:
    displayName: Status
  related:
    displayName: Related

views:
  - type: table
    name: "Knowledge Gaps"
    order:
      - file.name
      - status
      - related
      - updated
      - file.path
""",
    "00_system/dashboards/codex_queue.base": """filters:
  or:
    - 'status == "ready-for-codex"'
    - 'file.hasTag("ready-for-codex")'
    - 'file.hasTag("codex-queue")'

properties:
  file.name:
    displayName: Item
  status:
    displayName: Status
  related:
    displayName: Related

views:
  - type: table
    name: "Codex Queue"
    order:
      - file.name
      - status
      - related
      - updated
      - file.path
""",
}


def resolve_vault_path(raw_path: str | None) -> Path:
    if raw_path:
        return Path(raw_path).expanduser()
    active_vault = detect_active_vault()
    if active_vault is None:
        raise RuntimeError("Could not detect an active Obsidian vault. Pass --vault explicitly.")
    return active_vault


def build_payload(vault_path: Path) -> dict:
    return {
        "vault_path": str(vault_path),
        "dashboards": [
            {
                "path": path,
                "content": content,
            }
            for path, content in DASHBOARDS.items()
        ],
    }


def apply_dashboards(vault_path: Path) -> list[str]:
    written: list[str] = []
    for relative_path, content in DASHBOARDS.items():
        write_note_content(vault_path, relative_path, content)
        written.append(relative_path)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description="Render or install obs-wiki Obsidian Bases dashboards into a vault.")
    parser.add_argument("--vault", help="Explicit Obsidian vault path. Defaults to the active Obsidian vault.")
    parser.add_argument("--apply", action="store_true", help="Write the dashboard .base files into the vault.")
    parser.add_argument("--json", action="store_true", help="Emit the dashboard payload as JSON.")
    args = parser.parse_args()

    vault_path = resolve_vault_path(args.vault)
    payload = build_payload(vault_path)
    payload["applied"] = args.apply
    payload["written_paths"] = apply_dashboards(vault_path) if args.apply else []

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault_path']}")
        print(f"dashboards: {len(payload['dashboards'])}")
        print(f"applied: {payload['applied']}")
        if payload["written_paths"]:
            print("written_paths:")
            for path in payload["written_paths"]:
                print(f"- {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
