# Obsidian Knowledge Kit Plugin

This directory is the repo-local Codex plugin package for `obsidian-knowledge-kit`.

- Manifest: `.codex-plugin/plugin.json`
- Agents: `./agents/`
- Skills: `./skills/`
- Commands: `./commands/`
- Bundled runtime library: `./lib/obsidian_knowledge_shared/`

Lifecycle commands included:

- `setup`
- `start`
- `doctor`
- `init`
- `ingest`
- `refine`
- `distill`

This package is intended to be installed into the home-local Codex plugin marketplace.

For web ingest, prefer lightweight URL extraction first. Use `Computer Use` only as a manual fallback when websites block automated fetching, and never auto-install or auto-enable it on the user's machine.

Keep the plugin package self-contained by syncing root `skills/` and `lib/` into this directory:

```bash
python3 ../../scripts/sync_plugin_package.py
```
