#!/usr/bin/env node
import fs from 'node:fs';

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
	throw new Error('Missing npm_package_version.');
}

function readJson(path) {
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value, indent = '\t') {
	fs.writeFileSync(path, `${JSON.stringify(value, null, indent)}\n`);
}

const manifest = readJson('manifest.json');
manifest.version = targetVersion;
writeJson('manifest.json', manifest);

const pluginManifest = readJson('apps/obsidian-plugin/manifest.json');
pluginManifest.version = targetVersion;
writeJson('apps/obsidian-plugin/manifest.json', pluginManifest, '  ');

const pluginPackage = readJson('apps/obsidian-plugin/package.json');
pluginPackage.version = targetVersion;
writeJson('apps/obsidian-plugin/package.json', pluginPackage, '  ');

for (const packagePath of ['apps/mcp-server/package.json', 'packages/core/package.json']) {
	const packageJson = readJson(packagePath);
	packageJson.version = targetVersion;
	writeJson(packagePath, packageJson);
}

for (const lockPath of [
	'package-lock.json',
	'apps/obsidian-plugin/package-lock.json',
	'apps/mcp-server/package-lock.json',
	'packages/core/package-lock.json',
]) {
	if (!fs.existsSync(lockPath)) {
		continue;
	}
	const lock = readJson(lockPath);
	lock.version = targetVersion;
	if (lock.packages?.['']) {
		lock.packages[''].version = targetVersion;
	}
	writeJson(lockPath, lock, '  ');
}

const versions = readJson('versions.json');
versions[targetVersion] = manifest.minAppVersion;
writeJson('versions.json', versions);
