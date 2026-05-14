# Tracekeeper

[简体中文说明](./README.zh-CN.md)

Build an AI-assisted wiki in desktop Obsidian. Tracekeeper connects AI assistants to your vault through an Obsidian-hosted local MCP Runtime, then lets you review proposed knowledge updates before they are written.

## Key Features

- Read Obsidian notes from AI clients through `tracekeeper.*` MCP tools.
- Queue proposed wiki and long-term memory updates for human review.
- Inspect agent activity, pending reviews, audit logs, runtime status, and client connections inside Obsidian.
- Keep writes vault-scoped and approval-gated for durable memory changes.
- Run the Streamable HTTP MCP Runtime only while desktop Obsidian is open.

## Get Started

Tracekeeper is a desktop-only Obsidian plugin because its MCP Runtime depends on a local HTTP server. It is being prepared for the official Obsidian community plugin directory; until it is accepted, install it manually from a packaged build.

- [Obsidian plugin setup](./docs/PLUGIN.md)
- [MCP and permissions](./docs/MCP.md)
- [Client auto-configuration](./docs/CLIENT_AUTO_CONFIGURATION.md)

## Documentation

- [Docs index](./docs/README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Obsidian plugin](./docs/PLUGIN.md)
- [MCP and permissions](./docs/MCP.md)
- [Client auto-configuration](./docs/CLIENT_AUTO_CONFIGURATION.md)
- [Development and release notes](./docs/DEVELOPMENT.md)
- [Roadmap](./docs/ROADMAP.md)

## Acknowledgements

Tracekeeper uses ChatGPT and Codex as development assistants during planning, implementation, and review. The project is also influenced by Andrej Karpathy's public writing and demos on AI-assisted software development.

These acknowledgements are not GitHub contributor credits, sponsorship claims, or endorsements.

## License

This project is licensed under the [MIT License](./LICENSE).
