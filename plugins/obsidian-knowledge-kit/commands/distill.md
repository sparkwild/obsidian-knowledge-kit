---
description: Distill the current work back into a session note and point the agent to update the knowledge base.
---

# Obsidian Knowledge Distill

Close the loop after meaningful work by creating a session note skeleton and updating the knowledge vault deliberately.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

## Distill Workflow

Create a new session note under `02_timeline/sessions/` with:

1. frontmatter:
   - `title`
   - `created`
   - `updated`
   - `type: session`
2. sections:
   - objective
   - context_loaded
   - work_log
   - outcomes
   - next_actions
2. Update `01_ai_core/active_context.md` if priorities or constraints changed.
3. Update the active `04_projects/*/project_overview.md` note if project status changed.
4. Append a concise entry to `00_system/log.md`.
5. Only promote stable conclusions into `05_knowledge/` or `06_experience/`.

## Guardrails

- Do not bulk-copy temporary reasoning into stable knowledge notes.
- Do not update the top-level structure or metadata model without confirmation.
- If the session was minor, keep the distillation lightweight but still leave a durable trail in the session note and log.
