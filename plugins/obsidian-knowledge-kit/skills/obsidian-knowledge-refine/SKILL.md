---
name: obsidian-knowledge-refine
description: Refine and optimize a codex-native Obsidian knowledge vault. Use when the user wants to improve structure, split entry notes into thematic notes, fix links, update status notes, or continue a second-pass refinement of the knowledge base. Before refinement, verify the Obsidian environment and the required official obsidian-skills. Always require obsidian-cli and obsidian-markdown. If required official skills are missing or outdated, stop and ask the user whether to install or update them from the official repo before continuing.
---

# Obsidian Knowledge Refine

## Purpose
- Improve an already initialized knowledge vault without changing the top-level structure silently.

## Required preflight
1. Run `scripts/check_obsidian_env.py --task refine --check-core-notes --json`.
2. Run `scripts/check_kepano_skills.py obsidian-cli obsidian-markdown`.
3. If required official skills are missing or outdated, stop and ask for approval before using `scripts/install_or_update_kepano_skills.py --apply`.

## Refinement workflow
1. Read `system`, `index`, `active_context`, and `longterm_context`.
2. Identify the highest-value target:
   - entry-map note
   - status inconsistency
   - link/health issue
   - topic boundary cleanup
3. Refine one coherent slice at a time.
4. Update:
   - the refined note(s)
   - `00_system/index.md`
   - `00_system/log.md`
   - current daily note
   - a session note when the refinement is meaningful
   - `active_context` or project status if reality changed

## Allowed changes
- split overview notes into reusable topic notes
- improve links
- sync project status with actual progress
- fix stale or misleading descriptions
- clean up knowledge partition boundaries

## Forbidden without confirmation
- top-level directory changes
- metadata model changes
- bulk path migrations
- deleting core system files
