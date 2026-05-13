# MCP And Permissions

Wiki Weaver MCP is read-only by default and exposes controlled writes only for bounded working records. Long-term memory writeback is review-gated.

## Tool Permission Levels

| Level | Meaning |
| --- | --- |
| `read-only` | Reads vault-scoped notes, queues, indexes, and summaries. |
| `low-risk write` | Writes bounded working records such as context packs, session notes, source records, and proposals. |
| `optional write` | Reads by default and writes only when the caller explicitly requests an artifact. |
| `review-gated apply` | Applies a proposal only after user approval in Review Queue. |
| `forbidden` | Actions outside the Wiki Weaver boundary and not exposed as tools. |

## Current Tools

| Tool | Permission | Notes |
| --- | --- | --- |
| `wiki_weaver.status` | `read-only` | Scans vault summary counts. |
| `wiki_weaver.start_task` | `read-only` | Creates a deterministic task context summary without writing. |
| `wiki_weaver.recall` | `read-only` | Returns matching vault notes for a query. |
| `wiki_weaver.read_note` | `read-only` | Reads one vault-relative note. |
| `wiki_weaver.list_review_queue` | `read-only` | Reads pending proposals. |
| `wiki_weaver.list_source_requests` | `read-only` | Reads pending source-analysis requests. |
| `wiki_weaver.list_approved_writebacks` | `read-only` | Lists approved proposals eligible for writeback. |
| `wiki_weaver.audit_recent` | `read-only` | Reads recent audit entries. |
| `wiki_weaver.lint` | `read-only` | Runs vault checks and returns issues. |
| `wiki_weaver.build_context_pack` | `read-only` / `optional write` | Builds context and optionally writes a context-pack artifact. |
| `wiki_weaver.finish_task` | `low-risk write` | Writes a task session summary. |
| `wiki_weaver.distill_session` | `low-risk write` | Writes a session note and review proposals. |
| `wiki_weaver.write_context_pack` | `low-risk write` | Writes under context pack outputs only. |
| `wiki_weaver.write_session_note` | `low-risk write` | Writes under session notes only. |
| `wiki_weaver.capture_source` | `low-risk write` | Writes source metadata/content under source records. |
| `wiki_weaver.propose_memory` | `low-risk write` | Writes a Review Queue proposal, not durable memory directly. |
| `wiki_weaver.analyze_source_request` | `low-risk write` | Processes an existing source request into records and proposals. |
| `wiki_weaver.apply_approved_writeback` | `review-gated apply` | Applies only approved proposals. |

## Forbidden Actions

The MCP server must not expose tools that:

- run arbitrary shell commands
- read or write files outside the configured vault
- modify Obsidian configuration folders
- delete notes
- bulk rewrite the vault
- silently write protected long-term memory
- bypass Review Queue approval

## Configuration

The default local MCP URL is:

```text
http://127.0.0.1:58437/mcp
```

The legacy SSE URL is `http://127.0.0.1:58437/sse`. Change these only when the local Runtime is configured for a different address or port.

Port `58437` is in the Dynamic/Private range and is selected to avoid common local development service ports.

Use stdio only when a client requires command/args configuration:

```text
wiki-weaver-mcp --vault-root <vault>
```

The `<vault>` value is supplied by the active vault or runtime configuration, not by a repository checkout path.
