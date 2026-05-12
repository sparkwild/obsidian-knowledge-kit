#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function copyFileSafe(sourceName, targetDir) {
	const source = path.join(process.cwd(), sourceName);
	const target = path.join(targetDir, sourceName);
	if (!fs.existsSync(source)) {
		throw new Error(`Missing required artifact: ${sourceName}`);
	}
	fs.copyFileSync(source, target);
}

function main() {
	const packageDir = path.join(process.cwd(), 'plugin');
	const artifacts = ['manifest.json', 'main.js', 'styles.css'];

	if (fs.existsSync(packageDir)) {
		fs.rmSync(packageDir, { recursive: true, force: true });
	}
	fs.mkdirSync(packageDir, { recursive: true });

	for (const artifact of artifacts) {
		copyFileSafe(artifact, packageDir);
	}

	console.log(`Packaged Obsidian plugin artifacts to ${packageDir}`);
}

main();
