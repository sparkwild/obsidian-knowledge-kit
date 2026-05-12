# obs-wiki Benchmarks

This directory documents benchmark scenarios and report expectations. The first scaffold lives in `scripts/benchmark_runtime.py` so it can run without extra dependencies.

## Runtime Benchmark

Run a smoke benchmark against a generated temporary vault:

```bash
python3 scripts/benchmark_runtime.py --fixture-notes 100 --runs 1 --json
```

The generated fixture is removed by default. To inspect it:

```bash
python3 scripts/benchmark_runtime.py --fixture-notes 100 --keep-fixture --json
```

Run against an explicit vault path only when you intend to benchmark that vault:

```bash
python3 scripts/benchmark_runtime.py --vault "/path/to/vault" --runs 3 --json
```

## Metrics

The scaffold records:

- runtime per measured case
- unique notes read
- direct file reads
- Markdown list calls
- bytes read
- subprocess count
- Obsidian CLI calls
- peak memory
- context pack candidate counts
- lint severity summary

## Current Cases

- `build_context_pack`
- `lint_knowledge_vault`

## Boundaries

- The default path uses a synthetic temporary vault, not the user's active Obsidian vault.
- The benchmark runs context pack and lint in read-only mode.
- It does not write context pack notes or lint reports unless future benchmark cases explicitly add an apply-mode scenario.
- It does not implement MCP server benchmarking yet.
