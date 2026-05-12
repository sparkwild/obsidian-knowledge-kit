---
description: Build an obs-wiki context pack for a knowledge question before reading candidate notes or answering.
---

# obs-wiki Query

Use the active Obsidian vault as the only knowledge carrier, then build a focused context pack for the current question.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. If Obsidian is unavailable but you still need an offline dry run, pass an explicit vault path to the script instead of assuming a different knowledge store.

3. Build the context pack first:

```bash
python3 ~/.codex/plugins/obs-wiki/scripts/build_context_pack.py "<question>" --json
```

If you are ready to write the context pack note into the vault:

```bash
python3 ~/.codex/plugins/obs-wiki/scripts/build_context_pack.py "<question>" --apply --json
```

## Workflow

1. Read the core operating bundle:
   - `00_system/system.md`
   - `01_ai_core/active_context.md`
   - `01_ai_core/longterm_context.md`
   - `00_system/index.md`
   - `05_knowledge/manuals/codex_native_workflow.md`
2. Generate a context pack note inside:
   - `01_ai_core/context_packs/`
3. Review:
   - candidate notes
   - source candidates
   - knowledge gaps
   - suggested writeback target
4. Read only the highest-value candidate notes instead of full-reading the whole vault.
5. Answer with Obsidian-native references when possible:
   - wikilinks
   - note paths
   - source or evidence links
6. If evidence is still weak, recommend creating or updating a knowledge gap note rather than asserting a stable conclusion.

## Rules

- Do not create an external raw/wiki directory system.
- Do not treat the filesystem outside the active Obsidian vault as the knowledge layer.
- Do not full-read the vault by default.
- Do not write stable knowledge directly during query mode unless the user explicitly asks for writeback and the evidence is sufficient.
