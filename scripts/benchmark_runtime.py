#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import time
import tracemalloc
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable

LIB = Path(__file__).resolve().parents[1] / "lib"
sys.path.insert(0, str(LIB))

from obsidian_knowledge_shared import context_loader, context_pack, knowledge_lint, obsidian_runtime
from obsidian_knowledge_shared.context_pack import build_context_pack
from obsidian_knowledge_shared.knowledge_lint import build_lint_report


DEFAULT_QUERY = "benchmark context pack lint evidence source"


@dataclass
class RuntimeCounters:
    read_paths: set[str] = field(default_factory=set)
    bytes_read: int = 0
    direct_file_reads: int = 0
    markdown_list_calls: int = 0
    subprocess_count: int = 0
    obsidian_cli_calls: int = 0


class RuntimeInstrumentation:
    def __init__(self, counters: RuntimeCounters, disable_obsidian_cli_detection: bool) -> None:
        self.counters = counters
        self.disable_obsidian_cli_detection = disable_obsidian_cli_detection
        self.originals: list[tuple[object, str, object]] = []

    def patch(self, module: object, name: str, replacement: object) -> None:
        self.originals.append((module, name, getattr(module, name)))
        setattr(module, name, replacement)

    def __enter__(self) -> RuntimeCounters:
        original_read = obsidian_runtime.read_note_content
        original_list = obsidian_runtime.list_markdown_notes
        original_run_obsidian = obsidian_runtime._run_obsidian

        def tracked_read_note_content(vault_path: Path, note_path: str) -> str | None:
            self.counters.direct_file_reads += 1
            self.counters.read_paths.add(note_path)
            absolute = vault_path / note_path
            if absolute.exists():
                self.counters.bytes_read += absolute.stat().st_size
            return original_read(vault_path, note_path)

        def tracked_list_markdown_notes(vault_path: Path, folder: str | None = None) -> list[str]:
            self.counters.markdown_list_calls += 1
            return original_list(vault_path, folder=folder)

        def tracked_run_obsidian(args: list[str], timeout: int = 20):
            self.counters.subprocess_count += 1
            self.counters.obsidian_cli_calls += 1
            return original_run_obsidian(args, timeout=timeout)

        self.patch(obsidian_runtime, "read_note_content", tracked_read_note_content)
        self.patch(obsidian_runtime, "list_markdown_notes", tracked_list_markdown_notes)
        self.patch(obsidian_runtime, "_run_obsidian", tracked_run_obsidian)
        self.patch(context_pack, "read_note_content", tracked_read_note_content)
        self.patch(context_pack, "list_markdown_note_paths", tracked_list_markdown_notes)
        self.patch(context_loader, "read_note_content", tracked_read_note_content)
        self.patch(context_loader, "list_markdown_notes", tracked_list_markdown_notes)
        self.patch(knowledge_lint, "read_note_content", tracked_read_note_content)
        self.patch(knowledge_lint, "list_markdown_note_paths", tracked_list_markdown_notes)

        if self.disable_obsidian_cli_detection:
            self.patch(obsidian_runtime, "detect_active_vault_info", lambda: None)

        return self.counters

    def __exit__(self, exc_type, exc, tb) -> None:
        for module, name, original in reversed(self.originals):
            setattr(module, name, original)
        obsidian_runtime.detect_active_vault_info.cache_clear()


def write_note(vault_path: Path, relative_path: str, content: str) -> None:
    target = vault_path / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def frontmatter(title: str, note_type: str, tags: list[str] | None = None, sources: list[str] | None = None) -> str:
    lines = [
        "---",
        f"title: {title}",
        f"created: {datetime.now().date().isoformat()}",
        f"updated: {datetime.now().date().isoformat()}",
        f"type: {note_type}",
    ]
    if tags:
        lines.append("tags:")
        lines.extend(f"  - {tag}" for tag in tags)
    if sources:
        lines.append("sources:")
        lines.extend(f"  - {source}" for source in sources)
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def create_fixture_vault(note_count: int, root: Path | None = None) -> Path:
    vault_path = Path(tempfile.mkdtemp(prefix="vaultwright-benchmark-", dir=str(root) if root else None))
    created = datetime.now().isoformat(timespec="seconds")

    write_note(
        vault_path,
        "00_system/system.md",
        frontmatter("System", "system") + "# System\n\nVaultwright benchmark fixture.\n",
    )
    write_note(
        vault_path,
        "00_system/index.md",
        frontmatter("Index", "index") + "# Index\n\n- [[05_knowledge/benchmark/note_0001|Benchmark note]]\n",
    )
    write_note(
        vault_path,
        "00_system/log.md",
        frontmatter("Log", "log") + f"# Log\n\n- {created} benchmark fixture created.\n",
    )
    write_note(
        vault_path,
        "01_ai_core/active_context.md",
        frontmatter("Active Context", "context", tags=["benchmark"]) + "# Active Context\n\nFocus: benchmark context pack and lint.\n",
    )
    write_note(
        vault_path,
        "01_ai_core/longterm_context.md",
        frontmatter("Longterm Context", "context", tags=["benchmark"]) + "# Longterm Context\n\nVaultwright performance baseline.\n",
    )
    write_note(
        vault_path,
        "04_projects/benchmark/project_overview.md",
        frontmatter("Benchmark Project", "project", tags=["benchmark"]) + "# Benchmark Project\n\nMeasure query and lint runtime.\n",
    )
    write_note(
        vault_path,
        "05_knowledge/manuals/codex_native_workflow.md",
        frontmatter("Codex Native Workflow", "manual") + "# Codex Native Workflow\n\nRead system context before work.\n",
    )
    write_note(
        vault_path,
        "05_knowledge/manuals/external_material_ingest_guide.md",
        frontmatter("External Material Ingest Guide", "manual") + "# External Material Ingest Guide\n\nPreview before apply.\n",
    )
    write_note(
        vault_path,
        "02_timeline/sessions/session_20260510_benchmark.md",
        frontmatter("Benchmark Session", "session") + "# Benchmark Session\n\nRan benchmark fixture for query and lint.\n",
    )

    claim_blocks = []
    for index in range(1, note_count + 1):
        block_id = f"claim-{index:04d}"
        claim_blocks.append(
            f"> [!claim] Benchmark claim {index}\n"
            f"> source: [[03_raw/registers/benchmark_source.md#^{block_id}]]\n"
            f"^{block_id}\n"
        )
    write_note(
        vault_path,
        "03_raw/registers/benchmark_source.md",
        frontmatter("Benchmark Source", "raw", tags=["benchmark"]) + "# Benchmark Source\n\n" + "\n".join(claim_blocks),
    )

    for index in range(1, note_count + 1):
        source_ref = f"03_raw/registers/benchmark_source.md#^claim-{index:04d}"
        link_target = f"[[05_knowledge/benchmark/note_{max(1, index - 1):04d}|related note]]"
        content = (
            frontmatter(
                f"Benchmark Note {index:04d}",
                "concept",
                tags=["benchmark", "performance", "context-pack"],
                sources=[source_ref],
            )
            + f"# Benchmark Note {index:04d}\n\n"
            + "This synthetic note discusses benchmark context pack ranking, lint evidence checks, source links, and vault runtime scanning.\n\n"
            + f"Related: {link_target}\n\n"
            + f"> [!claim] Benchmark note {index} has a traceable evidence source.\n"
            + f"> source: [[03_raw/registers/benchmark_source.md#^claim-{index:04d}]]\n"
            + f"^note-claim-{index:04d}\n"
        )
        write_note(vault_path, f"05_knowledge/benchmark/note_{index:04d}.md", content)

    return vault_path


def count_fixture_notes(vault_path: Path) -> tuple[int, int]:
    paths = list(vault_path.rglob("*.md"))
    return len(paths), sum(path.stat().st_size for path in paths)


def run_measured_case(
    name: str,
    operation: Callable[[], dict],
    disable_obsidian_cli_detection: bool,
) -> dict:
    counters = RuntimeCounters()
    tracemalloc.start()
    start = time.perf_counter()
    with RuntimeInstrumentation(counters, disable_obsidian_cli_detection=disable_obsidian_cli_detection):
        result = operation()
    duration = time.perf_counter() - start
    _current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    summary: dict[str, object] = {}
    if name == "build_context_pack":
        summary = {
            "candidate_notes": len(result.get("candidate_notes", [])),
            "source_candidates": len(result.get("source_candidates", [])),
            "knowledge_gaps": len(result.get("knowledge_gaps", [])),
        }
    elif name == "lint_knowledge_vault":
        summary = result.get("summary", {})

    return {
        "name": name,
        "duration_seconds": round(duration, 6),
        "unique_notes_read": len(counters.read_paths),
        "direct_file_reads": counters.direct_file_reads,
        "markdown_list_calls": counters.markdown_list_calls,
        "bytes_read": counters.bytes_read,
        "subprocess_count": counters.subprocess_count,
        "obsidian_cli_calls": counters.obsidian_cli_calls,
        "peak_memory_bytes": peak,
        "summary": summary,
    }


def percentile(values: list[float], ratio: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round((len(ordered) - 1) * ratio)))
    return ordered[index]


def summarize_runs(runs: list[dict]) -> dict:
    by_name: dict[str, list[dict]] = {}
    for run in runs:
        by_name.setdefault(str(run["name"]), []).append(run)

    summary: dict[str, dict[str, object]] = {}
    for name, items in by_name.items():
        durations = [float(item["duration_seconds"]) for item in items]
        summary[name] = {
            "runs": len(items),
            "min_seconds": min(durations),
            "max_seconds": max(durations),
            "avg_seconds": round(sum(durations) / len(durations), 6),
            "p95_seconds": percentile(durations, 0.95),
            "max_peak_memory_bytes": max(int(item["peak_memory_bytes"]) for item in items),
        }
    return summary


def build_payload(args: argparse.Namespace) -> dict:
    generated_fixture = args.vault is None
    fixture_root = Path(args.fixture_root).expanduser() if args.fixture_root else None
    vault_path = Path(args.vault).expanduser() if args.vault else create_fixture_vault(args.fixture_notes, root=fixture_root)
    note_count, fixture_bytes = count_fixture_notes(vault_path)

    runs: list[dict] = []
    for iteration in range(1, args.runs + 1):
        context_result = run_measured_case(
            "build_context_pack",
            lambda: build_context_pack(
                vault_path=vault_path,
                query=args.query,
                candidate_limit=args.candidate_limit,
                read_limit=args.read_limit,
            ),
            disable_obsidian_cli_detection=args.disable_obsidian_cli_detection,
        )
        context_result["iteration"] = iteration
        runs.append(context_result)

        lint_result = run_measured_case(
            "lint_knowledge_vault",
            lambda: build_lint_report(vault_path, stale_days=args.stale_days, session_limit=args.session_limit),
            disable_obsidian_cli_detection=args.disable_obsidian_cli_detection,
        )
        lint_result["iteration"] = iteration
        runs.append(lint_result)

    payload = {
        "benchmark_version": "0.1",
        "created": datetime.now().isoformat(timespec="seconds"),
        "generated_fixture": generated_fixture,
        "fixture_removed": False,
        "vault": {
            "path": str(vault_path),
            "note_count": note_count,
            "bytes": fixture_bytes,
        },
        "parameters": {
            "runs": args.runs,
            "query": args.query,
            "candidate_limit": args.candidate_limit,
            "read_limit": args.read_limit,
            "stale_days": args.stale_days,
            "session_limit": args.session_limit,
            "disable_obsidian_cli_detection": args.disable_obsidian_cli_detection,
        },
        "runs": runs,
        "summary": summarize_runs(runs),
    }

    if generated_fixture and not args.keep_fixture:
        shutil.rmtree(vault_path)
        payload["fixture_removed"] = True

    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Vaultwright context pack and lint runtime paths.")
    parser.add_argument("--vault", help="Existing vault path to benchmark. Defaults to a generated temporary fixture.")
    parser.add_argument("--fixture-notes", type=int, default=100, help="Number of synthetic knowledge notes to generate.")
    parser.add_argument("--fixture-root", help="Directory for generated fixtures. Defaults to the system temp directory.")
    parser.add_argument("--keep-fixture", action="store_true", help="Keep the generated temporary fixture after the run.")
    parser.add_argument("--runs", type=int, default=1, help="Number of measured iterations.")
    parser.add_argument("--query", default=DEFAULT_QUERY, help="Query used for context pack benchmarking.")
    parser.add_argument("--candidate-limit", type=int, default=8, help="Context pack candidate limit.")
    parser.add_argument("--read-limit", type=int, default=5, help="Context pack read limit.")
    parser.add_argument("--stale-days", type=int, default=30, help="Lint stale-days threshold.")
    parser.add_argument("--session-limit", type=int, default=8, help="Lint recent session limit.")
    parser.add_argument(
        "--use-obsidian-cli-detection",
        dest="disable_obsidian_cli_detection",
        action="store_false",
        help="Allow the runtime to call Obsidian CLI active-vault detection during the benchmark.",
    )
    parser.set_defaults(disable_obsidian_cli_detection=True)
    parser.add_argument("--output", help="Optional JSON output path.")
    parser.add_argument("--json", action="store_true", help="Emit the benchmark payload as JSON.")
    args = parser.parse_args()

    if args.fixture_notes < 1:
        raise SystemExit("--fixture-notes must be at least 1")
    if args.runs < 1:
        raise SystemExit("--runs must be at least 1")

    payload = build_payload(args)

    if args.output:
        output_path = Path(args.output).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"vault_path: {payload['vault']['path']}")
        print(f"generated_fixture: {payload['generated_fixture']}")
        print(f"fixture_removed: {payload['fixture_removed']}")
        print(f"note_count: {payload['vault']['note_count']}")
        for name, summary in payload["summary"].items():
            print(f"{name}: avg={summary['avg_seconds']}s p95={summary['p95_seconds']}s runs={summary['runs']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
