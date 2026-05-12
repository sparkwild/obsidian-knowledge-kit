#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run() {
  local dir="$1"
  local script="$2"
  printf '\n>>> %s: npm run %s\n' "$dir" "$script"
  (cd "$dir" && npm run "$script")
}

run "$ROOT/packages/core" typecheck
run "$ROOT/packages/core" build
run "$ROOT/packages/core" test

run "$ROOT/apps/mcp-server" typecheck
run "$ROOT/apps/mcp-server" build
run "$ROOT/apps/mcp-server" smoke
run "$ROOT/apps/mcp-server" test

run "$ROOT/apps/obsidian-plugin" typecheck
run "$ROOT/apps/obsidian-plugin" build
run "$ROOT/apps/obsidian-plugin" package

printf '\nPhase 10 verification finished.\n'
