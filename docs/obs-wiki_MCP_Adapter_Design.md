# obs-wiki MCP Adapter Design

Version: 2026-05-11
Status: MVP implemented
Scope: read-only stdio MCP adapter. This document does not approve write-capable MCP tools.

## Purpose

obs-wiki should be easy for AI conversation tools to discover and call, while local execution remains deterministic and testable.

```text
AI conversation tools
-> obs-wiki MCP adapter
-> obs-wiki CLI / shared runtime
-> Active Obsidian vault

Local Codex execution
-> obs-wiki CLI / scripts
-> Active Obsidian vault
```

## Design Principles

- MCP-first for AI conversation.
- CLI-first for execution.
- The active Obsidian vault is the only knowledge carrier.
- Do not create an external raw/wiki system outside the vault.
- Read-only by default.
- Write actions require explicit confirmation or an allowlist.
- MCP tools must expose high-level obs-wiki semantics, not arbitrary shell access.
- MCP adapter logic should call existing obs-wiki CLI/scripts or shared runtime instead of duplicating knowledge-processing logic.

## MCP Tools Draft

The implemented MVP exposes these canonical tool names:

- `obs_wiki_status`
- `obs_wiki_query`
- `obs_wiki_lint`
- `obs_wiki_read_note`
- `obs_wiki_review_queue`

They are read-only and delegate to obs-wiki shared runtime functions. They do not write context pack notes, lint report notes, stable knowledge, raw sources, secrets, or external raw/wiki systems.

### `obs_wiki_get_status`

Purpose: report active vault and runtime readiness.

Inputs:

- optional `include_recent_reports`: boolean

Outputs:

- active vault name and path when detected
- core note availability
- plugin/runtime check summary
- latest context pack and lint report pointers when available
- status and warnings

Behavior:

- Read-only.
- May call `check_codex_plugin.py`, context loader, or status-oriented runtime functions.
- Must not write to the vault.

### `obs_wiki_build_context_pack`

Purpose: build a focused context pack for a user question.

Inputs:

- `query`: string
- optional `candidate_limit`: number
- optional `read_limit`: number
- optional `write`: boolean, default false

Outputs:

- context pack summary
- candidate notes
- source candidates
- knowledge gaps
- suggested writeback target
- written path only when `write` is explicitly allowed

Behavior:

- Calls `scripts/build_context_pack.py` or shared context pack runtime.
- Defaults to preview/read-only.
- If write is enabled, writes only under `01_ai_core/context_packs/`.

### `obs_wiki_query_vault`

Purpose: answer an AI conversation query using obs-wiki context discovery.

Inputs:

- `query`: string
- optional `context_pack_path`: string
- optional `max_notes`: number

Outputs:

- selected notes
- source/evidence references
- answer scaffold or retrieval result
- uncertainty and knowledge gaps

Behavior:

- Should build or reuse a context pack before reading candidate notes.
- Must not full-read the vault by default.
- Must not write stable conclusions without explicit write workflow.
- MVP implementation name: `obs_wiki_query`.

### `obs_wiki_lint_vault`

Purpose: run or retrieve vault content health checks.

Inputs:

- optional `stale_days`: number
- optional `session_limit`: number
- optional `write_report`: boolean, default false

Outputs:

- summary counts by severity
- issue list
- touched areas
- suggested next command
- written report path only when explicitly requested

Behavior:

- Calls `scripts/lint_knowledge_vault.py` or shared lint runtime.
- Defaults to read-only.
- If report write is enabled, writes only under `00_system/reports/`.
- MVP implementation name: `obs_wiki_lint`; report writes are not enabled in the MVP.

### `obs_wiki_list_review_queue`

Purpose: list pending review work for AI conversation planning.

Inputs:

- optional `queue`: `all`, `raw`, `claims`, `gaps`, `stale`, or `lint`
- optional `limit`: number

Outputs:

- pending raw/register sources
- unverified claims
- knowledge gaps
- stale concepts
- latest lint report summary

Behavior:

- Read-only.
- Uses existing reports, dashboards, indexes, or runtime scans.
- MVP implementation name: `obs_wiki_review_queue`.

### `obs_wiki_read_note`

Purpose: read one bounded Markdown note from the bound active vault.

Inputs:

- `path`: vault-relative note path or `obs-wiki://note/{path}` resource URI.
- optional `max_chars`: maximum returned characters.

Outputs:

- note path
- MIME type
- bounded text
- truncation status

Behavior:

- Read-only.
- Refuses absolute paths, parent traversal, `.obsidian/`, and `.trash/`.
- Reads only through the bound active vault or the explicit vault path used when launching the adapter.

### `obs_wiki_ingest_source`

Purpose: prepare or apply ingestion of a user-provided source.

Inputs:

- `source`: file path, directory path, or URL
- optional `mode`: `preview` or `apply`, default `preview`
- optional `storage_policy`: `external_reference`, `extracted_snapshot`, or `local_copy`

Outputs:

- source kind
- proposed raw/register path
- capture/extraction status
- warnings and next steps
- written paths only in apply mode

Behavior:

- Calls existing ingest preparation scripts or shared runtime.
- Preview is read-only.
- Apply may write only under allowed vault paths such as `03_raw/`.
- Must not silently use Computer Use; blocked web ingest requires user involvement.

### `obs_wiki_distill_session`

Purpose: distill an AI conversation or local work session into obs-wiki-controlled notes.

Inputs:

- `summary`: string
- optional `session_path`: string
- optional `apply`: boolean, default false

Outputs:

- session skeleton or update plan
- affected project/status targets
- written paths only when apply is explicitly enabled

Behavior:

- Calls session/distill scripts or shared runtime.
- Must not write stable knowledge without evidence trail.

## MCP Resources Draft

- `obs-wiki://system`: current `00_system/system.md` summary.
- `obs-wiki://active-context`: current active context.
- `obs-wiki://index`: current `00_system/index.md` summary.
- `obs-wiki://context-pack/latest`: latest context pack summary and path.
- `obs-wiki://lint/latest`: latest lint report summary and path.
- `obs-wiki://dashboard/knowledge-inbox`: inbox dashboard summary.
- `obs-wiki://note/{path}`: a single vault note or bounded note excerpt.

Resource rules:

- Resources are read-only.
- Resource reads must stay inside the active vault.
- Long notes should return bounded excerpts plus follow-up handles.
- Do not expose `.obsidian/`, `.trash/`, secrets, tokens, or API keys.

## MCP Prompts Draft

- `obs-wiki Query`: build or reuse a context pack before answering.
- `obs-wiki Ingest`: prepare source ingestion with preview-first behavior.
- `obs-wiki Lint`: inspect knowledge health and propose next actions without auto-fixing.
- `obs-wiki Distill`: turn a session summary into controlled session/log updates.
- `obs-wiki Review Knowledge Gaps`: inspect gaps, candidate notes, and evidence candidates before recommending work.

## Permission Model

- Default mode is read-only.
- Write access is allowed only for whitelisted vault paths such as:
  - `01_ai_core/context_packs/`
  - `00_system/reports/`
  - `02_timeline/sessions/`
  - `03_raw/`
  - approved project/status notes
- Destructive action must require human confirmation.
- MCP must not directly execute arbitrary shell commands.
- MCP must not write API keys, tokens, secrets, credentials, or private environment data into the vault.
- MCP must not bypass lint to write unevidenced conclusions into stable knowledge.
- MCP must not create a vault-external raw/wiki knowledge system.

## Relationship With CLI

The MCP adapter is an external AI interface. The obs-wiki CLI/shared runtime is the execution kernel.

MCP tools should call existing scripts or shared runtime functions:

- status and doctor checks use existing plugin/runtime checks.
- context pack tools use `build_context_pack.py` or `obs_wiki_shared.context_pack`.
- lint tools use `lint_knowledge_vault.py` or `obs_wiki_shared.knowledge_lint`.
- ingest tools use existing ingest preparation and register logic.
- distill tools use existing session/distill scripts.

Do not copy a separate knowledge processing engine into the MCP adapter. The adapter should translate MCP requests into stable obs-wiki operations and return structured, auditable results.

## MVP Entry Points

Run the stdio adapter:

```bash
python3 scripts/mcp_adapter.py
```

Bind it to an explicit vault for offline testing:

```bash
python3 scripts/mcp_adapter.py --vault "/path/to/vault"
```

Run the smoke test against a generated temporary vault:

```bash
python3 scripts/smoke_mcp_adapter.py
```
