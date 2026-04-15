---
description: Verify installation state and optionally install the minimal global AGENTS knowledge-base hint.
---

# Obsidian Knowledge Setup

Prepare Codex so new sessions can reliably discover and use the Obsidian knowledge base.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Check the installed plugin package and home-local marketplace:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/check_codex_plugin.py --json
```

3. Check whether the global AGENTS hint is already present:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/install_global_knowledge_hint.py --json
```

## If The Global Hint Is Missing

Install the minimal global knowledge-base hint:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/install_global_knowledge_hint.py --apply --json
```

## Result

After setup, new sessions should have a stable discovery path:

1. detect the active vault with `obsidian vault info=path`
2. read `00_system/system.md`
3. read `05_knowledge/manuals/codex_native_workflow.md`
4. read `00_system/index.md` or project/manual notes only when the task needs them

## Rules

- Do not overwrite existing global AGENTS content.
- Only append the minimal knowledge hint when it is missing.
- Keep the global hint short and path-agnostic.
