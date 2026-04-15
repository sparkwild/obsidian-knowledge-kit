# Security Policy

## Supported Versions

This project is currently maintained on the `main` branch.

## Reporting a Vulnerability

Please do not open a public issue for sensitive security problems.

Instead:

1. Open a private security advisory in GitHub, if available.
2. If that is not available, contact the maintainer through the repository owner account:
   `https://github.com/sparkwild`

When reporting, include:

- affected version or commit
- reproduction steps
- expected impact
- whether the issue affects local plugin installation, Codex plugin packaging, or Obsidian vault operations

## Scope Notes

This repository mainly operates on local files, local Codex plugin packaging, and local Obsidian vault workflows. Issues involving:

- arbitrary command execution
- unintended writes to vault content
- plugin marketplace path confusion
- unexpected remote data exposure

should be treated as security-relevant and reported privately.
