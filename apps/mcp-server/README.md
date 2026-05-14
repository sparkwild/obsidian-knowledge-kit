# Tracekeeper MCP Server

Streamable HTTP MCP Runtime for Tracekeeper operations. It is read-only by default and exposes controlled write tooling only for low-risk working records.

## JSON-RPC methods

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `prompts/list`

## Tools

`tools/list` returns:

- `tracekeeper.status`
- `tracekeeper.start_task`
- `tracekeeper.recall`
- `tracekeeper.read_note`
- `tracekeeper.list_review_queue`
- `tracekeeper.list_source_requests`
- `tracekeeper.list_approved_writebacks`
- `tracekeeper.audit_recent`
- `tracekeeper.write_context_pack`
- `tracekeeper.build_context_pack`
- `tracekeeper.lint`
- `tracekeeper.finish_task`
- `tracekeeper.distill_session`
- `tracekeeper.write_session_note`
- `tracekeeper.capture_source`
- `tracekeeper.propose_memory`
- `tracekeeper.analyze_source_request`
- `tracekeeper.apply_approved_writeback`

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

The production Runtime is hosted by the desktop Obsidian plugin. The standalone command is for local development checks only:

```bash
cd <repo>/apps/mcp-server
npm install --cache /private/tmp/tracekeeper-npm-cache
npm run typecheck
npm run build
npm run test
node dist/server.js --vault-root <vault> --port 58437 --token <token>
```

Then send Streamable HTTP JSON-RPC requests to `http://127.0.0.1:58437/mcp?token=<token>`.

## Package scripts

```bash
npm run typecheck
npm run build
npm run test
npm run smoke
```

`npm run test`/`npm run smoke` executes `./scripts/smoke.mjs` against a temporary, non-network vault fixture and validates:

- token, origin, and session enforcement
- initialize/tools/list/resources/list/prompts/list
- read_note and status paths
- controlled write tools
- analyze_source_request source-analysis flow
- apply_approved_writeback review-gated flow

## Notes

- `read_note` accepts `{ vaultRoot, path }` and validates vault scope + path traversal.
- `start_task` returns `task_id` plus a context pack summary without writing files.
- `audit_recent` parses `00_control/audit_log.md` and returns sectionized entries.
