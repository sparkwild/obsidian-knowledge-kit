# Vaultwright MCP Adapter Design

Version: 2026-05-10
Status: design draft
Scope: interface and boundary design only. This document does not approve a full MCP server implementation.

## Purpose

Vaultwright should be easy for AI conversation tools to discover and call, while local execution remains deterministic and testable.

```text
AI conversation tools
-> Vaultwright MCP adapter
-> Vaultwright CLI / shared runtime
-> Active Obsidian vault

Local Codex execution
-> Vaultwright CLI / scripts
-> Active Obsidian vault
```

## Design Principles

- MCP-first for AI conversation.
- CLI-first for execution.
- The active Obsidian vault is the only knowledge carrier.
- Do not create an external raw/wiki system outside the vault.
- Read-only by default.
- Write actions require explicit confirmation or an allowlist.
- MCP tools must expose high-level Vaultwright semantics, not arbitrary shell access.
- MCP adapter logic should call existing Vaultwright CLI/scripts or shared runtime instead of duplicating knowledge-processing logic.

## MCP Tools Draft

### `vaultwright_get_status`

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

### `vaultwright_build_context_pack`

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

### `vaultwright_query_vault`

Purpose: answer an AI conversation query using Vaultwright context discovery.

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

### `vaultwright_lint_vault`

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

### `vaultwright_list_review_queue`

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

### `vaultwright_ingest_source`

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

### `vaultwright_distill_session`

Purpose: distill an AI conversation or local work session into Vaultwright-controlled notes.

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

- `vaultwright://system`: current `00_system/system.md` summary.
- `vaultwright://active-context`: current active context.
- `vaultwright://index`: current `00_system/index.md` summary.
- `vaultwright://context-pack/latest`: latest context pack summary and path.
- `vaultwright://lint/latest`: latest lint report summary and path.
- `vaultwright://dashboard/knowledge-inbox`: inbox dashboard summary.
- `vaultwright://note/{path}`: a single vault note or bounded note excerpt.

Resource rules:

- Resources are read-only.
- Resource reads must stay inside the active vault.
- Long notes should return bounded excerpts plus follow-up handles.
- Do not expose `.obsidian/`, `.trash/`, secrets, tokens, or API keys.

## MCP Prompts Draft

- `Vaultwright Query`: build or reuse a context pack before answering.
- `Vaultwright Ingest`: prepare source ingestion with preview-first behavior.
- `Vaultwright Lint`: inspect knowledge health and propose next actions without auto-fixing.
- `Vaultwright Distill`: turn a session summary into controlled session/log updates.
- `Vaultwright Review Knowledge Gaps`: inspect gaps, candidate notes, and evidence candidates before recommending work.

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

The MCP adapter is an external AI interface. The Vaultwright CLI/shared runtime is the execution kernel.

MCP tools should call existing scripts or shared runtime functions:

- status and doctor checks use existing plugin/runtime checks.
- context pack tools use `build_context_pack.py` or `obsidian_knowledge_shared.context_pack`.
- lint tools use `lint_knowledge_vault.py` or `obsidian_knowledge_shared.knowledge_lint`.
- ingest tools use existing ingest preparation and register logic.
- distill tools use existing session/distill scripts.

Do not copy a separate knowledge processing engine into the MCP adapter. The adapter should translate MCP requests into stable Vaultwright operations and return structured, auditable results.
