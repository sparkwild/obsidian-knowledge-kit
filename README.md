# obs-wiki

[简体中文说明](./README.zh-CN.md)

obs-wiki is an Obsidian-native plugin direction for turning an Obsidian vault into an external memory and knowledge layer for AI agents.

The current product direction is being reset from the older Codex plugin-first workflow to an Obsidian plugin-first and Agent memory-first architecture. The Obsidian plugin is the user's review, audit, permission, and source-analysis interface. MCP is the primary interface for agents. The vault remains the only source of truth for durable memory and knowledge.

## Current Direction

- Product name: `obs-wiki`.
- Plugin id: `obs-wiki`.
- Main product surface: Obsidian native plugin.
- Agent interface: MCP tools, resources, and prompts.
- Memory carrier: Obsidian vault notes, Properties, wikilinks, block references, review queues, and audit logs.
- Runtime role: indexing, recall, context packs, lint previews, source analysis, writeback planning, permission checks, and audit event generation.

This repository still contains the previous Codex local plugin package and Python runtime. Treat that code as legacy reference while the new Obsidian-native product line is built. It is currently retained as an archive candidate for migration rollback.

Current migration decision: see [docs/obs_wiki_new_start_plan/11_Migration_Decision.md](./docs/obs_wiki_new_start_plan/11_Migration_Decision.md).

## Phase 10 Verification

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki

npm run --prefix packages/core typecheck
npm run --prefix packages/core build
npm run --prefix packages/core test

npm run --prefix apps/mcp-server typecheck
npm run --prefix apps/mcp-server build
npm run --prefix apps/mcp-server smoke
npm run --prefix apps/mcp-server test

npm run --prefix apps/obsidian-plugin typecheck
npm run --prefix apps/obsidian-plugin build
npm run --prefix apps/obsidian-plugin package
```

or:

```bash
./scripts/verify_phase10.sh
```

## Product Principles

- Agent-first: agents should actively recall context, history, preferences, and source material while working.
- Obsidian-native: the vault is the knowledge body; caches and indexes are acceleration layers only.
- Review-first: agents may propose long-term memory, but high-risk memory should not be silently committed.
- Evidence-first: important claims should trace back to sources, evidence blocks, and review state.
- Audit-first: critical agent reads and writes should be visible and reviewable in Obsidian.
- MCP-first for agent access: expose memory semantics, not arbitrary filesystem operations.
- Plugin-first for user supervision: Obsidian is the UI for review, audit, permissions, and source queues.

## Target Architecture

```text
Agent / AI Client
Codex / Claude / Cursor / ChatGPT / Local Agent
        ↓ MCP
obs-wiki MCP Server
        ↓
obs-wiki Memory Runtime
        ↓
obs-wiki Obsidian Plugin Bridge
        ↓
Obsidian Vault
        ↓
Human Review / Audit / Correction in Obsidian App
```

## Planned Repository Layout

```text
obs-wiki/
├─ apps/
│  ├─ obsidian-plugin/
│  ├─ mcp-server/
│  └─ cli/
├─ packages/
│  ├─ core/
│  ├─ schemas/
│  └─ shared/
├─ docs/
├─ tests/
└─ package.json
```

## First Implementation Track

The first implementation track follows [docs/obs_wiki_new_start_plan](./docs/obs_wiki_new_start_plan/00_README.md):

1. Direction reset and documentation landing.
2. Obsidian plugin scaffold in `apps/obsidian-plugin/`.
3. Vault memory structure initialization.
4. Agent Activity and Audit UI.
5. Review Queue.
6. Source Analysis Request.
7. Memory Runtime v0.
8. Read-only MCP server MVP.

The first coding milestone is a buildable Obsidian plugin scaffold with:

- `manifest.json` using id `obs-wiki`.
- TypeScript project configuration.
- `main.ts`.
- Ribbon icon.
- command palette entries.
- settings tab with persistent settings.
- basic ItemView.

## New Direction Docs

- [Plan package README](./docs/obs_wiki_new_start_plan/00_README.md)
- [Product Vision](./docs/obs_wiki_new_start_plan/01_Product_Vision.md)
- [System Architecture](./docs/obs_wiki_new_start_plan/02_System_Architecture.md)
- [Knowledge and Memory Model](./docs/obs_wiki_new_start_plan/03_Knowledge_And_Memory_Model.md)
- [Obsidian Plugin Design](./docs/obs_wiki_new_start_plan/04_Obsidian_Plugin_Design.md)
- [Agent Memory API](./docs/obs_wiki_new_start_plan/05_Agent_Memory_API.md)
- [Runtime and MCP Design](./docs/obs_wiki_new_start_plan/06_Runtime_And_MCP_Design.md)
- [Phased Execution Plan](./docs/obs_wiki_new_start_plan/07_Phased_Execution_Plan.md)
- [Codex Task Prompts](./docs/obs_wiki_new_start_plan/08_Codex_Task_Prompts.md)
- [Acceptance Checklists](./docs/obs_wiki_new_start_plan/09_Acceptance_Checklists.md)
- [Open Questions](./docs/obs_wiki_new_start_plan/10_Open_Questions.md)
- [Migration Decision](./docs/obs_wiki_new_start_plan/11_Migration_Decision.md)
- [Implementation Manifest](./docs/obs_wiki_new_start_plan/IMPLEMENTATION_MANIFEST.json)

## Legacy Reference

Existing `skills/`, `plugins/obs-wiki/`, `lib/obs_wiki_shared/`, and `scripts/` files belong to the previous Codex plugin-first implementation. They are useful references for context packs, lint, evidence scaffolding, MCP boundaries, and vault-only rules, but they are not the new product's primary user interface.

Until the migration decision is made:

- Do not remove legacy code by default.
- Do not optimize old skills or commands as the main product path.
- Do not write to a real Obsidian vault unless a task explicitly asks for it.
- Keep new Obsidian-native work under `apps/` and `packages/`.

## License

This project is licensed under the [MIT License](./LICENSE).
