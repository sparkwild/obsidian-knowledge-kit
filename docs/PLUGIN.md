# Obsidian Plugin

## Identity

- Plugin id: `wiki-weaver`
- Display name: `Wiki Weaver`
- Chinese in-plugin display: `知识库`
- Version: `0.1.0`
- Desktop-only declaration: `isDesktopOnly: true`

## User Surface

The plugin provides these views:

- Agent Activity
- Review Queue
- Memory Inspector
- Audit Log
- Runtime Status
- Permission Policy
- Agent Connections

The plugin may provide review actions:

- Approve
- Reject
- Defer
- Request Revision
- Apply Approved Writeback

## Boundary

The plugin does not provide maintenance entry points such as Analyze URL, Analyze Local File, Capture Source, Build Context Pack, Run Lint, or Run Distill. Those actions start from an AI assistant through MCP.

## Settings

The plugin settings are intentionally user-controlled:

- Welcome/status text
- MCP Runtime port
- Local connection token rotation
- Agent scope label

The plugin is desktop-only because it hosts a local Streamable HTTP Runtime on `127.0.0.1`. The default endpoint is `http://127.0.0.1:58437/mcp`, and generated client configuration includes a local token. The Runtime starts with Obsidian and stops when Obsidian or the plugin closes.

## Local Install

Package the plugin:

```bash
npm run package
```

Copy the generated package into:

```text
<vault>/.obsidian/plugins/wiki-weaver/
```

Required files:

```text
manifest.json
main.js
styles.css
```

Validate in Obsidian:

```bash
obsidian plugin id=wiki-weaver
obsidian plugin:reload id=wiki-weaver
obsidian dev:errors
```

## Community Release

Run the community metadata check before opening a submission PR:

```bash
npm run community:check
```

For each public release, the GitHub release tag must exactly match `manifest.json` version. The release assets must include:

```text
main.js
manifest.json
styles.css
```

The release workflow builds and packages these files from `apps/obsidian-plugin/plugin/`.
