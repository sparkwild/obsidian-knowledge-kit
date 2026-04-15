# obsidian-knowledge-kit

[简体中文说明](./README.zh-CN.md)

An Obsidian knowledge workflow toolkit for Codex-style agents. It helps initialize a vault, ingest external materials, refine existing knowledge, and keep the knowledge base structured, traceable, and maintainable.

## Repository Layout

```text
obsidian-knowledge-kit/
├─ skills/
│  ├─ obsidian-knowledge-init/
│  ├─ obsidian-knowledge-ingest/
│  └─ obsidian-knowledge-refine/
├─ plugins/
│  └─ obsidian-knowledge-kit/
│     ├─ .codex-plugin/plugin.json
│     ├─ agents/
│     ├─ assets/
│     ├─ commands/
│     ├─ lib/
│     └─ skills/
└─ lib/
   └─ obsidian_knowledge_shared/
```

## Components

- `obsidian-knowledge-init`: bootstrap the minimum codex-native vault skeleton.
- `obsidian-knowledge-ingest`: bring external materials into `03_raw/` and distill them into stable notes.
- `obsidian-knowledge-refine`: improve structure, links, boundaries, and status notes in an initialized vault.
- `plugins/obsidian-knowledge-kit`: repo-local Codex plugin package with `.codex-plugin/plugin.json`.
- `lib/obsidian_knowledge_shared`: shared preflight, official skill update checks, and bootstrap note rendering.

## Current Status

- Repository migration completed from the earlier workspace prototype.
- Shared runtime is no longer exposed as a fourth skill.
- Plugin direction has been corrected to a Codex plugin package, not an Obsidian community plugin.

## Project Docs

- [Chinese README](./README.zh-CN.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## Development Install

Use the local installer to expose this repo to Codex without copying files by hand:

```bash
python3 scripts/install_local_runtime.py
```

By default it symlinks:

- `skills/obsidian-knowledge-init`
- `skills/obsidian-knowledge-ingest`
- `skills/obsidian-knowledge-refine`
- `lib/obsidian_knowledge_shared`

into `~/.codex` or the path from `CODEX_HOME`.

## Codex Plugin

This repository now exposes a repo-local Codex plugin package at:

```text
plugins/obsidian-knowledge-kit/.codex-plugin/plugin.json
```

Current plugin scope:

- expose the three main knowledge skills to Codex as a local plugin
- expose a setup command for installing the global AGENTS knowledge hint
- expose command entrypoints for startup and distill loops
- expose a doctor command for environment checks
- ship a self-contained plugin package so Codex cache installs do not depend on external symlinks
- install into the home-local Codex plugin marketplace for actual daily use

Validate the repo-local plugin package:

```bash
python3 scripts/check_codex_plugin.py --json
```

Sync the plugin package after root `skills/` or `lib/` changes:

```bash
python3 scripts/sync_plugin_package.py
```

Install the plugin into the home-local Codex marketplace:

```bash
python3 scripts/install_home_local_plugin.py --json
```

Check or install the minimal global knowledge hint in `~/.codex/AGENTS.md`:

```bash
python3 scripts/install_global_knowledge_hint.py --json
python3 scripts/install_global_knowledge_hint.py --apply --json
```

Load the current knowledge context:

```bash
python3 scripts/load_knowledge_context.py --json
```

Create a distill session skeleton:

```bash
python3 scripts/render_session_skeleton.py --apply --json
```

Expected workflow:

1. Open this repository in Codex.
2. Install the plugin into `~/plugins/obsidian-knowledge-kit` and `~/.agents/plugins/marketplace.json`.
3. If the plugin does not appear immediately, reopen the repository or restart Codex.

The reopen/restart step is an operational fallback inferred from the local plugin packaging model and local plugin examples.
