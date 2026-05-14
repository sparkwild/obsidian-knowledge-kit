# Client Auto-Configuration

The Agent Connections view helps users connect AI tools to Tracekeeper without exposing repository checkout paths or developer machine details.

## Principles

- Do not point clients to the source tree.
- Do not hardcode a vault path.
- Use the Obsidian-hosted Streamable HTTP Runtime URL.
- Include the generated local token in client configuration.
- Do not offer SSE or stdio connection modes.
- Never auto-configure from an agent call; configuration writes are user-triggered in Obsidian only.

## Supported Client Profiles

| Client | Preferred connection | Auto-config status |
| --- | --- | --- |
| Codex | Streamable HTTP URL | User-confirmed config file merge when supported. |
| Claude Code | Streamable HTTP CLI command | Copy command for user execution. |
| Claude Desktop | Streamable HTTP URL | User-confirmed JSON merge when supported. |
| Cursor | Streamable HTTP URL | Copy config until a stable write target is available. |
| Custom | Streamable HTTP URL | Copy config only. |

## Safe Write Flow

1. Detect whether a supported client config file exists.
2. Generate only the `tracekeeper` MCP server block.
3. Show target file and config preview.
4. Wait for user confirmation.
5. Create a backup.
6. Merge or replace only the `tracekeeper` block.
7. Leave all other MCP servers untouched.
8. Record an audit event.

## Removal Flow

Removal uses the same confirmation and backup flow. It deletes only the `tracekeeper` MCP server block and never deletes the whole client config file.

## Runtime Dependency

Client configuration only works while desktop Obsidian is open and the Tracekeeper plugin is enabled, because the MCP Runtime is hosted by Obsidian.
