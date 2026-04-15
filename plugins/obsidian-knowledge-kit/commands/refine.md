---
description: Refine the active Obsidian knowledge base without changing top-level structure silently.
---

# Obsidian Knowledge Refine

Improve the active knowledge base by fixing structure, boundaries, links, and stale status information.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Read the current operating context:

- `00_system/system.md`
- `00_system/index.md`
- `01_ai_core/active_context.md`
- `01_ai_core/longterm_context.md`

3. Confirm required official skills:

- `obsidian-cli`
- `obsidian-markdown`

## Workflow

Follow the bundled `obsidian-knowledge-refine` skill.

Pick one coherent slice at a time:

- entry-map cleanup
- stale status cleanup
- link and health cleanup
- topic-boundary cleanup

Then update:

- the refined note set
- `00_system/index.md` if navigation changed
- `00_system/log.md`
- the current daily note if the work is notable
- a session note if the refinement is meaningful
- the relevant `04_projects/*/project_overview.md` if project status changed

## Rules

- Do not change top-level directory structure without confirmation.
- Do not bulk-migrate paths silently.
- Do not delete core system notes without confirmation.
