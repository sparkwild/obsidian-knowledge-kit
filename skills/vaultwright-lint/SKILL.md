---
name: vaultwright-lint
description: Run a read-only health check over a Vaultwright-managed Obsidian knowledge vault. Use when the user wants to inspect knowledge accuracy, structure health, evidence coverage, broken links, stale concepts, orphan notes, or missing log trails. This workflow complements doctor: doctor checks environment and installation, while lint checks vault content quality.
---

# Vaultwright Lint

## Purpose
- Inspect knowledge quality and traceability inside the active Obsidian vault.
- Produce a durable lint report note when the user explicitly asks for one or when `--apply` is used.

## Required preflight
1. Detect the active vault with `obsidian vault info=path`.
2. Read the operating bundle first:
   - `00_system/system.md`
   - `00_system/index.md`
   - `01_ai_core/active_context.md`
   - `05_knowledge/manuals/codex_native_workflow.md`
3. Run `scripts/lint_knowledge_vault.py` in read-only mode first.

## Lint workflow
1. Inspect the current vault for:
   - pending raw/register notes
   - processed raw notes missing synthesis targets
   - raw/source notes whose `claim_count` disagrees with actual claim blocks
   - stable knowledge notes missing sources
   - stable knowledge notes that only cite note-level sources instead of heading/block evidence
   - claim blocks without source references
   - broken wikilinks or missing source targets
   - stale or orphan concepts
   - important notes missing from `00_system/index.md`
   - recent ingest/refine/distill sessions with weak log trails
2. Summarize results by severity:
   - `error`
   - `warning`
   - `info`
3. Suggest the next command based on the strongest issue class.
4. Only write the report note when the user explicitly wants a durable report or when the command is run with `--apply`.

## Guardrails
- Lint is read-only by default.
- Do not auto-fix stable knowledge notes.
- Do not create an external raw/wiki directory system.
- Use the report to guide `query`, `refine`, or `distill`; do not silently mutate the vault from lint mode.
