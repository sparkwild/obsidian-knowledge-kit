# Contributing

Thanks for contributing to Wiki Weaver.

## Scope

This repository contains the Obsidian-native Wiki Weaver monorepo:

- `apps/obsidian-plugin/` for the Obsidian review and connection plugin.
- `apps/mcp-server/` for the Agent-facing MCP server.
- `packages-weaver/core/` for shared TypeScript memory and vault primitives.
- `docs/` for current product and architecture documentation.

## Setup

1. Clone the repository.
2. Install dependencies inside the affected workspace if needed.
3. Run root verification before sending changes for review.

## Validation

Run these checks before opening a PR:

```bash
npm run verify
```

For narrower checks:

```bash
npm run typecheck
npm run build
npm run test
npm run package
```

## Pull Requests

- Keep changes focused.
- Explain user-facing behavior changes clearly.
- Mention MCP or Obsidian plugin boundary changes explicitly.
- Mention the verification commands you ran.

## Design Constraints

- Agent clients are the only operation entry for URL/file submission, source analysis, context packs, lint, distill, and proposal generation.
- Obsidian plugin commands must remain governance, review, status, and connection oriented.
- MCP tools must stay vault-scoped and follow `docs/MCP.md`.
- Do not write to a real Obsidian vault unless a task explicitly asks for it.
- Do not hardcode developer machine paths, vault paths, repository checkouts, or local ports.
