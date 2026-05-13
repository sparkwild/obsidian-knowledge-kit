# Client Auto-Configuration

The Agent Connections view helps users connect AI tools to Wiki Weaver without exposing repository checkout paths or developer machine details.

## Principles

- Do not point clients to the source tree.
- Do not hardcode a vault path.
- Use the built-in loopback Runtime defaults unless the user changes them.
- Prefer the MCP URL from plugin settings.
- Use SSE only for legacy clients that explicitly need it.
- Use stdio only when a client asks for command/args configuration.
- Never auto-configure from an agent call; configuration writes are user-triggered in Obsidian only.

## Supported Client Profiles

| Client | Preferred connection | Auto-config status |
| --- | --- | --- |
| Codex | MCP URL | User-confirmed config file merge when supported. |
| Claude Code | CLI command | Copy command for user execution. |
| Claude Desktop | MCP URL | User-confirmed JSON merge when supported. |
| Cursor | MCP URL | Copy config until a stable write target is available. |
| Custom | MCP URL or stdio | Copy config only. |

## Safe Write Flow

1. Detect whether a supported client config file exists.
2. Generate only the `wiki-weaver` MCP server block.
3. Show target file and config preview.
4. Wait for user confirmation.
5. Create a backup.
6. Merge or replace only the `wiki-weaver` block.
7. Leave all other MCP servers untouched.
8. Record an audit event.

## Removal Flow

Removal uses the same confirmation and backup flow. It deletes only the `wiki-weaver` MCP server block and never deletes the whole client config file.

## Mobile Behavior

On mobile or unsupported platforms, the plugin should show copyable instructions only. It should not attempt local config file writes.
