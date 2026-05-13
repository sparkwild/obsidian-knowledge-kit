#!/usr/bin/env node
import fs from 'node:fs';

const REPOSITORY = 'sparkwild/obsidian-wiki-weaver';
const ROOT_MANIFEST_PATH = 'manifest.json';
const PLUGIN_MANIFEST_PATH = 'apps/obsidian-plugin/manifest.json';
const PLUGIN_PACKAGE_PATH = 'apps/obsidian-plugin/package.json';
const VERSIONS_PATH = 'versions.json';

function readJson(path) {
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function fail(message) {
	throw new Error(message);
}

function assert(condition, message) {
	if (!condition) {
		fail(message);
	}
}

function main() {
	const manifest = readJson(ROOT_MANIFEST_PATH);
	const pluginManifest = readJson(PLUGIN_MANIFEST_PATH);
	const pluginPackage = readJson(PLUGIN_PACKAGE_PATH);
	const versions = readJson(VERSIONS_PATH);
	const communityEntry = {
		id: manifest.id,
		name: manifest.name,
		author: manifest.author,
		description: manifest.description,
		repo: REPOSITORY,
	};

	const requiredManifestKeys = ['id', 'name', 'description', 'author', 'version', 'minAppVersion', 'isDesktopOnly'];
	const allowedManifestKeys = [...requiredManifestKeys, 'authorUrl', 'fundingUrl', 'helpUrl'];
	for (const key of requiredManifestKeys) {
		assert(Object.hasOwn(manifest, key), `Root manifest is missing ${key}.`);
	}
	for (const key of Object.keys(manifest)) {
		assert(allowedManifestKeys.includes(key), `Root manifest has invalid key ${key}.`);
	}

	assert(/^[a-z0-9-_]+$/.test(communityEntry.id), 'Plugin id must use lowercase letters, numbers, dashes, or underscores only.');
	assert(!communityEntry.id.toLowerCase().includes('obsidian'), 'Plugin id must not include "obsidian".');
	assert(!communityEntry.id.toLowerCase().endsWith('plugin'), 'Plugin id must not end with "plugin".');
	assert(!communityEntry.name.toLowerCase().includes('obsidian'), 'Plugin name must not include "Obsidian".');
	assert(!communityEntry.name.toLowerCase().endsWith('plugin'), 'Plugin name must not end with "Plugin".');
	assert(!communityEntry.name.toLowerCase().startsWith('obsi') && !communityEntry.name.toLowerCase().endsWith('dian'), 'Plugin name must not look like a variation of "Obsidian".');
	assert(!communityEntry.description.toLowerCase().includes('obsidian'), 'Description must not include "Obsidian".');
	assert(!communityEntry.description.toLowerCase().includes('this plugin'), 'Description should describe behavior directly, without "this plugin".');
	assert(/[.?!)]$/.test(communityEntry.description), 'Description must end with punctuation.');
	assert(communityEntry.description.length <= 250, 'Description must be 250 characters or fewer.');
	assert(/^[0-9.]+$/.test(manifest.version), 'Version must contain only numbers and dots.');
	assert(versions[manifest.version] === manifest.minAppVersion, 'versions.json must map the current plugin version to minAppVersion.');
	assert(manifest.authorUrl !== 'https://obsidian.md', 'authorUrl must not point to the Obsidian website.');
	assert(!manifest.authorUrl?.toLowerCase().includes(`github.com/${REPOSITORY.toLowerCase()}`), 'authorUrl must not point to the plugin repository.');

	for (const key of ['id', 'name', 'version', 'minAppVersion', 'description', 'author', 'authorUrl', 'isDesktopOnly']) {
		assert(pluginManifest[key] === manifest[key], `Plugin manifest ${key} must match root manifest.`);
	}
	assert(pluginPackage.version === manifest.version, 'Plugin package version must match root manifest.');
	assert(pluginPackage.description === manifest.description, 'Plugin package description must match root manifest.');

	console.log(JSON.stringify({ result: 'pass', communityEntry }, null, 2));
}

main();
