# obsidian-obswiki

[简体中文说明](./README.zh-CN.md)

Obswiki connects AI assistants with an Obsidian vault. Agents use the MCP server to read, organize, and prepare memory work; the Obsidian plugin gives the user a local review surface for activity, proposals, permissions, connection setup, and approved writeback.

The vault remains the durable knowledge layer. The plugin does not submit URLs, analyze files, run lint, distill sessions, or capture sources directly; those actions start from an AI assistant through MCP.

## Names

- Product: `Obswiki`
- Repository: `obsidian-obswiki`
- Obsidian plugin id: `obswiki`
- Obsidian plugin display name: `Obswiki`
- Chinese in-plugin display: `知识库`
- MCP server id/config key: `obswiki`
- MCP tool prefix: `obswiki.*`
- Initial version: `0.1.0`

## Verify

```bash
cd <repo>
npm run verify
```

Narrower checks are also available:

```bash
npm run typecheck
npm run build
npm run test
npm run package
```

## Install The Obsidian Plugin

This project is currently private and is not intended for official Obsidian community listing yet.

### Manual Install

1. Build the plugin:

```bash
cd <repo>
npm run package
```

2. Copy the generated files into the vault plugin folder:

```text
<vault>/.obsidian/plugins/obswiki/
```

Required files:

```text
apps/obsidian-plugin/plugin/manifest.json
apps/obsidian-plugin/plugin/main.js
apps/obsidian-plugin/plugin/styles.css
```

3. Restart Obsidian or reload community plugins.
4. Enable `Obswiki` in `Settings -> Community plugins`.
5. Validate the installed plugin:

```bash
obsidian plugin id=obswiki
obsidian plugin:reload id=obswiki
obsidian dev:errors
```

The installed plugin should report id `obswiki`, name `Obswiki`, version `0.1.0`, and no developer console errors after reload.

## Connection Model

Obswiki does not hardcode a vault path, repository checkout path, or developer machine path. It does ship with local Runtime defaults for the loopback connection.

- Vault path: read from the current Obsidian vault at runtime.
- MCP URL: defaults to `http://127.0.0.1:37241/mcp` and can be changed in plugin settings.
- SSE URL: defaults to `http://127.0.0.1:37241/sse` for older clients and can be changed in plugin settings.
- stdio command: configurable, default command name is `obswiki-mcp`.
- Client config writeback: user-confirmed only, with backup, and only for the `obswiki` MCP server block.

Keep the default loopback URL unless your local Runtime is configured to use a different address or port.

## Product Boundary

- Agent clients are the only operation entry for URL/file submission, source analysis, context pack generation, lint, distill, and memory proposal generation.
- The Obsidian plugin is the human review surface: Agent Activity, Review Queue, Audit Log, Memory Inspector, Runtime Status, Permission Policy, and Agent Connections.
- Long-term memory, user preferences, important project decisions, and high-confidence claims should enter Review Queue before being written.
- Approved writeback is executed by the runtime and recorded in audit logs.
- The plugin does not read or write files outside the active vault, except when the user explicitly confirms client configuration file changes from the connection center.

## Repository Layout

```text
obsidian-obswiki/
├─ apps/
│  ├─ obsidian-plugin/
│  └─ mcp-server/
├─ packages/
│  └─ core/
├─ docs/
├─ scripts/
└─ package.json
```

## Documentation

- [Docs index](./docs/README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Obsidian plugin](./docs/PLUGIN.md)
- [MCP and permissions](./docs/MCP.md)
- [Client auto-configuration](./docs/CLIENT_AUTO_CONFIGURATION.md)
- [Roadmap](./docs/ROADMAP.md)

## License

This project is licensed under the [MIT License](./LICENSE).
