# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- Rebranded the project fully to `Vaultwright` / `vaultwright` across product, plugin, skills, and install paths.
- Strengthened the Obsidian-native contract across plugin metadata, skill text, command docs, the AGENTS hint installer, and the core note template.

### Added

- Added the `vaultwright-query` skill.
- Added the `query` command for building Vaultwright context pack notes.
- Added `scripts/build_context_pack.py` and `lib/obsidian_knowledge_shared/context_pack.py`.
- Added `01_ai_core/context_packs/` to the default vault directory scaffold.
- Added the `vaultwright-lint` skill.
- Added the `lint` command and `scripts/lint_knowledge_vault.py`.
- Added `lib/obsidian_knowledge_shared/knowledge_lint.py` for report-driven vault health checks.
- Enhanced raw/source registers with evidence-ready metadata fields and evidence/claim scaffolds.
- Added lint checks for claim-count drift and note-level-vs-block-level source coverage.
- Added `reconcile_source_register.py` to backfill register state from actual claim blocks and synthesis targets.
- Added `render_bases_dashboards.py` to generate Obsidian Bases dashboards under `00_system/dashboards/`.
- Shifted high-frequency active-vault reads and writes toward a shared Obsidian CLI-first runtime layer, with filesystem access retained as fallback only.

### Validation

- `scripts/check_codex_plugin.py` now validates the new query skill, command, and script.

## [0.1.1] - 2026-04-18

### Changed

- Added a documented web-ingest fallback policy for anti-bot, login-gated, and heavily dynamic pages.
- Standardized `Computer Use` as a manual fallback after lightweight URL extraction fails.
- Clarified that `Computer Use` must never be auto-installed or auto-enabled; the user must explicitly enable it when missing.

### Updated

- Updated the ingest skill, ingest command, and plugin agent prompt to reflect the new fallback policy.
- Updated English and Chinese README files plus the plugin README to describe the web-ingest decision path.

## [0.1.0] - 2026-04-15

### Added

- First usable pre-release of `vaultwright`.
- Self-contained Codex plugin packaging and home-local installation support.
- Lifecycle commands: `setup`, `start`, `doctor`, `init`, `ingest`, `refine`, and `distill`.
- Startup context loading, semi-automated ingest source registration, and semi-automated distill writeback.
- English/Chinese README files and standard open-source repository support files.
