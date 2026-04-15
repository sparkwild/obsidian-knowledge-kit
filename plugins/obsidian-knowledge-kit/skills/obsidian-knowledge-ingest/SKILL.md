---
name: obsidian-knowledge-ingest
description: Import external materials into a codex-native Obsidian knowledge vault. Use when the user provides a local directory, file, or URL and wants it captured into raw source notes and distilled into knowledge notes. Before ingestion, verify the Obsidian environment and required official obsidian-skills. Always require obsidian-cli and obsidian-markdown. Require defuddle for URL/web tasks, json-canvas for canvas tasks, and obsidian-bases for base-view tasks. If required official skills are missing or outdated, stop and ask the user whether to install or update them from the official repo before continuing.
---

# Obsidian Knowledge Ingest

## Purpose
- Convert external material into raw source notes and stable knowledge notes inside the active Obsidian vault.

## Required preflight
1. Run `scripts/check_obsidian_env.py --task ingest --check-core-notes --json`.
2. Run `scripts/check_kepano_skills.py obsidian-cli obsidian-markdown`.
3. Add conditional checks depending on task type:
   - URL/web: `defuddle`
   - canvas output: `json-canvas`
   - base output: `obsidian-bases`
4. If missing or outdated official skills are required, stop and ask for approval before using `scripts/install_or_update_kepano_skills.py --apply`.

## Ingest workflow
1. Read `00_system/system.md`, `00_system/index.md`, `01_ai_core/active_context.md`, and `01_ai_core/longterm_context.md`.
2. Decide the source mode:
   - `external_reference`
   - `extracted_snapshot`
   - `local_copy`
3. Create or update a raw source note.
4. Extract only the high-value content.
5. Distill into the right knowledge partition.
6. Update:
   - `00_system/index.md`
   - `00_system/log.md`
   - current daily note
   - a session note when the ingest is material
   - `active_context` when priorities changed
   - related project notes when relevant

## Guardrails
- Do not import everything blindly.
- Treat middleware artifact folders as artifact inventories, not as normal reading material.
- Treat repeated books or translated duplicates as one knowledge source cluster when appropriate.
- If a new knowledge partition would materially change structure, stop and ask the user first.
