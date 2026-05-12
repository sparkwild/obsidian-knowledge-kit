#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obs_wiki_shared.mcp_adapter import AdapterConfig, StdioMcpServer, ObsWikiMcpAdapter


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the obs-wiki read-only MCP adapter over stdio.")
    parser.add_argument(
        "--vault",
        help="Optional Obsidian vault path to bind the adapter to. Defaults to the active Obsidian vault.",
    )
    args = parser.parse_args()

    config = AdapterConfig(vault_path=Path(args.vault).expanduser() if args.vault else None)
    return StdioMcpServer(ObsWikiMcpAdapter(config)).run()


if __name__ == "__main__":
    raise SystemExit(main())
