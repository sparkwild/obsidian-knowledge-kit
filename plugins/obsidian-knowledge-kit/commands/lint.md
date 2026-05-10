---
description: Run the Vaultwright knowledge lint workflow against the active Obsidian vault.
---

# Vaultwright Lint

Check knowledge accuracy, structure health, and evidence hygiene inside the active Obsidian vault.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Run lint in read-only mode first:

```bash
python3 ~/.codex/plugins/obsidian-knowledge-kit/scripts/lint_knowledge_vault.py --json
```

If you want a durable lint report note inside the vault:

```bash
python3 ~/.codex/plugins/obsidian-knowledge-kit/scripts/lint_knowledge_vault.py --apply --json
```

## Scope

The first-pass lint checks:

- pending raw/register notes
- processed raw notes missing synthesis targets
- raw/source notes whose `claim_count` disagrees with actual claim blocks
- stable knowledge notes missing sources
- stable knowledge notes that only cite note-level sources rather than block/heading evidence
- claim callouts without source references
- broken wikilinks or missing source targets
- stale concepts
- orphan concepts
- important notes missing from `00_system/index.md`
- recent ingest/refine/distill sessions without a clear log trail

## Rules

- Lint is read-only by default.
- `doctor` checks environment and installation; `lint` checks vault content quality.
- Do not auto-fix stable knowledge notes from lint mode.
- Do not create an external raw/wiki directory system outside the vault.
