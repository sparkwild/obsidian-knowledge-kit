---
description: Check the active Obsidian knowledge-vault environment, required skills, and plugin/runtime health before doing work.
---

# Obsidian Knowledge Doctor

Run a read-only health check for the current Obsidian knowledge workflow.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Check the repo-local knowledge toolkit package:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/check_codex_plugin.py --json
```

3. Check required official skills:

```bash
python3 skills/obsidian-knowledge-init/scripts/check_kepano_skills.py obsidian-cli obsidian-markdown
```

4. Check the current vault environment:

```bash
python3 skills/obsidian-knowledge-init/scripts/check_obsidian_env.py --task init --json
```

5. Check the global AGENTS knowledge hint:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/install_global_knowledge_hint.py --json
```

## Output

Summarize:

- active vault path
- whether core notes exist
- whether `obsidian-cli` and `obsidian-markdown` are installed
- whether the local plugin package is structurally valid
- whether the global AGENTS knowledge hint is installed
- the next recommended action: `start`, `init`, `ingest`, or `refine`

## Rules

- Do not make changes in doctor mode.
- If multiple problems exist, report them in a stable order: vault, core notes, official skills, local plugin package.
