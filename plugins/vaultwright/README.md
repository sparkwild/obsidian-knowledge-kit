# Vaultwright Plugin

This directory is the repo-local Codex plugin package for `vaultwright`.

- Manifest: `.codex-plugin/plugin.json`
- Agents: `./agents/`
- Skills: `./skills/`
- Commands: `./commands/`
- Bundled runtime library: `./lib/obsidian_knowledge_shared/`

Lifecycle commands included:

- `setup`
- `start`
- `query`
- `lint`
- `doctor`
- `init`
- `ingest`
- `refine`
- `distill`

This package is intended to be installed into the home-local Codex plugin marketplace.

Under the official personal-local plugin layout, the installed copy lives at:

- `~/.codex/plugins/vaultwright`
- `~/.agents/plugins/marketplace.json`

Vaultwright treats the active Obsidian vault as the only knowledge carrier. It does not create a second raw/wiki knowledge system outside the vault.

For web ingest, prefer lightweight URL extraction first. Use `Computer Use` only as a manual fallback when websites block automated fetching, and never auto-install or auto-enable it on the user's machine.

Keep the plugin package self-contained by syncing root `skills/`, `lib/`, and `scripts/` into this directory:

```bash
python3 ../../scripts/sync_plugin_package.py
```
