# Changelog

All notable changes to this project will be documented in this file.

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

- First usable pre-release of `obsidian-knowledge-kit`.
- Self-contained Codex plugin packaging and home-local installation support.
- Lifecycle commands: `setup`, `start`, `doctor`, `init`, `ingest`, `refine`, and `distill`.
- Startup context loading, semi-automated ingest source registration, and semi-automated distill writeback.
- English/Chinese README files and standard open-source repository support files.
