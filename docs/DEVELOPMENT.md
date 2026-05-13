# Development And Release Notes

This page keeps implementation, verification, and release details out of the top-level README.

## Names

- Product: `Wiki Weaver`
- Repository: `obsidian-wiki-weaver`
- Obsidian plugin id: `wiki-weaver`
- Obsidian plugin display name: `Wiki Weaver`
- Chinese in-plugin display: `知识库`
- MCP server id/config key: `wiki-weaver`
- MCP tool prefix: `wiki_weaver.*`
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
obsidian-wiki-weaver/
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

Before submitting to the community directory:

- Run `npm run verify`.
- Create a GitHub release whose tag exactly matches `manifest.json` version.
- Upload `main.js`, `manifest.json`, and `styles.css` as individual release assets.
- Use this community entry:

```json
{
	"id": "wiki-weaver",
	"name": "Wiki Weaver",
	"author": "sparkwild",
	"description": "Build and review an AI-assisted wiki from your vault.",
	"repo": "sparkwild/obsidian-wiki-weaver"
}
```

## Acknowledgement Policy

- GitHub contributor credit is reserved for direct code, documentation, design, or issue contributions.
- AI tools used during development may be listed under `Acknowledgements`, not `Contributors`.
- Public writing, demos, or research influences may be acknowledged when the wording avoids endorsement, sponsorship, or direct contribution claims.
