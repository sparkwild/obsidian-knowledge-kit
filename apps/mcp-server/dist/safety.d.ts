export declare class ToolInputError extends Error {
    constructor(message: string);
}
export declare function toSafeVaultRoot(vaultRoot?: unknown): string;
export declare function normalizeNotePath(rawPath: string): string;
export declare function resolveSafeNotePath(vaultRoot: string, rawPath: string): string;
export declare function relativeFromAbsolute(vaultRoot: string, absolutePath: string): string;
