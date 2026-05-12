# obs-wiki Plugin

This directory is the repo-local Codex plugin package for `obs-wiki`.

- Manifest: `.codex-plugin/plugin.json`
- Agents: `./agents/`
- Skills: `./skills/`
- Commands: `./commands/`
- Bundled runtime library: `./lib/obs_wiki_shared/`

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

Bundled MCP adapter scripts:

- `scripts/mcp_adapter.py`: read-only stdio MCP adapter.
- `scripts/smoke_mcp_adapter.py`: generated-vault smoke test for the adapter.

This package is intended to be installed into the home-local Codex plugin marketplace.

Under the official personal-local plugin layout, the installed copy lives at:

- `~/.codex/plugins/obs-wiki`
- `~/.agents/plugins/marketplace.json`

obs-wiki treats the active Obsidian vault as the only knowledge carrier. It does not create a second raw/wiki knowledge system outside the vault.

For web ingest, prefer lightweight URL extraction first. Use `Computer Use` only as a manual fallback when websites block automated fetching, and never auto-install or auto-enable it on the user's machine.

Keep the plugin package self-contained by syncing root `skills/`, `lib/`, and `scripts/` into this directory:

```bash
python3 ../../scripts/sync_plugin_package.py
```
