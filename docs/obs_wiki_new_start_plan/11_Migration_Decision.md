# 11 Migration Decision: Legacy Codex Plugin

## Decision

Keep `plugins/obs-wiki` as an archive/legacy candidate.

## Decision rationale

1. Phase 0 explicitly requires a new direction (`Obsidian plugin-first + MCP interface`) but does not require immediate deletion of the old Codex plugin.
2. The user has not explicitly approved deletion.
3. The current task scope is to complete `Phase 10: Packaging / Tests / Migration Decision` and build sustainable development scaffolding.
4. Preserving legacy code enables rollback and audit comparison while the new stack (`apps/obsidian-plugin` + `apps/mcp-server`) matures.

## Implementation action taken

- Do not delete or move `plugins/obs-wiki`.
- Mark `plugins/obs-wiki` as legacy archive in README.
- Route new runtime work to:
  - `apps/obsidian-plugin` (Obsidian plugin surface)
  - `apps/mcp-server` (agent interface)
- Keep legacy docs and scripts untouched unless explicitly asked.

## Non-goals

- Do not migrate users to legacy code as the primary path.
- Do not remove old plugin directory without explicit approval.
