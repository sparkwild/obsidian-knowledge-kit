# Obsidian Plugin

## Identity

- Plugin id: `obswiki`
- Display name: `Obswiki`
- Chinese in-plugin display: `知识库`
- Version: `0.1.0`
- Mobile declaration: `isDesktopOnly: false`

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
- AI tool MCP URL
- Legacy SSE URL
- stdio command name
- Agent scope label

The plugin does not ship with a fixed MCP URL or fixed port. Use a URL such as `http://127.0.0.1:<port>/mcp` only when your local runtime provides it.

## Local Install

Package the plugin:

```bash
npm run package
```

Copy the generated package into:

```text
<vault>/.obsidian/plugins/obswiki/
```

Required files:

```text
manifest.json
main.js
styles.css
```

Validate in Obsidian:

```bash
obsidian plugin id=obswiki
obsidian plugin:reload id=obswiki
obsidian dev:errors
```
