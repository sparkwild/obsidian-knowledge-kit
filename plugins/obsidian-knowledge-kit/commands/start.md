---
description: Load the knowledge-base overview, manuals, and recent sessions before starting work.
---

# Obsidian Knowledge Start

Use the knowledge base as the starting context for the current task.

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
- If core notes are missing, stop and recommend `obsidian-knowledge-init`.
- Summarize current focus, active workstreams, and relevant operating rules before proceeding with the user's task.
- Respond to the user in Chinese by default unless they explicitly request another language.
