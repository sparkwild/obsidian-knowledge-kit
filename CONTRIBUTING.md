# Contributing

Thanks for contributing to `obs-wiki`.

## Scope

This repository contains the Obsidian-native obs-wiki monorepo:

- `apps/obsidian-plugin/` for the Obsidian governance plugin.
- `apps/mcp-server/` for the Agent-facing MCP server.
- `packages/core/` for shared TypeScript memory/runtime primitives.
- `docs/` for current product and architecture docs.

Do not reintroduce the removed Codex local plugin package, root skills, or Python runtime as a primary product path.

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

- Agent is the only operation entry for URL/file submission, source analysis, context packs, lint, distill, and proposal generation.
- Obsidian plugin commands must remain governance/review/status oriented.
- MCP tools must stay vault-scoped and follow `docs/MCP_Tool_Permission_Matrix.md`.
- Do not write to a real Obsidian vault unless a task explicitly asks for it.
