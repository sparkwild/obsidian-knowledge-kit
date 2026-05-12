import fs from 'node:fs';
import path from 'node:path';
import { ScannedNote } from './scan';

export interface LintIssue {
	severity: 'error' | 'warning';
	kind: 'broken_wikilink' | 'claim_missing_source';
	path: string;
	line: number;
	message: string;
	context?: string;
}

export interface LintReport {
	issues: LintIssue[];
}

const EXTERNAL_LINK = /^(?:https?:\/\/|mailto:|file:|ftp:)/i;

function buildLinkCandidate(vaultRoot: string, sourceDir: string, wikilinkTarget: string): string {
	const sanitized = wikilinkTarget.replace(/\/+/g, '/').trim();
	const splitHash = sanitized.split('#', 2);
	const candidateBase = splitHash[0].trim();
	if (!candidateBase) {
		return '';
	}
	let candidatePath = candidateBase;

	if (!path.extname(candidatePath)) {
		candidatePath = `${candidatePath}.md`;
	}
	if (!path.isAbsolute(candidatePath)) {
		candidatePath = path.resolve(sourceDir, candidatePath);
	}
	if (!isInsideVault(vaultRoot, candidatePath)) {
		return '';
	}

	return candidatePath;
}

function isInsideVault(vaultRoot: string, candidatePath: string): boolean {
	const root = path.resolve(vaultRoot);
	const candidate = path.resolve(candidatePath);
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hasFile(candidatePath: string): boolean {
	if (!candidatePath || !fs.existsSync(candidatePath)) {
		return false;
	}
	const stat = fs.statSync(candidatePath);
	return stat.isFile();
}

export function lintNotes(vaultRoot: string, notes: ScannedNote[]): LintReport {
	const issues: LintIssue[] = [];

	for (const note of notes) {
		const sourceDir = path.dirname(note.absolutePath);

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
