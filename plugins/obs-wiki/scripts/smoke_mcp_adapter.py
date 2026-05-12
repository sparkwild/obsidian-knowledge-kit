#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from benchmark_runtime import create_fixture_vault


def request(request_id: int, method: str, params: dict | None = None) -> dict:
    payload = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        payload["params"] = params
    return payload


def run_smoke() -> dict:
    script_root = Path(__file__).resolve().parents[1]
    vault_path = create_fixture_vault(12)
    messages = [
        request(
            1,
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "obs-wiki-smoke", "version": "0.1.0"},
            },
        ),
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        request(2, "tools/list"),
        request(3, "tools/call", {"name": "obs_wiki_status", "arguments": {}}),
        request(4, "tools/call", {"name": "obs_wiki_query", "arguments": {"query": "benchmark evidence"}}),
        request(5, "tools/call", {"name": "obs_wiki_lint", "arguments": {"issue_limit": 10}}),
        request(6, "tools/call", {"name": "obs_wiki_read_note", "arguments": {"path": "00_system/system.md"}}),
        request(7, "tools/call", {"name": "obs_wiki_review_queue", "arguments": {"limit": 5}}),
        request(8, "resources/list"),
        request(9, "resources/read", {"uri": "obs-wiki://system"}),
        request(10, "prompts/list"),
        request(11, "tools/call", {"name": "obs_wiki_read_note", "arguments": {"path": "../outside.md"}}),
    ]
    input_text = "\n".join(json.dumps(message, ensure_ascii=False) for message in messages) + "\n"
    try:
        proc = subprocess.run(
            [sys.executable, str(script_root / "scripts" / "mcp_adapter.py"), "--vault", str(vault_path)],
            input=input_text,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    finally:
        shutil.rmtree(vault_path, ignore_errors=True)

    if proc.returncode != 0:
        raise RuntimeError(f"mcp_adapter exited with {proc.returncode}: {proc.stderr}")

    responses = [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]
    response_ids = {response.get("id") for response in responses}
    expected_ids = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}
    missing = sorted(expected_ids - response_ids)
    if missing:
        raise RuntimeError(f"Missing MCP responses for ids: {missing}")

    expected_error_ids = {11}
    errors = [
        response
        for response in responses
        if "error" in response and response.get("id") not in expected_error_ids
    ]
    expected_errors = [
        response
        for response in responses
        if "error" in response and response.get("id") in expected_error_ids
    ]
    if len(expected_errors) != len(expected_error_ids):
        raise RuntimeError("Expected unsafe path read to be rejected.")
    tool_errors = [
        response
        for response in responses
        if response.get("result", {}).get("isError") is True
    ]
    if errors or tool_errors:
        raise RuntimeError(f"MCP smoke found errors: {errors or tool_errors}")

    tools = next(response["result"]["tools"] for response in responses if response.get("id") == 2)
    tool_names = sorted(tool["name"] for tool in tools)
    required_tools = {
        "obs_wiki_status",
        "obs_wiki_query",
        "obs_wiki_lint",
        "obs_wiki_read_note",
        "obs_wiki_review_queue",
    }
    missing_tools = sorted(required_tools - set(tool_names))
    if missing_tools:
        raise RuntimeError(f"Missing MCP tools: {missing_tools}")

    return {
        "ok": True,
        "responses": len(responses),
        "tools": tool_names,
    }


def main() -> int:
    print(json.dumps(run_smoke(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
