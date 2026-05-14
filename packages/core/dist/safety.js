"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultPathError = void 0;
exports.isObsidianMetadataFolderName = isObsidianMetadataFolderName;
exports.resolveVaultRoot = resolveVaultRoot;
exports.isInsideVaultRoot = isInsideVaultRoot;
exports.ensureInsideVaultRoot = ensureInsideVaultRoot;
exports.isSafeDirectoryName = isSafeDirectoryName;
const node_path_1 = __importDefault(require("node:path"));
class VaultPathError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VaultPathError';
    }
}
exports.VaultPathError = VaultPathError;
function isObsidianMetadataFolderName(name, protectedDirectoryName) {
    return Boolean(protectedDirectoryName && name === protectedDirectoryName);
}
function resolveVaultRoot(vaultRoot) {
    return node_path_1.default.resolve(vaultRoot);
}
function isInsideVaultRoot(vaultRoot, candidatePath) {
    const root = resolveVaultRoot(vaultRoot);
    const candidate = node_path_1.default.resolve(candidatePath);
    const relative = node_path_1.default.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${node_path_1.default.sep}`) && relative !== '..' && !node_path_1.default.isAbsolute(relative));
}
function ensureInsideVaultRoot(vaultRoot, candidatePath) {
    const resolved = node_path_1.default.resolve(candidatePath);
    if (!isInsideVaultRoot(vaultRoot, resolved)) {
        throw new VaultPathError(`Path is outside vault root: ${candidatePath}`);
    }
    return resolved;
}
function isSafeDirectoryName(name, options = {}) {
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
