---
description: Ingest a local file, directory, or URL into the active Obsidian knowledge base.
---

# Obsidian Knowledge Ingest

Bring new material into the active Obsidian knowledge base through the standard raw-to-knowledge workflow.

## Preflight

1. Confirm the active Obsidian vault:

```bash
obsidian vault info=path
```

2. Confirm required official skills:

- `obsidian-cli`
- `obsidian-markdown`

3. Add conditional checks when needed:

- URL/web source: `defuddle`
- canvas output: `json-canvas`
- base output: `obsidian-bases`

4. If the source is still missing from the user prompt, ask for exactly one source target:

- local file
- local directory
- URL

5. Create the raw source register first:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/prepare_ingest_source.py "<source>" --json
```

If you are ready to write the source register and log entry:

```bash
python3 ~/plugins/obsidian-knowledge-kit/scripts/prepare_ingest_source.py "<source>" --apply --json
```

## Workflow

Follow the bundled `obsidian-knowledge-ingest` skill.

Required flow:

1. Read:
   - `00_system/system.md`
   - `00_system/index.md`
   - `01_ai_core/active_context.md`
   - `01_ai_core/longterm_context.md`
2. Decide source mode:
   - `external_reference`
   - `extracted_snapshot`
   - `local_copy`
3. Create or update a raw source note or register first.
4. Distill the useful content into the right project or knowledge partition.
5. Update:
   - `00_system/index.md`
   - `00_system/log.md`
   - the current daily note
   - a session note if the ingest is material

## Rules

- Do not ingest everything blindly.
- Treat large middleware artifact directories as inventories first, not reading lists.
- If the ingest would create a new long-term knowledge partition, stop and ask before changing structure.
- Respond to the user in Chinese by default unless they explicitly request another language.
