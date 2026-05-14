"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolInputError = void 0;
exports.toSafeVaultRoot = toSafeVaultRoot;
exports.normalizeNotePath = normalizeNotePath;
exports.assertNoSymlinkSegments = assertNoSymlinkSegments;
exports.resolveSafeNotePath = resolveSafeNotePath;
exports.resolveSafeWritableNotePath = resolveSafeWritableNotePath;
exports.relativeFromAbsolute = relativeFromAbsolute;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const core_1 = require("@tracekeeper/core");
const TEXT_LIKE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.text']);
const MARKDOWN_EXTENSIONS = new Set(['.md']);
class ToolInputError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ToolInputError';
    }
}
exports.ToolInputError = ToolInputError;
function toSafeVaultRoot(vaultRoot) {
    if (typeof vaultRoot !== 'string' || vaultRoot.trim() === '') {
        throw new ToolInputError('vaultRoot is required and must be a non-empty string.');
    }
    return (0, core_1.resolveVaultRoot)(vaultRoot);
}
function normalizeConfigDir(configDir) {
    const normalizedInput = (configDir || '').replace(/\\/g, '/').trim();
    if (!normalizedInput || node_path_1.default.posix.isAbsolute(normalizedInput)) {
        return '';
    }
    const normalized = node_path_1.default.posix.normalize(normalizedInput).replace(/\/+$/g, '');
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
        return '';
    }
    return normalized;
}
function isVaultConfigPath(relativePath, options = {}) {
    const configDir = normalizeConfigDir(options.vaultConfigDir);
    return Boolean(configDir && (relativePath === configDir || relativePath.startsWith(`${configDir}/`)));
}
function assertNotVaultConfigPath(relativePath, action, options = {}) {
    if (isVaultConfigPath(relativePath.replace(/\\/g, '/'), options)) {
        throw new core_1.VaultPathError(`${action} Obsidian configuration paths are not allowed.`);
    }
}
function normalizeNotePath(rawPath, options = {}) {
    if (typeof rawPath !== 'string' || rawPath.trim() === '') {
        throw new ToolInputError('path is required and must be a non-empty string.');
    }
    const normalizedInput = rawPath.replace(/\\/g, '/').trim();
    if (node_path_1.default.posix.isAbsolute(normalizedInput)) {
        throw new ToolInputError('Absolute paths are not allowed. Use vault-relative paths.');
    }
    if (normalizedInput === '' || normalizedInput === '.' || normalizedInput === '..' || normalizedInput.startsWith('..' + '/')) {
        throw new ToolInputError('Path traversal is not allowed.');
    }
    const normalized = node_path_1.default.posix.normalize(normalizedInput);
    if (normalized === '' || normalized.startsWith('..') || normalized.includes('/../')) {
        throw new ToolInputError('Path traversal is not allowed.');
    }
    assertNotVaultConfigPath(normalized, 'Reading', options);
    const segments = normalized.split('/');
    for (const segment of segments) {
        if (segment === '') {
            continue;
        }
        if (!(0, core_1.isSafeDirectoryName)(segment, { allowHidden: true })) {
            throw new ToolInputError(`Path contains unsafe segment: ${segment}`);
        }
    }
    return normalized;
}
function hasTextLikeExtension(candidate) {
    const ext = node_path_1.default.extname(candidate).toLowerCase();
    return TEXT_LIKE_EXTENSIONS.has(ext);
}
function hasMarkdownExtension(candidate) {
    const ext = node_path_1.default.extname(candidate).toLowerCase();
    return MARKDOWN_EXTENSIONS.has(ext);
}
function resolveCandidatePath(vaultRoot, candidate) {
    const absoluteCandidate = node_path_1.default.resolve(vaultRoot, candidate);
    return (0, core_1.ensureInsideVaultRoot)(vaultRoot, absoluteCandidate);
}
function assertNoSymlinkSegments(vaultRoot, absolutePath) {
    const relative = node_path_1.default.relative(vaultRoot, absolutePath);
    const segments = relative.split(node_path_1.default.sep).filter(Boolean);
    let cursor = vaultRoot;
    for (const segment of segments) {
        cursor = node_path_1.default.join(cursor, segment);
        if (!node_fs_1.default.existsSync(cursor)) {
            continue;
        }
        const stat = node_fs_1.default.lstatSync(cursor);
        if (stat.isSymbolicLink()) {
            throw new core_1.VaultPathError('Symlink paths are not allowed for note reads.');
        }
    }
}
function resolveSafeNotePath(vaultRoot, rawPath, options = {}) {
    const candidate = normalizeNotePath(rawPath, options);
    const candidatePaths = hasTextLikeExtension(candidate)
        ? [candidate]
        : [candidate, `${candidate}.md`, `${candidate}.markdown`, `${candidate}.txt`, `${candidate}.text`];
    for (const candidatePath of candidatePaths) {
        const absolute = resolveCandidatePath(vaultRoot, candidatePath);
        assertNotVaultConfigPath(relativeFromAbsolute(vaultRoot, absolute), 'Reading', options);
        if (!hasTextLikeExtension(absolute)) {
            continue;
        }
        if (!node_fs_1.default.existsSync(absolute)) {
            continue;
        }
        assertNoSymlinkSegments(vaultRoot, absolute);
        const stat = node_fs_1.default.lstatSync(absolute);
        if (!stat.isFile()) {
            throw new ToolInputError(`Path is not a file: ${candidatePath}`);
        }
        return absolute;
    }
    throw new core_1.VaultPathError('Note not found or not a markdown/text-like file inside vault.');
}
function resolveSafeWritableNotePath(vaultRoot, rawPath, allowedDirectory, options = {}) {
    const candidate = normalizeNotePath(rawPath, options);
    const withMarkdown = hasMarkdownExtension(candidate) ? candidate : `${candidate}.md`;
    const absolute = node_path_1.default.resolve(vaultRoot, withMarkdown);
    const resolved = (0, core_1.ensureInsideVaultRoot)(vaultRoot, absolute);
    const relative = node_path_1.default.relative(vaultRoot, resolved).replace(/\\/g, '/');
    if (relative === '' || relative.startsWith('..') || node_path_1.default.isAbsolute(relative)) {
        throw new core_1.VaultPathError('Path is outside vault root.');
    }
    const normalizedAllowed = node_path_1.default.posix.normalize(allowedDirectory.replace(/\\/g, '/')).replace(/\/+$/g, '');
    if (!normalizedAllowed || normalizedAllowed.includes('..')) {
        throw new ToolInputError('Allowed directory prefix is invalid.');
    }
    const allowedPrefix = `${normalizedAllowed}/`;
    if (!relative.startsWith(allowedPrefix)) {
        throw new ToolInputError(`Path must be under ${normalizedAllowed}`);
    }
    if (!hasMarkdownExtension(relative)) {
        throw new ToolInputError('Only markdown (.md) files can be written.');
    }
    assertNotVaultConfigPath(relative, 'Writing', options);
    assertNoSymlinkSegments(vaultRoot, resolved);
    if (node_fs_1.default.existsSync(resolved)) {
        throw new ToolInputError('Target file already exists and cannot be overwritten.');
    }
    return {
        absolutePath: resolved,
        relativePath: node_path_1.default.relative(vaultRoot, resolved).replace(/\\/g, '/'),
    };
}
function relativeFromAbsolute(vaultRoot, absolutePath) {
    return node_path_1.default.relative(vaultRoot, absolutePath).replace(/\\/g, '/');
}
