from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from .context_loader import detect_active_vault
from .context_pack import build_context_pack
from .knowledge_lint import build_lint_report, parse_frontmatter
from .obsidian_runtime import (
    detect_active_vault_info,
    list_markdown_notes,
    read_note_content,
)

PROTOCOL_VERSION = "2025-06-18"
SERVER_NAME = "obs-wiki-mcp-adapter"
SERVER_VERSION = "0.1.0"
TEXT_MARKDOWN = "text/markdown"
TEXT_PLAIN = "text/plain"
DENIED_NOTE_PREFIXES = (".obsidian/", ".trash/")
CORE_NOTES = (
    "00_system/system.md",
    "00_system/index.md",
    "01_ai_core/active_context.md",
    "01_ai_core/longterm_context.md",
    "05_knowledge/manuals/codex_native_workflow.md",
)


class McpError(Exception):
    def __init__(self, code: int, message: str, data: Any | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


@dataclass
class AdapterConfig:
    vault_path: Path | None = None


def json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def text_tool_result(payload: dict, is_error: bool = False) -> dict:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def tool_error(message: str, **extra: Any) -> dict:
    payload = {"ok": False, "error": message}
    payload.update(extra)
    return text_tool_result(payload, is_error=True)


def coerce_int(value: Any, default: int, minimum: int = 1, maximum: int | None = None) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise McpError(-32602, f"Expected integer value, got {value!r}")
    if parsed < minimum:
        parsed = minimum
    if maximum is not None and parsed > maximum:
        parsed = maximum
    return parsed


def coerce_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raise McpError(-32602, f"Expected boolean value, got {value!r}")


def safe_note_path(raw_path: str) -> str:
    if raw_path.startswith("obs-wiki://note/"):
        raw_path = raw_path.removeprefix("obs-wiki://note/")
    path = unquote(raw_path).strip().replace("\\", "/").lstrip("/")
    if not path:
        raise McpError(-32602, "Note path is required.")
    if path.startswith(DENIED_NOTE_PREFIXES):
        raise McpError(-32602, f"Refusing to read restricted vault path: {path}")
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise McpError(-32602, f"Refusing to read path outside the vault: {raw_path}")
    if not path.endswith(".md"):
        path = f"{path}.md"
    return path


def latest_note_in(vault_path: Path, folder: str, name_prefix: str | None = None) -> str | None:
    try:
        notes = list_markdown_notes(vault_path, folder=folder)
    except FileNotFoundError:
        return None
    if name_prefix:
        notes = [note for note in notes if Path(note).name.startswith(name_prefix)]
    return sorted(notes)[-1] if notes else None


def compact_note(content: str, max_chars: int) -> tuple[str, bool]:
    if len(content) <= max_chars:
        return content, False
    return content[:max_chars], True


class ObsWikiMcpAdapter:
    def __init__(self, config: AdapterConfig) -> None:
        self.config = config

    def resolve_vault_path(self) -> Path:
        if self.config.vault_path is not None:
            return self.config.vault_path.expanduser().resolve()
        active = detect_active_vault()
        if active is None:
            raise RuntimeError("Could not detect an active Obsidian vault. Start Obsidian or launch with --vault.")
        return active.expanduser().resolve()

    def status(self) -> dict:
        active_info = detect_active_vault_info()
        configured = self.config.vault_path.expanduser().resolve() if self.config.vault_path else None
        vault_path = configured or (active_info.path.expanduser().resolve() if active_info else None)
        core_notes = []
        latest_context_pack = None
        latest_lint_report = None
        if vault_path is not None:
            core_notes = [
                {
                    "path": note_path,
                    "exists": read_note_content(vault_path, note_path) is not None,
                }
                for note_path in CORE_NOTES
            ]
            latest_context_pack = latest_note_in(vault_path, "01_ai_core/context_packs", name_prefix="context_")
            latest_lint_report = latest_note_in(vault_path, "00_system/reports", name_prefix="knowledge_lint_")

        return {
            "ok": vault_path is not None,
            "read_only": True,
            "active_vault": {
                "name": active_info.name if active_info else None,
                "path": str(active_info.path) if active_info else None,
            },
            "configured_vault_path": str(configured) if configured else None,
            "effective_vault_path": str(vault_path) if vault_path else None,
            "core_notes": core_notes,
            "latest_context_pack": latest_context_pack,
            "latest_lint_report": latest_lint_report,
            "tools": [tool["name"] for tool in TOOLS],
        }

    def query(self, arguments: dict) -> dict:
        query = str(arguments.get("query") or "").strip()
        if not query:
            raise McpError(-32602, "`query` is required.")
        candidate_limit = coerce_int(arguments.get("candidate_limit"), default=8, minimum=1, maximum=50)
        read_limit = coerce_int(arguments.get("read_limit"), default=5, minimum=0, maximum=25)
        include_note_content = coerce_bool(arguments.get("include_note_content"), default=False)
        vault_path = self.resolve_vault_path()
        pack = build_context_pack(
            vault_path=vault_path,
            query=query,
            candidate_limit=candidate_limit,
            read_limit=read_limit,
        )
        payload = dict(pack)
        payload["read_only"] = True
        payload["written_path"] = None
        if not include_note_content:
            payload.pop("note_content", None)
        return payload

    def lint(self, arguments: dict) -> dict:
        stale_days = coerce_int(arguments.get("stale_days"), default=30, minimum=1, maximum=3650)
        session_limit = coerce_int(arguments.get("session_limit"), default=8, minimum=0, maximum=100)
        issue_limit = coerce_int(arguments.get("issue_limit"), default=50, minimum=0, maximum=500)
        include_report_content = coerce_bool(arguments.get("include_report_content"), default=False)
        vault_path = self.resolve_vault_path()
        report = build_lint_report(vault_path=vault_path, stale_days=stale_days, session_limit=session_limit)
        payload = dict(report)
        payload["read_only"] = True
        payload["written_path"] = None
        payload["issues"] = payload["issues"][:issue_limit]
        payload["issue_limit"] = issue_limit
        if not include_report_content:
            payload.pop("report_content", None)
        return payload

    def read_note(self, arguments: dict) -> dict:
        raw_path = str(arguments.get("path") or "").strip()
        note_path = safe_note_path(raw_path)
        max_chars = coerce_int(arguments.get("max_chars"), default=20000, minimum=1, maximum=200000)
        vault_path = self.resolve_vault_path()
        content = read_note_content(vault_path, note_path)
        if content is None:
            raise RuntimeError(f"Note not found inside active vault: {note_path}")
        text, truncated = compact_note(content, max_chars=max_chars)
        return {
            "ok": True,
            "read_only": True,
            "path": note_path,
            "mimeType": TEXT_MARKDOWN,
            "text": text,
            "truncated": truncated,
            "max_chars": max_chars,
        }

    def review_queue(self, arguments: dict) -> dict:
        limit = coerce_int(arguments.get("limit"), default=20, minimum=1, maximum=200)
        vault_path = self.resolve_vault_path()
        lint_report = build_lint_report(vault_path=vault_path, stale_days=30, session_limit=8)
        pending_raw = []
        knowledge_gaps = []
        unverified_claims = []

        for note_path in list_markdown_notes(vault_path):
            if note_path.startswith(DENIED_NOTE_PREFIXES):
                continue
            content = read_note_content(vault_path, note_path)
            if content is None:
                continue
            frontmatter, _body = parse_frontmatter(content)
            title = str(frontmatter.get("title") or Path(note_path).stem)
            note_type = str(frontmatter.get("type") or "")
            tags = frontmatter.get("tags") if isinstance(frontmatter.get("tags"), list) else []
            tags_lower = [str(tag).lower() for tag in tags]
            status_blob = " ".join(
                str(frontmatter.get(key) or "").lower()
                for key in ("ingest_status", "capture_status", "distill_status", "verification_status", "status")
            )

            if len(pending_raw) < limit and note_path.startswith("03_raw/") and any(
                marker in status_blob for marker in ("pending", "todo", "unverified", "needs-review")
            ):
                pending_raw.append({"path": note_path, "title": title, "type": note_type, "status": status_blob})

            if len(knowledge_gaps) < limit and (
                "gap" in note_path.lower()
                or "gap" in title.lower()
                or "knowledge-gap" in tags_lower
                or "gap" in tags_lower
            ):
                knowledge_gaps.append({"path": note_path, "title": title, "type": note_type, "tags": tags})

            if len(unverified_claims) < limit and any(
                marker in status_blob for marker in ("unverified", "pending-verification", "needs-review")
            ):
                unverified_claims.append({"path": note_path, "title": title, "type": note_type, "status": status_blob})

        stale_concepts = [
            issue for issue in lint_report["issues"] if issue["code"] == "stale_concept"
        ][:limit]
        source_issues = [
            issue
            for issue in lint_report["issues"]
            if issue["code"]
            in {
                "pending_raw_source",
                "claim_without_source",
                "stable_knowledge_missing_sources",
                "knowledge_sources_missing_block_refs",
                "missing_source_target",
            }
        ][:limit]

        return {
            "ok": True,
            "read_only": True,
            "vault_path": str(vault_path),
            "limit": limit,
            "lint_summary": lint_report["summary"],
            "pending_raw_sources": pending_raw,
            "knowledge_gaps": knowledge_gaps,
            "unverified_claims": unverified_claims,
            "stale_concepts": stale_concepts,
            "source_issues": source_issues,
            "latest_lint_report_path": lint_report["report_path"],
        }

    def call_tool(self, name: str, arguments: dict) -> dict:
        try:
            if name == "obs_wiki_status":
                return text_tool_result(self.status())
            if name == "obs_wiki_query":
                return text_tool_result(self.query(arguments))
            if name == "obs_wiki_lint":
                return text_tool_result(self.lint(arguments))
            if name == "obs_wiki_read_note":
                return text_tool_result(self.read_note(arguments))
            if name == "obs_wiki_review_queue":
                return text_tool_result(self.review_queue(arguments))
            raise McpError(-32602, f"Unknown tool: {name}")
        except McpError as exc:
            if exc.code == -32602:
                raise
            return tool_error(exc.message, data=exc.data)
        except Exception as exc:
            return tool_error(str(exc))

    def read_resource(self, uri: str) -> dict:
        vault_path = self.resolve_vault_path()
        resource_map = {
            "obs-wiki://system": "00_system/system.md",
            "obs-wiki://active-context": "01_ai_core/active_context.md",
            "obs-wiki://index": "00_system/index.md",
        }
        if uri == "obs-wiki://context-pack/latest":
            note_path = latest_note_in(vault_path, "01_ai_core/context_packs", name_prefix="context_")
        elif uri == "obs-wiki://lint/latest":
            note_path = latest_note_in(vault_path, "00_system/reports", name_prefix="knowledge_lint_")
        elif uri.startswith("obs-wiki://note/"):
            note_path = safe_note_path(uri)
        else:
            note_path = resource_map.get(uri)
        if note_path is None:
            raise McpError(-32002, "Resource not found", {"uri": uri})
        content = read_note_content(vault_path, note_path)
        if content is None:
            raise McpError(-32002, "Resource not found", {"uri": uri, "path": note_path})
        return {
            "contents": [
                {
                    "uri": uri,
                    "mimeType": TEXT_MARKDOWN,
                    "text": content,
                }
            ]
        }


TOOLS = [
    {
        "name": "obs_wiki_status",
        "title": "obs-wiki Status",
        "description": "Report active vault, core note availability, and latest obs-wiki context/lint artifacts. Read-only.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "obs_wiki_query",
        "title": "obs-wiki Query",
        "description": "Build a read-only context pack preview for a knowledge question without writing to the vault.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "candidate_limit": {"type": "integer", "minimum": 1, "maximum": 50},
                "read_limit": {"type": "integer", "minimum": 0, "maximum": 25},
                "include_note_content": {"type": "boolean"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "obs_wiki_lint",
        "title": "obs-wiki Lint",
        "description": "Run a read-only knowledge lint preview and return summary/issues without writing a report note.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "stale_days": {"type": "integer", "minimum": 1, "maximum": 3650},
                "session_limit": {"type": "integer", "minimum": 0, "maximum": 100},
                "issue_limit": {"type": "integer", "minimum": 0, "maximum": 500},
                "include_report_content": {"type": "boolean"},
            },
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "obs_wiki_read_note",
        "title": "obs-wiki Read Note",
        "description": "Read one Markdown note from the bound active vault. Refuses absolute paths, parent traversal, and restricted vault paths.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "max_chars": {"type": "integer", "minimum": 1, "maximum": 200000},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "obs_wiki_review_queue",
        "title": "obs-wiki Review Queue",
        "description": "List pending raw sources, knowledge gaps, unverified claims, stale concepts, and source-related lint issues. Read-only.",
        "inputSchema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 200}},
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
]


RESOURCES = [
    {
        "uri": "obs-wiki://system",
        "name": "system",
        "title": "obs-wiki System",
        "description": "The active vault system note.",
        "mimeType": TEXT_MARKDOWN,
    },
    {
        "uri": "obs-wiki://active-context",
        "name": "active-context",
        "title": "Active Context",
        "description": "The active vault AI context note.",
        "mimeType": TEXT_MARKDOWN,
    },
    {
        "uri": "obs-wiki://index",
        "name": "index",
        "title": "Vault Index",
        "description": "The active vault index note.",
        "mimeType": TEXT_MARKDOWN,
    },
    {
        "uri": "obs-wiki://context-pack/latest",
        "name": "latest-context-pack",
        "title": "Latest Context Pack",
        "description": "The latest generated context pack note, when present.",
        "mimeType": TEXT_MARKDOWN,
    },
    {
        "uri": "obs-wiki://lint/latest",
        "name": "latest-lint-report",
        "title": "Latest Lint Report",
        "description": "The latest generated knowledge lint report, when present.",
        "mimeType": TEXT_MARKDOWN,
    },
]


RESOURCE_TEMPLATES = [
    {
        "uriTemplate": "obs-wiki://note/{path}",
        "name": "vault-note",
        "title": "Vault Note",
        "description": "Read a single Markdown note within the bound active Obsidian vault.",
        "mimeType": TEXT_MARKDOWN,
    }
]


PROMPTS = [
    {
        "name": "obs-wiki Query",
        "title": "obs-wiki Query",
        "description": "Build or inspect a context pack before answering a knowledge question.",
        "arguments": [{"name": "query", "description": "The user question.", "required": True}],
    },
    {
        "name": "obs-wiki Lint",
        "title": "obs-wiki Lint",
        "description": "Inspect vault knowledge health without auto-fixing.",
        "arguments": [],
    },
]


def prompt_messages(name: str, arguments: dict[str, Any]) -> dict:
    if name == "obs-wiki Query":
        query = str(arguments.get("query") or "").strip()
        if not query:
            raise McpError(-32602, "`query` is required.")
        text = (
            "Use the obs-wiki MCP adapter in read-only mode. "
            "Call `obs_wiki_query` first, read only the highest-value candidate notes, "
            "and cite Obsidian note paths or block references when possible.\n\n"
            f"Question: {query}"
        )
        return {"description": "obs-wiki query workflow", "messages": [{"role": "user", "content": {"type": "text", "text": text}}]}
    if name == "obs-wiki Lint":
        text = (
            "Use the obs-wiki MCP adapter in read-only mode. "
            "Call `obs_wiki_lint`, inspect errors/warnings, and recommend next actions without modifying the vault."
        )
        return {"description": "obs-wiki lint workflow", "messages": [{"role": "user", "content": {"type": "text", "text": text}}]}
    raise McpError(-32602, f"Unknown prompt: {name}")


class StdioMcpServer:
    def __init__(self, adapter: ObsWikiMcpAdapter) -> None:
        self.adapter = adapter

    def run(self) -> int:
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                message = json.loads(line)
                if isinstance(message, list):
                    for response in self.handle_batch(message):
                        self.write_response(response)
                else:
                    response = self.handle_message(message)
                    if response is not None:
                        self.write_response(response)
            except json.JSONDecodeError as exc:
                self.write_response({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": str(exc)}})
        return 0

    def handle_batch(self, messages: list[Any]) -> list[dict]:
        responses = []
        for item in messages:
            response = self.handle_message(item)
            if response is not None:
                responses.append(response)
        return responses

    def handle_message(self, message: Any) -> dict | None:
        if not isinstance(message, dict):
            return self.error(None, -32600, "Invalid Request")
        request_id = message.get("id")
        method = message.get("method")
        if not method:
            return self.error(request_id, -32600, "Invalid Request")
        is_notification = "id" not in message
        try:
            result = self.dispatch(method, message.get("params") or {})
            if is_notification:
                return None
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except McpError as exc:
            if is_notification:
                return None
            return self.error(request_id, exc.code, exc.message, exc.data)
        except Exception as exc:
            if is_notification:
                return None
            return self.error(request_id, -32603, str(exc))

    def dispatch(self, method: str, params: dict) -> dict:
        if method == "initialize":
            return {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"listChanged": False},
                    "prompts": {"listChanged": False},
                },
                "serverInfo": {"name": SERVER_NAME, "title": "obs-wiki MCP Adapter", "version": SERVER_VERSION},
                "instructions": "obs-wiki MCP Adapter is read-only by default and delegates to obs-wiki shared runtime.",
            }
        if method == "notifications/initialized":
            return {}
        if method == "ping":
            return {}
        if method == "tools/list":
            return {"tools": TOOLS}
        if method == "tools/call":
            name = str(params.get("name") or "")
            arguments = params.get("arguments") or {}
            if not isinstance(arguments, dict):
                raise McpError(-32602, "`arguments` must be an object.")
            return self.adapter.call_tool(name, arguments)
        if method == "resources/list":
            return {"resources": RESOURCES}
        if method == "resources/templates/list":
            return {"resourceTemplates": RESOURCE_TEMPLATES}
        if method == "resources/read":
            uri = str(params.get("uri") or "")
            if not uri:
                raise McpError(-32602, "`uri` is required.")
            return self.adapter.read_resource(uri)
        if method == "prompts/list":
            return {"prompts": PROMPTS}
        if method == "prompts/get":
            name = str(params.get("name") or "")
            arguments = params.get("arguments") or {}
            if not isinstance(arguments, dict):
                raise McpError(-32602, "`arguments` must be an object.")
            return prompt_messages(name, arguments)
        raise McpError(-32601, f"Method not found: {method}")

    def error(self, request_id: Any, code: int, message: str, data: Any | None = None) -> dict:
        payload = {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}
        if data is not None:
            payload["error"]["data"] = data
        return payload

    def write_response(self, response: dict) -> None:
        sys.stdout.write(json_dumps(response) + "\n")
        sys.stdout.flush()
