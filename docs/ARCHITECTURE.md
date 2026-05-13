# Architecture

Wiki Weaver turns an Obsidian vault into a local memory and knowledge layer for AI assistants.

```text
AI assistant
  -> MCP client connection
  -> Obsidian-hosted Streamable HTTP MCP Runtime
  -> shared vault/runtime logic
  -> Obsidian vault files
  -> Obsidian plugin review surface
```

## Responsibilities

| Layer | Responsibility |
| --- | --- |
| AI assistant | Starts URL/file/source analysis, recall, context, lint, distill, and proposal work. |
| MCP Runtime | Exposes Streamable HTTP tools, manages local sessions, and records auditable activity. |
| Core package | Provides scanning, recall, source analysis, context pack, lint, and safety helpers. |
| Obsidian plugin | Shows activity, review queue, audit, permission policy, runtime status, and AI tool connection setup. |
| Obsidian vault | Stores durable notes, review queue items, source records, session notes, context packs, and audit logs. |

## Non-Goals

- The Obsidian plugin is not a source submission UI.
- The plugin does not run maintenance actions such as Analyze URL, Analyze File, Capture Source, Build Context Pack, Run Lint, or Run Distill.
- Wiki Weaver does not require a hosted backend.
- Wiki Weaver ships with a default loopback Runtime port, but does not assume a fixed repository checkout path.

## Vault Scope

The plugin uses the currently open Obsidian vault. The MCP Runtime is started by the desktop plugin and supplies that vault root to all tool calls. All file operations must remain inside that vault unless the user explicitly confirms a client configuration file change.
