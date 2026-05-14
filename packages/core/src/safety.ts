import path from 'node:path';

export interface VaultSafetyOptions {
	allowHidden?: boolean;
	protectedDirectoryName?: string;
}

export class VaultPathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'VaultPathError';
	}
}

export function isObsidianMetadataFolderName(name: string, protectedDirectoryName?: string): boolean {
	return Boolean(protectedDirectoryName && name === protectedDirectoryName);
}

export function resolveVaultRoot(vaultRoot: string): string {
	return path.resolve(vaultRoot);
}

export function isInsideVaultRoot(vaultRoot: string, candidatePath: string): boolean {
	const root = resolveVaultRoot(vaultRoot);
	const candidate = path.resolve(candidatePath);
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function ensureInsideVaultRoot(vaultRoot: string, candidatePath: string): string {
	const resolved = path.resolve(candidatePath);
	if (!isInsideVaultRoot(vaultRoot, resolved)) {
		throw new VaultPathError(`Path is outside vault root: ${candidatePath}`);
	}

	return resolved;
}

export function isSafeDirectoryName(name: string, options: VaultSafetyOptions = {}): boolean {
	if (name === '.' || name === '..') {
		return false;
	}
	if (options.allowHidden === false && name.startsWith('.')) {
		return false;
	}
	if (isObsidianMetadataFolderName(name, options.protectedDirectoryName)) {
		return false;
	}
	return true;
}
