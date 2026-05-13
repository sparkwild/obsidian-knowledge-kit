# 12 First Batch Adjustment: Agent Entry and Obsidian Review

## Scope

This batch aligns the existing plan and Obsidian plugin scaffold with the Agent-first and Obsidian governance boundary.

## Product Boundary

- Product and plugin name remain `obs-wiki`.
- Agent is the only operation entry for URL/file submission, source analysis, context packs, lint, distill, and proposal generation.
- Obsidian plugin is the human governance surface for review, approval, rejection, revision requests, audit, status, and permission visibility.
- Long-term memory, user preferences, important project decisions, high-confidence claims, delete/archive, and bulk migration must enter Review Queue first.
- Runtime executes approved writeback.

## Obsidian Plugin Scaffold Boundary

Allowed scaffold commands:

- Open Agent Activity
- Open Review Queue
- Open Memory Inspector
- Open Audit Log
- Open Runtime Status
- Open Permission Policy
- Refresh Views

Allowed Review Queue actions:

- Approve
- Reject
- Defer
- Request Revision
- Apply Approved Writeback

Removed from plugin entry points:

- Analyze URL
- Analyze Local File
- Analyze Current Note
- Analyze Selection
- Capture Source
- Add Source to Inbox
- Build Context Pack
- Run Ingest
- Run Lint
- Run Distill
- Create Agent Request

## Deferred

- Full MCP Server redesign.
- Complete Memory Inspector, Audit Log, Runtime Status, and Permission Policy views.
