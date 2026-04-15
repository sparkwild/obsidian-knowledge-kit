# Contributing

Thanks for contributing to `obsidian-knowledge-kit`.

## Scope

This repository contains two tightly coupled surfaces:

- the root toolkit source (`skills/`, `lib/`, `scripts/`)
- the packaged Codex plugin (`plugins/obsidian-knowledge-kit/`)

Changes should keep both surfaces consistent.

## Setup

1. Clone the repository.
2. Make changes in the root source directories first.
3. Sync the plugin package after changing root `skills/` or `lib/`:

```bash
python3 scripts/sync_plugin_package.py
```

## Validation

Run these checks before opening a PR:

```bash
python3 -B -m py_compile $(find lib scripts skills plugins/obsidian-knowledge-kit/lib plugins/obsidian-knowledge-kit/skills -name '*.py')
python3 scripts/check_codex_plugin.py --json
```

If you changed startup or distill behavior, also verify:

```bash
python3 scripts/load_knowledge_context.py --json
python3 scripts/render_session_skeleton.py --json
```

## Pull Requests

- Keep changes focused.
- Explain user-facing behavior changes clearly.
- Mention whether the plugin package was re-synced.
- Mention any manual Codex UI verification you performed.

## Design Constraints

- Keep the plugin package self-contained.
- Do not reintroduce symlinked `skills/` or external `lib/` dependencies inside the plugin package.
- Prefer activity-vault-aware behavior through `obsidian vault info=path`.
- Do not silently change top-level knowledge-base structure assumptions.
