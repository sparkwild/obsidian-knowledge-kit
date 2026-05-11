# Vaultwright

[简体中文说明](./README.zh-CN.md)

Vaultwright is a Codex-native steward for Obsidian vaults. It helps initialize a vault, ingest external materials, query targeted context, refine existing knowledge, and keep the knowledge base structured, traceable, and maintainable.

For active-vault operations, Vaultwright now prefers Obsidian CLI-backed reads and writes through a shared runtime layer, using direct filesystem I/O only as a fallback when the target vault is not the active vault or the CLI cannot satisfy the operation.

Project note:

- The product-facing name is `Vaultwright`.
- The internal package, plugin name, and install path now also use `vaultwright`.
- This repository is a Codex local plugin package and runtime, not an Obsidian community plugin.
- The active Obsidian vault is the only knowledge carrier; Vaultwright does not create a second raw/wiki system outside the vault.

## MCP-first for AI conversation, CLI-first for execution

Vaultwright separates AI-facing conversation entrypoints from deterministic local execution:

```text
AI conversation tools
-> Vaultwright MCP adapter
-> Vaultwright CLI / shared runtime
-> Active Obsidian vault

Local Codex execution
-> Vaultwright CLI / scripts
-> Active Obsidian vault
```

MCP is the preferred interface for AI conversation tools because it can expose Vaultwright tools, resources, and prompts in a structured way. The MCP adapter should stay thin: it must call the Vaultwright CLI/scripts or shared runtime instead of bypassing the runtime or inventing a second knowledge-processing layer.

The CLI remains the deterministic execution layer. It continues to own active vault detection, context packs, lint, ingest, distill, dashboards, reports, and other stable local tasks. MCP is an optional enhancement layer for AI clients, not a hard dependency for the core runtime. The current MVP is a read-only stdio MCP adapter that delegates to the Vaultwright shared runtime.

## Repository Layout

```text
vaultwright/
├─ skills/
│  ├─ vaultwright-init/
│  ├─ vaultwright-ingest/
│  ├─ vaultwright-query/
│  ├─ vaultwright-lint/
│  └─ vaultwright-refine/
├─ plugins/
│  └─ vaultwright/
│     ├─ .codex-plugin/plugin.json
│     ├─ agents/
│     ├─ assets/
│     ├─ commands/
│     ├─ lib/
│     └─ skills/
└─ lib/
   └─ obsidian_knowledge_shared/
```

## Components

- `vaultwright-init`: bootstrap the minimum codex-native vault skeleton.
- `vaultwright-ingest`: bring external materials into `03_raw/` and distill them into stable notes.
- `vaultwright-query`: build an Obsidian-native context pack before answering knowledge questions.
- `vaultwright-lint`: inspect vault content quality, sources, links, and stale knowledge without auto-fixing by default.
- `vaultwright-refine`: improve structure, links, boundaries, and status notes in an initialized vault.
- `plugins/vaultwright`: repo-local Codex plugin package with `.codex-plugin/plugin.json`.
- `lib/obsidian_knowledge_shared`: shared preflight, official skill update checks, and bootstrap note rendering.

Web ingest policy:

- Prefer lightweight URL extraction first.
- When websites block automated fetching, use `Computer Use` as a manual browser fallback.
- If `Computer Use` is unavailable or missing permission on the user's machine, do not install or enable it automatically; ask the user to do that explicitly.

## Current Status

- Repository migration completed from the earlier workspace prototype.
- Shared runtime is no longer exposed as a fourth skill.
- Plugin direction has been corrected to a Codex plugin package, not an Obsidian community plugin.
- The current evolution target is Vaultwright Phase 1 and Phase 2: branding plus query/context-pack workflows.
- The current architecture target is MCP-first for AI conversation and CLI-first for deterministic execution.
- The next implementation layer is an optional MCP adapter, after the CLI/runtime contract is stable.

## Project Docs

- [Chinese README](./README.zh-CN.md)
- [Codex Task Brief](./docs/Vaultwright_Codex_Task_Brief.md)
- [Phase 2 MCP/CLI Performance Plan](./docs/Vaultwright_Phase2_MCP_CLI_Performance_Plan.md)
- [MCP Adapter Design](./docs/Vaultwright_MCP_Adapter_Design.md)
- [Runtime Performance Evaluation](./docs/Vaultwright_Runtime_Performance_Evaluation.md)
- [Phase 2 Execution Checklist](./docs/Vaultwright_Phase2_Execution_Checklist.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## Development Install

Use the local installer to expose this repo to Codex without copying files by hand:

```bash
python3 scripts/install_local_runtime.py
```

By default it symlinks:

- `skills/vaultwright-init`
- `skills/vaultwright-ingest`
- `skills/vaultwright-query`
- `skills/vaultwright-lint`
- `skills/vaultwright-refine`
- `lib/obsidian_knowledge_shared`

into `~/.codex` or the path from `CODEX_HOME`.

## Codex Plugin

This repository now exposes a repo-local Codex plugin package at:

```text
plugins/vaultwright/.codex-plugin/plugin.json
```

Current plugin scope:

- expose the main knowledge skills, including targeted query/context-pack retrieval, to Codex as a local plugin
- expose a query workflow that writes Obsidian-native context packs into the active vault
- expose a setup command for installing the global AGENTS knowledge hint
- expose command entrypoints for startup and distill loops
- expose a doctor command for environment checks
- ship a self-contained plugin package so Codex cache installs do not depend on external symlinks
- install into the home-local Codex plugin marketplace for actual daily use

Validate the repo-local plugin package:

```bash
python3 scripts/check_codex_plugin.py --json
```

Sync the plugin package after root `skills/` or `lib/` changes:

```bash
python3 scripts/sync_plugin_package.py
```

Install the plugin into the home-local Codex marketplace:

```bash
python3 scripts/install_home_local_plugin.py --json
```

This installs the plugin under the standard hidden personal path:

- `~/.codex/plugins/vaultwright`
- `~/.agents/plugins/marketplace.json`

Check or install the minimal global knowledge hint in `~/.codex/AGENTS.md`:

```bash
python3 scripts/install_global_knowledge_hint.py --json
python3 scripts/install_global_knowledge_hint.py --apply --json
```

Load the current knowledge context:

```bash
python3 scripts/load_knowledge_context.py --json
```

Create a distill session skeleton:

```bash
python3 scripts/render_session_skeleton.py --apply --json
```

Build a query-focused context pack:

```bash
python3 scripts/build_context_pack.py "What should I read before answering this knowledge question?" --json
```

Run a knowledge lint pass:

```bash
python3 scripts/lint_knowledge_vault.py --json
```

Run a synthetic runtime benchmark without touching a real vault:

```bash
python3 scripts/benchmark_runtime.py --fixture-notes 100 --runs 1 --json
```

Run the read-only MCP adapter over stdio:

```bash
python3 scripts/mcp_adapter.py
```

For offline smoke testing against a generated temporary vault:

```bash
python3 scripts/smoke_mcp_adapter.py
```

MVP tools:

- `vaultwright_status`
- `vaultwright_query`
- `vaultwright_lint`
- `vaultwright_read_note`
- `vaultwright_review_queue`

Render Obsidian Bases dashboards:

```bash
python3 scripts/render_bases_dashboards.py --json
python3 scripts/render_bases_dashboards.py --apply --json
```

The ingest register model now includes evidence-ready fields such as `source_id`, `source_hash`, `snapshot_path`, `verification_status`, `claim_count`, and `synthesis_targets`, plus scaffolded evidence/claim blocks for later query and lint workflows. Lint now also checks claim-count drift and warns when stable knowledge only points to note-level sources instead of block-level evidence.

After downstream notes cite a raw/source register, you can reconcile its state with:

```bash
python3 scripts/reconcile_source_register.py "03_raw/registers/<register>.md" --json
```

Dashboard files are written into `00_system/dashboards/` inside the active vault and can be opened directly in Obsidian Bases.

Expected workflow:

1. Open this repository in Codex.
2. Install the plugin into `~/.codex/plugins/vaultwright` and `~/.agents/plugins/marketplace.json`.
3. If the plugin does not appear immediately, reopen the repository or restart Codex.

The reopen/restart step is an operational fallback inferred from the local plugin packaging model and local plugin examples.
