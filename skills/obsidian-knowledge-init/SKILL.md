---
name: obsidian-knowledge-init
description: Initialize an Obsidian knowledge vault into the codex-native knowledge system. Use when a vault has not been set up yet, when core system notes are missing, or when the user wants to bootstrap a new Obsidian knowledge base. Before doing anything, verify Obsidian is running, the obsidian CLI works, and the official kepano/obsidian-skills dependencies exist. If required official skills are missing or outdated, stop and ask the user whether to install or update them from the official repo before continuing.
---

# Obsidian Knowledge Init

## Purpose
- Turn the active Obsidian vault into a runnable codex-native knowledge system.
- Create the minimum system skeleton only after preflight checks pass.

## Language Rule
- Respond to the user in Chinese by default unless they explicitly request another language.
- Keep file paths, code identifiers, frontmatter keys, enum values, and literal commands in English.

## Required preflight
1. Run `scripts/check_obsidian_env.py --task init --json`.
2. Run `scripts/check_kepano_skills.py obsidian-cli obsidian-markdown`.
3. If required official skills are missing or outdated, stop and ask the user whether to install/update them.
4. Only proceed after the user explicitly agrees and `scripts/install_or_update_kepano_skills.py` succeeds.
5. Re-run preflight after installation/update.

## Environment guard
- If Obsidian is not running, stop.
- If the `obsidian` CLI cannot connect to an active vault, stop.
- If the active vault is not writable, stop.

## Initialization workflow
1. Read the active vault path from the Obsidian CLI.
2. Render the minimum notes manifest with `scripts/render_core_notes.py --json`.
3. Create the system notes in the active vault.
4. Do not import business knowledge or external materials during init.
5. Keep the structure minimal and stable.

## What must exist after success
- `00_system/system.md`
- `00_system/index.md`
- `00_system/log.md`
- `00_system/decision_records.md`
- `01_ai_core/active_context.md`
- `01_ai_core/longterm_context.md`
- `04_projects/knowledge_base/project_overview.md`
- `05_knowledge/manuals/codex_native_workflow.md`
- `05_knowledge/manuals/external_material_ingest_guide.md`

## Safety
- Do not overwrite user knowledge pages outside the minimum system notes unless the user explicitly asks.
- If the vault already appears initialized, only repair missing core notes; do not silently reset the system.
