# Changelog

All notable changes to Wiki Weaver will be documented in this file.

## [0.1.0] - Initial Private Build

### Added

- Obsidian plugin scaffold for Agent Activity, Review Queue, audit, permissions, runtime status, and AI tool connections.
- MCP server with read-only tools, bounded working-record writes, and review-gated approved writeback.
- Shared TypeScript core package for vault scanning, recall, context packs, source analysis, lint, and safety helpers.
- Root workspace verification through `npm run verify`.

### Changed

- Product name, plugin display name, MCP config key, and repository name are aligned as Wiki Weaver / `wiki-weaver` / `obsidian-wiki-weaver`.
- User-facing connection settings no longer assume a fixed vault path, repository path, local port, or developer machine path.
