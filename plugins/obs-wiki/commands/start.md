---
description: Load the obs-wiki startup bundle from the active Obsidian vault before doing work.
---

# obs-wiki Start

Use obs-wiki's startup bundle as the starting context for the current task.

## Preflight

1. Check the active Obsidian vault:

```bash
obsidian vault info=path
```

## What To Read

Treat these notes as the default startup bundle:

- `00_system/system.md`
- `01_ai_core/active_context.md`
- `01_ai_core/longterm_context.md`
- `00_system/index.md`
- the main `04_projects/*/project_overview.md` note for the active knowledge-base project
- `05_knowledge/manuals/codex_native_workflow.md`
- `05_knowledge/manuals/external_material_ingest_guide.md`
- the latest 1-2 session notes under `02_timeline/sessions/`

## Working Rules

- Use the active vault reported by `obsidian vault info=path`.
- Base your understanding on the loaded vault context instead of prior chat assumptions.
- Treat the active Obsidian vault as the only knowledge carrier.
- Do not create an external raw/wiki directory system outside the vault.
- If core notes are missing, stop and recommend `obs-wiki-init`.
- Summarize current focus, active workstreams, and relevant operating rules before proceeding with the user's task.
- If the user asks a knowledge question, recommend `query` instead of blind full-vault reading.
