# obs-wiki MCP Server (Phase 8 Controlled Write)

MCP server for obs-wiki operations with controlled write tooling for low-risk working records.

## JSON-RPC methods

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `prompts/list`

## Tools

`tools/list` returns:

- `obs_wiki.status`
- `obs_wiki.start_task`
- `obs_wiki.recall`
- `obs_wiki.read_note`
- `obs_wiki.list_review_queue`
- `obs_wiki.list_source_requests`
- `obs_wiki.audit_recent`
- `obs_wiki.write_context_pack`
- `obs_wiki.write_session_note`
- `obs_wiki.capture_source`
- `obs_wiki.propose_memory`
- `obs_wiki.analyze_source_request`

Write policy:

- Writes are strictly limited to:
  - `06_outputs/context_packs/`
  - `02_timeline/sessions/`
  - `03_sources/`
  - `01_inbox/review_queue/`
- only markdown (`.md`) files are created
- no overwrite of existing files
- no delete / no rename

Security constraints:

- no shell calls
- no network calls
- no vault-outside reads
- no `.obsidian` reads
- all writes append events to `00_control/audit_log.md` (file is created if absent)

## Run

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki/apps/mcp-server
npm install --cache /private/tmp/obs-wiki-npm-cache
npm run typecheck
npm run build
npm run test
node dist/server.js --vault-root /path/to/vault
```

Then send one JSON object per line over stdin (JSON-RPC 2.0).

## Package scripts

```bash
npm run typecheck
npm run build
npm run test
npm run smoke
```

`npm run test`/`npm run smoke` executes `./scripts/smoke_phase10.mjs` against a temporary, non-network vault fixture and validates:

- initialize/tools/list/resources/list/prompts/list
- read_note and status paths
- controlled write tools
- analyze_source_request source-analysis flow

## Notes

- `read_note` accepts `{ vaultRoot, path }` and validates vault scope + path traversal.
- `start_task` returns `task_id` plus a context pack summary without writing files.
- `audit_recent` parses `00_control/audit_log.md` and returns sectionized entries.
