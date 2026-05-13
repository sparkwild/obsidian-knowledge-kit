# obs-wiki

[简体中文说明](./README.zh-CN.md)

obs-wiki is an Agent-first memory system that uses an Obsidian vault as the durable knowledge layer and an Obsidian plugin as the human governance surface.

The current product line is Obsidian-native and Agent-first. Agent clients are the only operation entry for URL/file submission, source analysis, context packs, lint, distill, and memory proposals. The Obsidian plugin is the user's review, audit, permission, status, and approval interface. MCP is the primary interface for agents. The vault remains the only source of truth for durable memory and knowledge.

## Current Direction

- Product name: `obs-wiki`.
- Plugin id: `obs-wiki`.
- Main product surface: Agent operation entry plus Obsidian governance plugin.
- Agent interface: MCP tools, resources, and prompts.
- Memory carrier: Obsidian vault notes, Properties, wikilinks, block references, review queues, and audit logs.
- Runtime role: indexing, recall, context packs, lint previews, source analysis, proposal generation, approved writeback, permission checks, and audit event generation.
- Obsidian plugin role: Agent Activity, Review Queue, Audit Log, Memory Inspector, Runtime Status, and Permission Policy.
- Removed from Obsidian plugin entry points: Analyze URL, Analyze Local File, Capture Source, Build Context Pack, Run Lint, Run Distill, and other source submission or maintenance actions.

The previous Codex local plugin package, Python runtime, root skills, benchmark scaffold, and transition-only brief documents have been removed from this repository. New implementation work belongs under `apps/`, `packages/`, and current `docs/`.

## Verification

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki
npm run verify
```

Root workspace scripts are available for narrower checks:

```bash
npm run typecheck
npm run build
npm run test
npm run package
```

## Product Principles

- Single Agent Operation Entry: users submit URLs, files, source analysis, context pack, lint, distill, and proposal work through an Agent client.
- Obsidian-native: the vault is the knowledge body; caches and indexes are acceleration layers only.
- Review-first: agents may propose long-term memory, but high-risk memory should not be silently committed.
- Evidence-first: important claims should trace back to sources, evidence blocks, and review state.
- Audit-first: critical agent reads and writes should be visible and reviewable in Obsidian.
- MCP-first for agent access: expose memory semantics, not arbitrary filesystem operations. The MCP server is read-only by default with controlled write tools for bounded working records.
- Human Governance in Obsidian: Obsidian is the UI for review, approval, rejection, revision requests, audit, permissions, and status.

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
5. Review Queue and human approval actions.
6. Agent-created source status visibility.
7. Memory Runtime v0.
8. Read-only-by-default MCP server MVP with controlled write tools and review-gated apply.

The first coding milestone is a buildable Obsidian plugin scaffold with:

- `manifest.json` using id `obs-wiki`.
- TypeScript project configuration.
- `main.ts`.
- Ribbon icon.
- command palette entries for governance views only.
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
- [First Batch Adjustment](./docs/obs_wiki_new_start_plan/12_First_Batch_Adjustment.md)
- [MCP Tool Permission Matrix](./docs/MCP_Tool_Permission_Matrix.md)
- [Implementation Manifest](./docs/obs_wiki_new_start_plan/IMPLEMENTATION_MANIFEST.json)

## Repository Scope

- `apps/obsidian-plugin/`: Obsidian governance plugin.
- `apps/mcp-server/`: Agent-facing MCP server.
- `packages/core/`: shared TypeScript memory/runtime primitives.
- `docs/obs_wiki_new_start_plan/`: current planning and acceptance docs.
- `scripts/`: repository verification scripts only.

## License

This project is licensed under the [MIT License](./LICENSE).
