import path from 'node:path';
import fs from 'node:fs';
import { ensureInsideVaultRoot, resolveVaultRoot, isSafeDirectoryName, VaultPathError } from '@obs-wiki/core';

const FORBIDDEN_SEGMENTS = new Set(['.obsidian']);
const TEXT_LIKE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.text']);

export class ToolInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ToolInputError';
	}
}

export function toSafeVaultRoot(vaultRoot?: unknown): string {
	if (typeof vaultRoot !== 'string' || vaultRoot.trim() === '') {
		throw new ToolInputError('vaultRoot is required and must be a non-empty string.');
	}

	return resolveVaultRoot(vaultRoot);
}

export function normalizeNotePath(rawPath: string): string {
	if (typeof rawPath !== 'string' || rawPath.trim() === '') {
		throw new ToolInputError('path is required and must be a non-empty string.');
	}

	const normalizedInput = rawPath.replace(/\\/g, '/').trim();
	if (path.posix.isAbsolute(normalizedInput)) {
		throw new ToolInputError('Absolute paths are not allowed. Use vault-relative paths.');
	}
	if (normalizedInput === '' || normalizedInput === '.' || normalizedInput === '..' || normalizedInput.startsWith('..' + '/')) {
		throw new ToolInputError('Path traversal is not allowed.');
	}

	const normalized = path.posix.normalize(normalizedInput);
	if (normalized === '' || normalized.startsWith('..') || normalized.includes('/../')) {
		throw new ToolInputError('Path traversal is not allowed.');
	}

	const segments = normalized.split('/');
	for (const segment of segments) {
		if (segment === '') {
			continue;
		}
		if (!isSafeDirectoryName(segment, { allowHidden: true })) {
			throw new ToolInputError(`Path contains unsafe segment: ${segment}`);
		}
		if (FORBIDDEN_SEGMENTS.has(segment)) {
			throw new ToolInputError('Reading .obsidian paths is not allowed.');
		}
	}

	return normalized;
}

function hasTextLikeExtension(candidate: string): boolean {
	const ext = path.extname(candidate).toLowerCase();
	return TEXT_LIKE_EXTENSIONS.has(ext);
}

function resolveCandidatePath(vaultRoot: string, candidate: string): string {
	const absoluteCandidate = path.resolve(vaultRoot, candidate);
	return ensureInsideVaultRoot(vaultRoot, absoluteCandidate);
}

function assertNoSymlinkSegments(vaultRoot: string, absolutePath: string): void {
	const relative = path.relative(vaultRoot, absolutePath);
	const segments = relative.split(path.sep).filter(Boolean);
	let cursor = vaultRoot;

	for (const segment of segments) {
		cursor = path.join(cursor, segment);
		const stat = fs.lstatSync(cursor);
		if (stat.isSymbolicLink()) {
			throw new VaultPathError('Symlink paths are not allowed for note reads.');
		}
	}
}

export function resolveSafeNotePath(vaultRoot: string, rawPath: string): string {
	const candidate = normalizeNotePath(rawPath);

	const candidatePaths = hasTextLikeExtension(candidate)
		? [candidate]
		: [candidate, `${candidate}.md`, `${candidate}.markdown`, `${candidate}.txt`, `${candidate}.text`];

	for (const candidatePath of candidatePaths) {
		const absolute = resolveCandidatePath(vaultRoot, candidatePath);
		const relParts = path.relative(vaultRoot, absolute).split(path.sep);
		if (relParts.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) {
			throw new VaultPathError('Reading .obsidian paths is not allowed.');
		}

		if (!hasTextLikeExtension(absolute)) {
			continue;
		}

		if (!fs.existsSync(absolute)) {
			continue;
		}

		assertNoSymlinkSegments(vaultRoot, absolute);
		const stat = fs.lstatSync(absolute);
		if (!stat.isFile()) {
			throw new ToolInputError(`Path is not a file: ${candidatePath}`);
		}

		return absolute;
	}

	throw new VaultPathError('Note not found or not a markdown/text-like file inside vault.');
}

export function relativeFromAbsolute(vaultRoot: string, absolutePath: string): string {
	return path.relative(vaultRoot, absolutePath).replace(/\\/g, '/');
}
