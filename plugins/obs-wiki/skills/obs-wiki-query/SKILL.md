---
name: obs-wiki-query
description: Query an active Obsidian knowledge vault through an obs-wiki context pack. Use when the user asks a knowledge-base-related question, wants targeted retrieval instead of full-vault reading, or needs Codex to identify candidate notes, source candidates, knowledge gaps, and likely writeback targets before answering. Always treat the active Obsidian vault as the only knowledge carrier and avoid creating external raw/wiki directory systems.
---

# obs-wiki Query

## Purpose
- Build a focused context pack before answering knowledge-base-related questions.
- Help Codex retrieve only the most relevant notes, source candidates, and knowledge gaps from the active vault.

## Required preflight
1. Detect the active vault with `obsidian vault info=path`.
2. Read the operating bundle first:
   - `00_system/system.md`
   - `01_ai_core/active_context.md`
   - `01_ai_core/longterm_context.md`
   - `00_system/index.md`
   - `05_knowledge/manuals/codex_native_workflow.md`
3. Build the context pack with `scripts/build_context_pack.py`.
4. If the vault cannot be detected, stop unless the user explicitly provides a vault path.

## Query workflow
1. Turn the user question into a context pack.
2. Review:
   - candidate notes
   - source candidates
   - knowledge gaps
   - suggested writeback target
3. Read only the highest-value candidates instead of scanning the whole vault blindly.
4. Answer using Obsidian-native references when possible:
   - wikilinks
   - note paths
   - source or evidence blocks when available
5. If the evidence is weak, say so and recommend creating or updating a knowledge gap note.
6. If the answer produces stable knowledge, suggest a session, project, or knowledge-note writeback target.

## Guardrails
- Do not treat the filesystem outside the active Obsidian vault as the knowledge layer.
- Do not create external raw/wiki directory systems.
- Do not full-read the entire vault by default.
- Do not write stable conclusions into `05_knowledge/` without sufficient evidence.
- Context packs are temporary working notes inside the vault; they are not a second database.
