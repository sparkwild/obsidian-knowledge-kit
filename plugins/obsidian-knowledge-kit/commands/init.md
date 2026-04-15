---
description: Initialize the active Obsidian vault into the codex-native knowledge system.
---

# Obsidian Knowledge Init

Use the active Obsidian vault as the target and bootstrap the minimum codex-native knowledge-base structure.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Verify required official skills and environment:

- `obsidian-cli`
- `obsidian-markdown`
- active vault is writable

3. If required official skills are missing or outdated, stop and ask before installing or updating them.

## Workflow

Follow the bundled `obsidian-knowledge-init` skill.

The result must create or repair these core notes:

- `00_system/system.md`
- `00_system/index.md`
- `00_system/log.md`
- `00_system/decision_records.md`
- `01_ai_core/active_context.md`
- `01_ai_core/longterm_context.md`
- one active `04_projects/*/project_overview.md`
- `05_knowledge/manuals/codex_native_workflow.md`
- `05_knowledge/manuals/external_material_ingest_guide.md`

## Rules

- Do not import business knowledge during init.
- If the vault is already initialized, only repair missing core notes.
- Do not silently overwrite user-authored knowledge pages.
- Respond to the user in Chinese by default unless they explicitly request another language.
