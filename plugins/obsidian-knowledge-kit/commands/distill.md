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

1. Create a new session note skeleton:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/render_session_skeleton.py --apply --json
```

2. Fill the session note with:

   - frontmatter:
   - `title`
   - `created`
   - `updated`
   - `type: session`
   - sections:
   - objective
   - context_loaded
   - work_log
   - outcomes
   - next_actions

3. Apply the distill updates:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/apply_distill_updates.py "02_timeline/sessions/<session>.md" \
  --summary "<one-line summary>" \
  --project-progress "<optional project latest progress>" \
  --apply --json
```

This updates:

- `00_system/log.md`
- `01_ai_core/active_context.md`
- the active `04_projects/*/project_overview.md` when `--project-progress` is provided

4. Only promote stable conclusions into `05_knowledge/` or `06_experience/`.

## Guardrails

- Do not bulk-copy temporary reasoning into stable knowledge notes.
- Do not update the top-level structure or metadata model without confirmation.
- If the session was minor, keep the distillation lightweight but still leave a durable trail in the session note and log.
- Respond to the user in Chinese by default unless they explicitly request another language.
