# MCP Tool Permission Matrix

This matrix defines the current MCP boundary for the Agent-first obs-wiki runtime.

Runtime policy:

- `obs-wiki` MCP is **read-only by default**.
- A small set of **bounded write tools** is allowed for working records.
- **review-gated apply** tools can only mutate protected memory via approved proposals.
- All writes are vault-local and auditable, and all client-facing writes return `audit_path`.

The MCP initialize instructions are:

`read-only-by-default + controlled write + review-gated apply`

## Permission Levels

| Level | Meaning | Runtime rule |
| --- | --- | --- |
| `read-only` | Reads or derives vault-local information without creating, updating, deleting, renaming, or moving files. | May read allowed vault paths only. Must reject vault-outside and `.obsidian` access. |
| `low-risk write` | Creates or updates bounded working records that do not directly mutate approved long-term memory. | May write only to allowlisted vault paths. Must audit writes. Must not delete, rename, or overwrite existing notes unless the tool explicitly says so. |
| `review-gated apply` | Applies a user-approved proposal to protected memory or project decision notes. | Requires an approved Review Queue item and an audit event. Runtime executes the writeback, not the Obsidian plugin command surface. |
| `forbidden` | Actions outside the obs-wiki Agent-first boundary. | Must not be exposed as MCP tools. |

## Audit event schema

### MCP Initialize connection event

- `type: connection`
- `event: connection`
- `agent_id`
- `client_name`
- `transport`
- `runtime_version`
- `timestamp`

### Tool-call event

- `type: tool-call`
- `event: tool-call`
- `tool_name`
- `result_status` (`success` / `failed`)
- `target_paths`
- `duration_ms`
- `risk_level`
- `agent_id`
- `client_name`
- `transport`
- `runtime_version`
- `timestamp`

`args_summary` is included and must mask sensitive keys or values.

## Current Tool Matrix

| Tool | Permission level | Side effects | Allowed paths | Review requirement |
| --- | --- | --- | --- | --- |
| `obs_wiki.status` | `read-only` | None. Scans vault summary counts. | Allowed vault-local note paths only. | None. |
| `obs_wiki.start_task` | `read-only` | None. Returns a deterministic task id and context summary. | Allowed vault-local note paths only. | None. |
| `obs_wiki.recall` | `read-only` | None. Returns matching note summaries. | Allowed vault-local note paths only. | None. |
| `obs_wiki.read_note` | `read-only` | None. Reads one markdown/text note. | Allowed vault-local note paths only. | None. |
| `obs_wiki.list_review_queue` | `read-only` | None. Reads pending proposal notes. | `01_inbox/review_queue/`. | None. |
| `obs_wiki.list_source_requests` | `read-only` | None. Reads pending source-analysis requests. | `01_inbox/agent_requests/`. | None. |
| `obs_wiki.list_approved_writebacks` | `read-only` | None. Reads approved proposal writeback candidates. | `01_inbox/review_queue/`. | None. |
| `obs_wiki.audit_recent` | `read-only` | None. Reads parsed audit sections. | `00_control/audit_log.md`. | None. |
| `obs_wiki.write_context_pack` | `low-risk write` | Creates a context-pack note and audit entry. | `06_outputs/context_packs/`, `00_control/audit_log.md`. | None, because it is a working output, not protected memory. |
| `obs_wiki.build_context_pack` | `read-only` (optional write mode) | Reads scan + returns context pack summary; when `write=true` creates a markdown artifact and audit entry. | `06_outputs/context_packs/`, `00_control/audit_log.md` (write mode only). | None. |
| `obs_wiki.lint` | `read-only` | Reads vault notes and returns issue list plus fix-plan summary. | `00_control/audit_log.md` not touched; reads other allowed vault note locations only. | None. |
| `obs_wiki.write_session_note` | `low-risk write` | Creates a session note and audit entry. | `02_timeline/sessions/`, `00_control/audit_log.md`. | None, because it is a session record. |
| `obs_wiki.finish_task` | `low-risk write` | Creates a session finish note and audit entry. | `02_timeline/sessions/`, `00_control/audit_log.md`. | None. |
| `obs_wiki.distill_session` | `low-risk write` | Creates a distill session note, creates memory proposals for decisions/preferences, and writes audit entries. | `02_timeline/sessions/`, `01_inbox/review_queue/`, `00_control/audit_log.md`. | Proposal creation is review-gated later; direct long-term memory targets are not written. |
| `obs_wiki.capture_source` | `low-risk write` | Creates a source note and audit entry. | `03_sources/`, `00_control/audit_log.md`. | None for source capture. Derived long-term claims still require proposals. |
| `obs_wiki.propose_memory` | `low-risk write` | Creates a Review Queue proposal and audit entry. | `01_inbox/review_queue/`, `00_control/audit_log.md`. | The proposal itself is created without review; applying it requires review. |
| `obs_wiki.analyze_source_request` | `low-risk write` | Writes source note, analysis output, review proposals, request status, and audit entry. | `03_sources/`, `06_outputs/source_analysis/`, `01_inbox/review_queue/`, `01_inbox/agent_requests/`, `00_control/audit_log.md`. | Generated memory claims remain proposals until reviewed. |
| `obs_wiki.apply_approved_writeback` | `review-gated apply` | Appends explicit approved writeback content to an existing target note, updates proposal status to `applied`, and writes an audit entry. | Existing target note named by `target_note`, source proposal under `01_inbox/review_queue/`, `00_control/audit_log.md`. | Requires `approval_status=approved` or `status=approved`, explicit `## Writeback` content, and a valid target note. |

All write tools above must return `audit_path` in successful responses where a write action occurs.

## Forbidden Actions

The MCP server must not expose tools for:

- Arbitrary shell execution, package installation, or process control.
- Arbitrary network fetches outside an explicit future source-ingest policy.
- Reading or writing outside the configured vault root.
- Reading or writing `.obsidian/`.
- Deleting, renaming, moving, or bulk rewriting vault notes.
- Directly committing long-term memory, user preferences, important project decisions, high-confidence claims, delete/archive decisions, or bulk migrations without Review Queue approval.
- Reintroducing Obsidian plugin command entries for Analyze URL, Analyze Local File, Capture Source, Build Context Pack, Run Lint, Run Distill, or other maintenance actions that must start from the Agent.
