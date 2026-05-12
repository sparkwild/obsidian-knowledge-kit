---
description: Check obs-wiki installation, the active Obsidian vault environment, and required skills before doing work.
---

# obs-wiki Doctor

Run a read-only health check for the current obs-wiki workflow.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Check the installed knowledge toolkit package:

```bash
python3 ~/.codex/plugins/obs-wiki/scripts/check_codex_plugin.py --require-installed --json
```

3. Check required official skills:

```bash
python3 ~/.codex/plugins/obs-wiki/skills/obs-wiki-init/scripts/check_kepano_skills.py obsidian-cli obsidian-markdown
```

4. Check the current vault environment:

```bash
python3 ~/.codex/plugins/obs-wiki/skills/obs-wiki-init/scripts/check_obsidian_env.py --task init --json
```

5. Check the global AGENTS knowledge hint:

```bash
python3 ~/.codex/plugins/obs-wiki/scripts/install_global_knowledge_hint.py --json
```

## Output

Summarize:

- active vault path
- whether core notes exist
- whether `obsidian-cli` and `obsidian-markdown` are installed
- whether the local plugin package is structurally valid
- whether the global AGENTS knowledge hint is installed
- the next recommended action: `start`, `init`, `query`, `ingest`, or `refine`

## Rules

- Do not make changes in doctor mode.
- Do not recommend building a second raw/wiki directory system outside the vault.
- If multiple problems exist, report them in a stable order: vault, core notes, official skills, local plugin package.
