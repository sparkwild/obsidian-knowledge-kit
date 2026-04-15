# Privacy Policy

`obsidian-knowledge-kit` is a local-first toolkit and Codex plugin package.

## What the project does

- reads the active Obsidian vault through local files and the `obsidian` CLI
- writes notes, logs, and session artifacts into the user's local vault only when explicitly invoked
- packages local skills, commands, and scripts for Codex plugin installation

## What the project does not do by default

- it does not run a hosted backend
- it does not automatically upload vault content to a remote service
- it does not automatically capture all conversations into the knowledge base

## Data handling

- vault content stays on the user's machine unless the user explicitly chooses another workflow
- plugin packaging and installation manipulate local files under the repository, `~/plugins/`, `~/.agents/`, and `~/.codex/` only when requested
- external web access depends on the user's Codex environment and the commands they choose to run

## Responsibility

Users remain responsible for:

- deciding which vault content should be written or transformed
- reviewing any automated updates before treating them as durable knowledge
- securing their local machine, Obsidian vault, and Codex environment
