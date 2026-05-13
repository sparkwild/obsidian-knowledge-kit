# Roadmap

## Current Private Build

- Keep Obswiki private and optimized for local use.
- Stabilize the Obsidian plugin review and connection surfaces.
- Keep Agent-first operation boundaries strict.
- Verify all paths and connection details remain user-configured.

## Next Work

1. Improve Agent Connections status states and client detection fixtures.
2. Add fixture tests for client config merge and removal.
3. Split large Obsidian plugin UI modules out of `main.ts`.
4. Add local runtime packaging for `obswiki-mcp`.
5. Add integration smoke checks for installed local plugin reload.

## Release Readiness

Before considering public distribution:

- no hardcoded developer paths
- local Runtime defaults are documented and user-overridable
- no stale historical migration docs
- clear privacy/security docs
- repeatable package verification
- tested install and reload flow
