export interface VaultSafetyOptions {
    allowHidden?: boolean;
}
export declare class VaultPathError extends Error {
    constructor(message: string);
}
export declare function isObsidianMetadataFolderName(name: string): boolean;
export declare function resolveVaultRoot(vaultRoot: string): string;
export declare function isInsideVaultRoot(vaultRoot: string, candidatePath: string): boolean;
export declare function ensureInsideVaultRoot(vaultRoot: string, candidatePath: string): string;
export declare function isSafeDirectoryName(name: string, options?: VaultSafetyOptions): boolean;
