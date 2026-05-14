# Development And Release Notes

This page keeps implementation, verification, and release details out of the top-level README.

## Names

- Product: `Tracekeeper`
- Repository: `obsidian-tracekeeper`
- Obsidian plugin id: `tracekeeper`
- Obsidian plugin display name: `Tracekeeper`
- Chinese in-plugin display: `知识库`
- MCP server id/config key: `tracekeeper`
- MCP tool prefix: `tracekeeper.*`
- Initial version: `0.1.0`

## Verify

```bash
cd <repo>
npm run verify
```

Narrower checks are also available:

```bash
npm run typecheck
npm run build
npm run test
npm run package
```

## Repository Layout

```text
obsidian-tracekeeper/
├─ apps/
│  ├─ obsidian-plugin/
│  └─ mcp-server/
├─ packages/
│  └─ core/
├─ docs/
├─ scripts/
└─ package.json
```

## Community Release

Before submitting to the community directory, follow [Community Plugin Submission](./COMMUNITY_PLUGIN_SUBMISSION.md). Short checklist:

- Run `npm run verify`.
- Make the repository public.
- Create a GitHub release whose tag exactly matches `manifest.json` version.
- Upload `main.js`, `manifest.json`, and `styles.css` as individual release assets.
- Use this community entry:

```json
{
	"id": "tracekeeper",
	"name": "Tracekeeper",
	"author": "sparkwild",
	"description": "Review AI-proposed wiki and memory updates before they reach your vault.",
	"repo": "sparkwild/obsidian-tracekeeper"
}
```

## Acknowledgement Policy

- GitHub contributor credit is reserved for direct code, documentation, design, or issue contributions.
- AI tools used during development may be listed under `Acknowledgements`, not `Contributors`.
- Public writing, demos, or research influences may be acknowledged when the wording avoids endorsement, sponsorship, or direct contribution claims.
