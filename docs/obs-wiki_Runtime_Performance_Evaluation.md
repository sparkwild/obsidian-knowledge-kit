# obs-wiki Runtime Performance Evaluation

Version: 2026-05-10
Status: decision memo
Scope: performance assessment and migration criteria only. This document does not approve replacing the Python runtime.

## Current Decision

Do not replace the Python runtime now.

obs-wiki should first stabilize Python plus `uv`, benchmark the current query/lint paths, and add incremental indexing only where measurements prove it is needed. MCP adapter language choice can be independent from the core runtime.

## Python Runtime Strengths

- Easy to maintain and review.
- Easy for Codex to modify in small, targeted patches.
- Compatible with the current `scripts/` and `lib/` layout.
- Well suited to rapid iteration on knowledge workflows.
- Natural fit for Markdown, frontmatter, Obsidian note paths, wikilinks, and report generation.
- Existing CLI contracts already support JSON output and preview/apply modes.

## Potential Bottlenecks

- Large vault full scans.
- Broken link checks across many notes.
- Claim/evidence lint across stable knowledge and raw/source notes.
- Context pack ranking over large note sets.
- Repeated frontmatter parsing in multiple modules.
- Obsidian CLI process startup overhead.
- Multiple scripts repeatedly scanning the same vault in a single workflow.

## Short-Term Optimization Plan

- Keep Python as the default runtime.
- Introduce `uv` for Python project management, tool execution, dependencies, and lock files.
- Add benchmark scripts before changing runtime language.
- Add a lightweight index cache for note metadata, links, headings, block IDs, claim blocks, and source references.
- Reduce duplicate scans across context pack, lint, source reconciliation, and dashboards.
- Keep active vault detection behind a runtime abstraction.
- Cache low-risk Obsidian CLI calls within a single run.
- Avoid per-note Obsidian CLI subprocess calls during bulk read-only scans once the active vault is confirmed.
- Add parameters such as `--limit`, `--scope`, and `--changed` to context pack and lint commands.

## Medium-Term Evaluation

Evaluate an index layer when benchmark data shows repeated scans are becoming expensive.

Candidate index shapes:

- SQLite database with FTS for vault search.
- Incremental index keyed by file path, mtime, size, and content hash.
- JSON metadata cache for small and medium vaults.
- Cached frontmatter, wikilinks, headings, block IDs, claim blocks, source refs, and note type.
- Incremental link graph that updates changed notes instead of rebuilding every run.

Open questions:

- Should the index live inside the vault, inside `$CODEX_HOME`, or in an OS cache directory?
- Which fields are stable enough to cache without surprising users?
- How should stale cache entries be reported and invalidated?
- Which workflows need exact current data versus acceptable cached previews?

## Long-Term Replacement Candidates

### Rust Core

Best suited for high-performance scanning, parsing, indexing, link graph construction, and optional full-text search. Consider only if benchmarks show Python remains too slow after lower-cost optimization.

### Go Core

Good fit for a simple cross-platform binary and concurrent file scanning. Consider if packaging simplicity matters more than maximum parsing/indexing performance.

### TypeScript MCP Adapter

Good fit for an AI-facing MCP adapter. It can remain a thin layer over the Python CLI/shared runtime and should not imply a full runtime rewrite.

### Python MCP Adapter

Good fit for the smallest MVP if keeping one language stack is more important than ecosystem familiarity. It should still stay decoupled from the execution kernel.

## Benchmark Thresholds

Use measured data before approving a lower-level performance core.

Initial scaffold:

```bash
python3 scripts/benchmark_runtime.py --fixture-notes 100 --runs 1 --json
```

The scaffold generates a temporary synthetic vault by default, runs `build_context_pack` and `lint_knowledge_vault` in read-only mode, and reports timing, read counts, subprocess counts, Obsidian CLI calls, bytes read, and peak memory.

Suggested initial targets:

- 1,000 notes: context pack under 2 seconds, lint under 5 seconds.
- 5,000 notes: context pack under 5 seconds, lint under 12 seconds.
- 10,000 notes: context pack under 8 seconds, lint under 20 seconds.
- Normal peak memory under 512 MB.
- Bulk scans should not start one Obsidian CLI subprocess per note.

Benchmark reports should include:

- cold and warm runtime
- note count and bytes scanned
- subprocess count
- Obsidian CLI call count
- direct file read count
- peak memory
- output size
- error count

## Decision Recommendation

- Do not fully replace Python now.
- Use Python plus `uv`, benchmarks, runtime abstraction, and incremental index work first.
- Consider SQLite/FTS or JSON cache before Rust/Go.
- Consider Rust or Go only when benchmark results prove lint or context pack performance is a product bottleneck at large-vault scale.
- Keep MCP adapter language independent from runtime language.
- Do not rewrite the core merely because MCP is being introduced.

## Non-Goals

- No full Python runtime rewrite in the current phase.
- No complete MCP server implementation in this phase.
- No heavy dependency stack before benchmark evidence exists.
- No vault-external raw/wiki knowledge system.
- No change to the rule that the active Obsidian vault is the only knowledge carrier.
