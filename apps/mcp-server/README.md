# obs-wiki MCP Server

MCP server for obs-wiki operations. It is read-only by default and exposes controlled write tooling only for low-risk working records.

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
- `obs_wiki.list_approved_writebacks`
- `obs_wiki.audit_recent`
- `obs_wiki.write_context_pack`
- `obs_wiki.build_context_pack`
- `obs_wiki.lint`
- `obs_wiki.finish_task`
- `obs_wiki.distill_session`
- `obs_wiki.write_session_note`
- `obs_wiki.capture_source`
- `obs_wiki.propose_memory`
- `obs_wiki.analyze_source_request`
- `obs_wiki.apply_approved_writeback`

Permission policy:

- default posture: read-only vault-local access
- controlled write tools are limited to low-risk working records
- protected memory writeback is review-gated and only runs through approved Review Queue proposals
- full matrix: [../../docs/MCP_Tool_Permission_Matrix.md](../../docs/MCP_Tool_Permission_Matrix.md)

Current write allowlist:

- Writes are strictly limited to:
  - `06_outputs/context_packs/`
  - `06_outputs/source_analysis/`
  - `02_timeline/sessions/`
  - `03_sources/`
  - `01_inbox/review_queue/`
  - `01_inbox/agent_requests/` request status updates
  - `00_control/audit_log.md`
  - existing target note named by an approved `apply_approved_writeback` proposal
- only markdown (`.md`) files are created for generated records
- generated records do not overwrite existing files
- approved writeback appends to an existing target note and updates the approved proposal status
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
- apply_approved_writeback review-gated flow

## Notes

- `read_note` accepts `{ vaultRoot, path }` and validates vault scope + path traversal.
- `start_task` returns `task_id` plus a context pack summary without writing files.
- `audit_recent` parses `00_control/audit_log.md` and returns sectionized entries.
