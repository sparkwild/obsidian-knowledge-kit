# Tracekeeper Documentation

This directory keeps the current Tracekeeper product documentation. Historical execution prompts, batch notes, and migration records have been removed so the docs describe the product as it exists now.

## Current Docs

- [Architecture](./ARCHITECTURE.md)
- [Obsidian plugin](./PLUGIN.md)
- [MCP and permissions](./MCP.md)
- [Client auto-configuration](./CLIENT_AUTO_CONFIGURATION.md)
- [Community plugin submission](./COMMUNITY_PLUGIN_SUBMISSION.md)
- [Development and release notes](./DEVELOPMENT.md)
- [Roadmap](./ROADMAP.md)

## Core Boundary

- Agent clients start knowledge work.
- Obsidian is the human review and governance surface.
- The vault is the durable knowledge layer.
- Client connection details use local Runtime defaults that users can change; Tracekeeper does not hardcode vault paths, repository paths, or developer machine paths.
