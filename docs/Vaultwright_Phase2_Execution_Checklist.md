# Vaultwright Phase 2 Execution Checklist

Version: 2026-05-10
Status: active checklist for the next Codex execution pass

## Scope

Advance Vaultwright toward MCP-first AI conversation and CLI-first deterministic execution without implementing a complete MCP server or replacing the Python runtime.

## Checklist

- [x] Confirm the current branch and git status before editing.
- [x] Confirm `docs/Vaultwright_Phase2_MCP_CLI_Performance_Plan.md` exists.
- [x] Confirm current package paths use `plugins/vaultwright`, `skills/vaultwright-*`, and `~/.codex/plugins/vaultwright`.
- [x] Scan for stale legacy plugin and skill references.
- [x] Fix dev install coverage so `install_local_runtime.py` includes:
  - `vaultwright-init`
  - `vaultwright-ingest`
  - `vaultwright-query`
  - `vaultwright-lint`
  - `vaultwright-refine`
- [x] Add the MCP/CLI architecture section to the English README.
- [x] Add the MCP/CLI architecture section to the Chinese README.
- [x] Add an MCP adapter design document.
- [x] Add a runtime performance evaluation document.
- [x] Add benchmark implementation scaffold.
- [x] Implement the read-only MCP Adapter MVP.
- [ ] Implement a write-capable or complete MCP server.
- [ ] Rewrite the Python runtime.
- [ ] Introduce heavy new dependencies.
- [ ] Create an external raw/wiki knowledge system.
- [ ] Modify a real user Obsidian vault as part of repository maintenance.

## Verification Checklist

- [x] Run `python3 scripts/benchmark_runtime.py --fixture-notes 20 --runs 1 --json`.
- [x] Run `python3 scripts/check_codex_plugin.py --json`.
- [x] Run `python3 scripts/sync_plugin_package.py`.
- [x] Run `python3 scripts/check_codex_plugin.py --json` again.
- [x] Run `python3 scripts/smoke_mcp_adapter.py`.
- [x] Run a stale-name scan for old plugin and skill names.
- [x] Run `git diff --check`.
- [x] Produce a final acceptance report with branch, status, files changed, validation, risks, and next steps.

## Acceptance Notes

- Write-capable MCP server implementation remains out of scope until the adapter contract is reviewed.
- Benchmark implementation is planned but not required in this pass.
- Python remains the default runtime until benchmark data proves a different core is needed.
- MCP adapter work must call Vaultwright CLI/scripts or shared runtime instead of copying knowledge processing logic.
