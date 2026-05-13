# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- Converged the repository onto the Obsidian-native + Agent-first monorepo shape.
- Root validation now runs through `npm run verify`.
- MCP server policy is read-only by default with controlled writes and review-gated apply.
- Removed the previous Codex local plugin package, Python runtime, root skills, benchmark scaffold, and transition-only brief docs.

### Added

- Added root `package.json` workspace scripts.
- Added `scripts/verify_phase11.sh`.
- Added `docs/MCP_Tool_Permission_Matrix.md`.
- Added MCP review-gated writeback tools: `obs_wiki.list_approved_writebacks` and `obs_wiki.apply_approved_writeback`.

### Validation

- `npm run verify`
