# obs-wiki MCP Server (Phase 7 Read-only)

Minimal stdio MCP server for read-only obs-wiki operations.

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
- `obs_wiki.audit_recent`

All tools are read-only:

- no writes
- no shell calls
- no network calls
- no vault-outside reads
- no `.obsidian` reads

## Run

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki/apps/mcp-server
npm install --cache /private/tmp/obs-wiki-npm-cache
npm run typecheck
npm run build
node dist/server.js --vault-root /path/to/vault
```

Then send one JSON object per line over stdin (JSON-RPC 2.0).

## Package scripts

```bash
npm run typecheck
npm run build
```

## Notes

- `read_note` accepts `{ vaultRoot, path }` and validates vault scope + path traversal.
- `start_task` returns `task_id` plus a context pack summary without writing files.
- `audit_recent` parses `00_control/audit_log.md` and returns sectionized entries.
