# Wiki Weaver MCP Server

MCP server for Wiki Weaver operations. It is read-only by default and exposes controlled write tooling only for low-risk working records.

## JSON-RPC methods

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `prompts/list`

## Tools

`tools/list` returns:

- `wiki_weaver.status`
- `wiki_weaver.start_task`
- `wiki_weaver.recall`
- `wiki_weaver.read_note`
- `wiki_weaver.list_review_queue`
- `wiki_weaver.list_source_requests`
- `wiki_weaver.list_approved_writebacks`
- `wiki_weaver.audit_recent`
- `wiki_weaver.write_context_pack`
- `wiki_weaver.build_context_pack`
- `wiki_weaver.lint`
- `wiki_weaver.finish_task`
- `wiki_weaver.distill_session`
- `wiki_weaver.write_session_note`
- `wiki_weaver.capture_source`
- `wiki_weaver.propose_memory`
- `wiki_weaver.analyze_source_request`
- `wiki_weaver.apply_approved_writeback`

Permission policy:

- default posture: read-only vault-local access
- controlled write tools are limited to low-risk working records
- protected memory writeback is review-gated and only runs through approved Review Queue proposals
- full matrix: [../../docs/MCP.md](../../docs/MCP.md)

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
cd <repo>/apps/mcp-server
npm install --cache /private/tmp/wiki-weaver-npm-cache
npm run typecheck
npm run build
npm run test
node dist/server.js --vault-root <vault>
```

Then send one JSON object per line over stdin (JSON-RPC 2.0).

## Package scripts

```bash
npm run typecheck
npm run build
npm run test
npm run smoke
```

`npm run test`/`npm run smoke` executes `./scripts/smoke.mjs` against a temporary, non-network vault fixture and validates:

- initialize/tools/list/resources/list/prompts/list
- read_note and status paths
- controlled write tools
- analyze_source_request source-analysis flow
- apply_approved_writeback review-gated flow

## Notes

- `read_note` accepts `{ vaultRoot, path }` and validates vault scope + path traversal.
- `start_task` returns `task_id` plus a context pack summary without writing files.
- `audit_recent` parses `00_control/audit_log.md` and returns sectionized entries.
