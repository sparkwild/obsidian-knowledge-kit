"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanVault = scanVault;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const safety_1 = require("./safety");
const markdown_1 = require("./markdown");
const NOTES_EXTENSIONS = new Set(['.md', '.markdown']);
function getAliases(frontmatter) {
    const aliases = [];
    const aliasesFromFrontmatter = frontmatter.aliases;
    if (typeof aliasesFromFrontmatter === 'string') {
        for (const alias of aliasesFromFrontmatter.split(',').map((item) => item.trim())) {
            if (alias) {
                aliases.push(alias);
            }
        }
    }
    else if (Array.isArray(aliasesFromFrontmatter)) {
        for (const alias of aliasesFromFrontmatter) {
            if (typeof alias === 'string' && alias.trim()) {
                aliases.push(alias.trim());
            }
        }
    }
    if (typeof frontmatter.title === 'string' && frontmatter.title.trim()) {
        aliases.push(frontmatter.title.trim());
    }
    return [...new Set(aliases)];
}
function normalizeProtectedDirectoryName(configDir) {
    const normalized = (configDir || '').replace(/\\/g, '/').trim().replace(/\/+$/g, '');
    if (!normalized || normalized.includes('/')) {
        return '';
    }
    return normalized;
}
function shouldSkipDirectory(entryName, options) {
    const protectedDirectoryName = normalizeProtectedDirectoryName(options.vaultConfigDir);
    return !(0, safety_1.isSafeDirectoryName)(entryName, { protectedDirectoryName });
}
function isSkippableEntry(entry) {
    if (entry.isSymbolicLink()) {
        return true;
    }
    return false;
}
function scanDirectory(vaultRoot, directory, notes, errors, options) {
    const entries = node_fs_1.default.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
        if (shouldSkipDirectory(entry.name, options)) {
            continue;
        }
        if (isSkippableEntry(entry)) {
            continue;
        }
        const resolved = node_path_1.default.join(directory, entry.name);
        const safePath = (0, safety_1.ensureInsideVaultRoot)(vaultRoot, resolved);
        if (entry.isDirectory()) {
            scanDirectory(vaultRoot, safePath, notes, errors, options);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        const ext = node_path_1.default.extname(entry.name).toLowerCase();
        if (!NOTES_EXTENSIONS.has(ext)) {
            continue;
        }
        try {
            const fileContent = node_fs_1.default.readFileSync(safePath, 'utf8');
            const parsed = (0, markdown_1.parseMarkdown)(fileContent);
            const stats = node_fs_1.default.statSync(safePath);
            const relativePath = node_path_1.default.relative(vaultRoot, safePath).replace(/\\/g, '/');
            const aliases = getAliases(parsed.frontmatter.fields);
            notes.push({
                absolutePath: safePath,
                relativePath,
                title: parsed.title || node_path_1.default.basename(entry.name, ext),
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                tokens: parsed.searchText,
                frontmatter: parsed.frontmatter.fields,
                aliases,
                type: typeof parsed.frontmatter.fields.type === 'string' ? parsed.frontmatter.fields.type : undefined,
                tags: parsed.tags,
                headings: parsed.headings,
                blockIds: parsed.blockIds,
                wikilinks: parsed.wikilinks,
                claimBlocks: parsed.claimBlocks,
                evidenceBlocks: parsed.evidenceBlocks,
                content: parsed.body,
            });
        }
        catch (error) {
            errors.push({
                path: safePath,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
function scanVault(vaultRoot, options = {}) {
    const resolvedRoot = (0, safety_1.resolveVaultRoot)(vaultRoot);
    const notes = [];
    const errors = [];
    scanDirectory(resolvedRoot, resolvedRoot, notes, errors, options);
    return {
        vaultRoot: resolvedRoot,
        scannedAt: new Date().toISOString(),
        notes,
        errors,
    };
}
