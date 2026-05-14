# Community Plugin Submission

This checklist keeps Tracekeeper ready for initial review in the Obsidian Community Plugins directory.

## Official Requirements To Check

- The repository must be public before submission so the reviewer can inspect the source code.
- Root `README.md` must explain the plugin purpose and usage.
- Root `LICENSE` must be present.
- Root `manifest.json` must be accurate on the default branch.
- `manifest.json` version must use `x.y.z` semantic version format.
- GitHub release tag must exactly match `manifest.json` version.
- Release assets must include `main.js`, `manifest.json`, and `styles.css`.
- `versions.json` must map the current plugin version to the supported `minAppVersion`.

Official references:

- https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
- https://docs.obsidian.md/Reference/Manifest
- https://docs.obsidian.md/Reference/Versions

## Current Community Entry Draft

```json
{
	"id": "tracekeeper",
	"name": "Tracekeeper",
	"author": "sparkwild",
	"description": "Review AI-proposed wiki and memory updates before they reach your vault.",
	"repo": "sparkwild/obsidian-tracekeeper"
}
```

## Pre-Submission Readiness Checklist

- [ ] Repository is public.
- [ ] Default branch is the intended submission branch.
- [ ] `README.md` describes installation, first use, MCP connection, safety model, Review Queue, and review-gated writeback.
- [ ] `manifest.json` matches `apps/obsidian-plugin/manifest.json`.
- [ ] `package.json` and `apps/obsidian-plugin/package.json` version and description are aligned with the manifest.
- [ ] `versions.json` maps the current version to `minAppVersion`.
- [ ] `npm run community:check` passes.
- [ ] `npm run verify` passes.
- [ ] GitHub release assets are rebuilt from the same commit being submitted.
- [ ] Release `main.js` is a production/minified build without a dangling source map reference.

## Release Creation Steps

1. Start from the release branch or the commit intended for submission.
2. Confirm the version:

```bash
node -p "require('./manifest.json').version"
```

3. Run the full verification:

```bash
npm run verify
```

4. Create or update the GitHub release with a tag matching `manifest.json` version:

```bash
VERSION="$(node -p "require('./manifest.json').version")"
gh release create "$VERSION" \
  --target "$(git rev-parse HEAD)" \
  --title "$VERSION" \
  --notes "Release $VERSION" \
  apps/obsidian-plugin/plugin/main.js \
  apps/obsidian-plugin/plugin/manifest.json \
  apps/obsidian-plugin/plugin/styles.css
```

If the release already exists and the version is still being prepared before community submission, replace the assets only after re-running `npm run verify`:

```bash
VERSION="$(node -p "require('./manifest.json').version")"
gh release upload "$VERSION" \
  apps/obsidian-plugin/plugin/main.js \
  apps/obsidian-plugin/plugin/manifest.json \
  apps/obsidian-plugin/plugin/styles.css \
  --clobber
```

5. Check the release:

```bash
gh release view "$VERSION" --json tagName,targetCommitish,assets,url
```

## Submit To Obsidian

1. Sign in to https://community.obsidian.md.
2. Link the GitHub account that owns `sparkwild/obsidian-tracekeeper`.
3. Open **Plugins** and select **New plugin**.
4. Enter `https://github.com/sparkwild/obsidian-tracekeeper`.
5. Confirm the developer policies and submit.

Obsidian reads the default branch `manifest.json` at submission time and installs release assets from the GitHub release whose tag matches the manifest version.

## Security Notes For Review

- Tracekeeper is desktop-only because it hosts a local Streamable HTTP MCP Runtime.
- The Runtime requires a generated local token by default.
- Missing-token Runtime startup is allowed only with the explicit development flag.
- CORS is limited to Obsidian and loopback origins; wildcard CORS is not used.
- MCP tools reject vault-outside paths and the active Obsidian configuration directory.
- Durable memory changes remain review-gated through the Review Queue.
