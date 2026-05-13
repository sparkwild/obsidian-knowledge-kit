# obs-wiki

[简体中文说明](./README.zh-CN.md)

obs-wiki is an Agent-first memory system that uses an Obsidian vault as the durable knowledge layer and an Obsidian plugin as the human governance surface.

The current product line is Obsidian-native and Agent-first. Agent clients are the only operation entry for URL/file submission, source analysis, context packs, lint, distill, and memory proposals. The Obsidian plugin is the user's review, audit, permission, status, and approval interface. MCP is the primary interface for agents. The vault remains the only source of truth for durable memory and knowledge.

## Current Direction

- Product name: `obs-wiki`.
- Plugin id: `obs-wiki`.
- Obsidian plugin display name: `Wiki Console` (`知识库控制台` in Chinese UI).
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

## Install The Obsidian Plugin

Current plugin release: [`0.1.3`](https://github.com/sparkwild/obs-wiki/releases/tag/0.1.3).

### Beta Install With BRAT

Before the plugin is listed in the official Obsidian community plugin directory, testers can install it with the BRAT community plugin when they have access to this repository:

1. Install and enable `BRAT` in Obsidian.
2. Run `BRAT: Add a beta plugin for testing`.
3. Enter `sparkwild/obs-wiki`.
4. Enable `Wiki Console` in `Settings -> Community plugins`.

If the repository or release is private for your account, use the manual release-asset install path below.

### Manual Install From Release Assets

1. Download `manifest.json`, `main.js`, and `styles.css` from the latest GitHub release.
2. Create this folder inside your Obsidian vault if it does not already exist:

```text
.obsidian/plugins/obs-wiki/
```

3. Place the three downloaded files in `.obsidian/plugins/obs-wiki/`.
4. Restart Obsidian or reload community plugins.
5. Enable `Wiki Console` in `Settings -> Community plugins`.
6. Open the command palette and run `Wiki Console: Open agent activity` or `Wiki Console: 打开 Agent 活动`, depending on the Obsidian language.

### Local Development Install

Build and package the plugin from this checkout:

```bash
cd /Users/zhangjie/AgentProjects/sparkwild/obs-wiki
npm run package
```

Then copy these generated files into your vault plugin folder:

```text
apps/obsidian-plugin/plugin/manifest.json
apps/obsidian-plugin/plugin/main.js
apps/obsidian-plugin/plugin/styles.css
```

Expected target folder:

```text
<your-vault>/.obsidian/plugins/obs-wiki/
```

If you use the Obsidian CLI during local development, validate the installed plugin with:

```bash
obsidian plugin id=obs-wiki
obsidian plugin:reload id=obs-wiki
obsidian dev:errors
```

The installed plugin should report id `obs-wiki`, name `Wiki Console`, version `0.1.3`, and no developer console errors after reload.

## Desktop And Mobile Declaration

The Obsidian plugin manifest keeps `isDesktopOnly: false`. The plugin runtime uses Obsidian plugin APIs only; it does not call Node.js, Electron, shell commands, network APIs, or arbitrary local filesystem APIs.

This declaration applies to the Obsidian governance plugin: Agent Activity, Review Queue, Audit Log, Memory Inspector, Runtime Status, and Permission Policy. The MCP server and Agent/runtime workflows are separate local agent processes and are not bundled into the mobile plugin.

## Product Principles

- Single Agent Operation Entry: users submit URLs, files, source analysis, context pack, lint, distill, and proposal work through an Agent client.
- Obsidian-native: the vault is the knowledge body; caches and indexes are acceleration layers only.
- Review-first: agents may propose long-term memory, but high-risk memory should not be silently committed.
- Evidence-first: important claims should trace back to sources, evidence blocks, and review state.
- Audit-first: critical agent reads and writes should be visible and reviewable in Obsidian.
- MCP-first for agent access: expose memory semantics, not arbitrary filesystem operations. The MCP server is read-only by default with controlled write tools for bounded working records.
- Human Governance in Obsidian: Obsidian is the UI for review, approval, rejection, revision requests, audit, permissions, and status.

## Disclosures

- Network: the Obsidian plugin does not make network requests.
- Telemetry: the Obsidian plugin does not collect analytics, usage metrics, or client-side telemetry.
- Vault writes: the Obsidian plugin can initialize obs-wiki control folders/files, update review queue approval status, and append audit events inside the active vault after user action.
- External files: the Obsidian plugin does not read or write files outside the active vault.
- Agent/runtime boundary: URL/file submission, source analysis, context pack generation, lint, distill, and protected memory writeback are Agent/runtime workflows, not direct Obsidian plugin actions.

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
- command palette entries for governance views and confirmed vault initialization only.
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
