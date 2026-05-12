"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lintNotes = lintNotes;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const EXTERNAL_LINK = /^(?:https?:\/\/|mailto:|file:|ftp:)/i;
function buildLinkCandidate(vaultRoot, sourceDir, wikilinkTarget) {
    const sanitized = wikilinkTarget.replace(/\/+/g, '/').trim();
    const splitHash = sanitized.split('#', 2);
    const candidateBase = splitHash[0].trim();
    if (!candidateBase) {
        return '';
    }
    let candidatePath = candidateBase;
    if (!node_path_1.default.extname(candidatePath)) {
        candidatePath = `${candidatePath}.md`;
    }
    if (!node_path_1.default.isAbsolute(candidatePath)) {
        candidatePath = node_path_1.default.resolve(sourceDir, candidatePath);
    }
    if (!isInsideVault(vaultRoot, candidatePath)) {
        return '';
    }
    return candidatePath;
}
function isInsideVault(vaultRoot, candidatePath) {
    const root = node_path_1.default.resolve(vaultRoot);
    const candidate = node_path_1.default.resolve(candidatePath);
    const relative = node_path_1.default.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !node_path_1.default.isAbsolute(relative));
}
function hasFile(candidatePath) {
    if (!candidatePath || !node_fs_1.default.existsSync(candidatePath)) {
        return false;
    }
    const stat = node_fs_1.default.statSync(candidatePath);
    return stat.isFile();
}
function lintNotes(vaultRoot, notes) {
    const issues = [];
    for (const note of notes) {
        const sourceDir = node_path_1.default.dirname(note.absolutePath);
        for (const link of note.wikilinks) {
            if (EXTERNAL_LINK.test(link.target) || link.target.includes('|')) {
                continue;
            }
            let candidate = buildLinkCandidate(vaultRoot, sourceDir, link.target);
            if (!candidate || !isInsideVault(vaultRoot, candidate)) {
                issues.push({
                    severity: 'warning',
                    kind: 'broken_wikilink',
                    path: note.relativePath,
                    line: link.line,
                    message: `Broken wikilink target: ${link.target}`,
                    context: link.raw,
                });
                continue;
            }
            if (!hasFile(candidate)) {
                issues.push({
                    severity: 'error',
                    kind: 'broken_wikilink',
                    path: note.relativePath,
                    line: link.line,
                    message: `Broken wikilink target: ${link.target}`,
                    context: link.raw,
                });
            }
        }
        for (const claim of note.claimBlocks) {
            if (claim.sourceRefs.length === 0) {
                issues.push({
                    severity: 'warning',
                    kind: 'claim_missing_source',
                    path: note.relativePath,
                    line: claim.line,
                    message: 'Claim block has no source references',
                    context: claim.rawHeader,
                });
            }
        }
    }
    return { issues };
}
