export interface SourceAnalysisInput {
	source: string;
	sourceKind: string;
	analysisMode: string;
	purpose?: string;
	content?: string;
	requestPath?: string;
}

export interface SourceProposalDraft {
	title: string;
	proposalKind: string;
	evidence: string;
	riskLevel: string;
	content: string;
}

export interface SourceAnalysisResult {
	summary: string;
	excerpt: string;
	evidenceScaffolds: string[];
	claimScaffolds: string[];
	proposalDrafts: SourceProposalDraft[];
}

const MAX_EXCERPT_LENGTH = 1000;
const MAX_SUMMARY_SENTENCES = 4;
const MAX_SCAFFOLDS = 8;
const MAX_PROPOSALS = 2;

const CLAIM_HINT_RE = /\b(is|are|was|were|means|implies|shows|indicates|suggests|argues|claims|requires|proves|finds|found)\b/i;
const IMPORTANT_HINT_RE = /\b(study|report|document|source|evidence|result|analysis|claim|issue|risk|decision|policy|metric)\b/i;

function sanitizeText(rawText: string): string {
	return (rawText || '').replace(/\r\n/g, '\n').replace(/\u200b/g, '').trim();
}

function splitSentences(text: string): string[] {
	const normalized = sanitizeText(text);
	if (!normalized) {
		return [];
	}

	const rough = normalized
		.split(/(?<=[.!?。！？\n])\s+/)
		.map((chunk) => chunk.replace(/\s+/g, ' ').trim())
		.filter((item) => item.length > 0);

	return rough;
}

function uniqueOrdered<T>(items: T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];
	for (const item of items) {
		const key = String(item);
		if (key.trim() === '') {
			continue;
		}
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(item);
	}
	return unique;
}

function extractEvidenceCandidates(text: string): string[] {
	const lines = sanitizeText(text).split('\n');
	const candidates: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('> ')) {
			candidates.push(`quote: ${trimmed.replace(/^>\s?/, '')}`);
		}

		const urls = trimmed.match(/https?:\/\/[^\s\]\)"]+/gi);
		if (urls) {
			for (const url of urls) {
				candidates.push(`external_reference: ${url}`);
			}
		}

		if (/^\s*[-*]\s+\[?(x| )\]?\s+/.test(trimmed) && trimmed.length > 8) {
			candidates.push(`bullet_item: ${trimmed}`);
		}

		if (trimmed.startsWith('#')) {
			candidates.push(`section_title: ${trimmed}`);
		}
	}

	return uniqueOrdered(candidates).slice(0, MAX_SCAFFOLDS);
}

function extractClaimCandidates(text: string): string[] {
	const sentences = splitSentences(text);
	const candidates = sentences
		.filter((sentence) => sentence.length >= 20 && CLAIM_HINT_RE.test(sentence))
		.map((sentence) => `claim: ${sentence}`);

	return uniqueOrdered(candidates).slice(0, 5);
}

function buildSummary(source: string, analysisMode: string, purpose: string, text: string): string {
	const cleanText = sanitizeText(text);
	const sentences = splitSentences(cleanText);
	const purposeHint = purpose ? ` | purpose: ${sanitizeText(purpose)}` : '';
	const sourceHint = source ? `source:${source}` : 'source: unknown';
	const modeHint = analysisMode ? `mode:${analysisMode}` : 'mode:local_text';

	if (!cleanText) {
		return `No inline text was captured for ${sourceHint}${purposeHint}. mode=${modeHint}.`;
	}

	const shortSentences = sentences.slice(0, MAX_SUMMARY_SENTENCES).join(' ');
	return `${shortSentences} ${purposeHint} (${modeHint})`.trim();
}

function excerptFromText(text: string): string {
	const trimmed = sanitizeText(text);
	return trimmed.length > MAX_EXCERPT_LENGTH ? `${trimmed.slice(0, MAX_EXCERPT_LENGTH)}...` : trimmed;
}

function buildProposalDrafts(
	source: string,
	sourceKind: string,
	analysisMode: string,
	summary: string,
	evidences: string[],
	claims: string[],
	requestPath?: string
): SourceProposalDraft[] {
	const drafts: SourceProposalDraft[] = [];
	const evidenceText = evidences.length > 0 ? evidences.join('\n') : 'No explicit evidence scaffold extracted.';
	const claimText = claims.length > 0 ? claims.join('\n') : 'No explicit claim scaffold extracted.';

	drafts.push({
		title: `Source analysis: ${source || 'unresolved source'}`,
		proposalKind: sourceKind === 'url' || sourceKind === 'external_reference' ? 'external_source_follow_up' : 'source_insight_draft',
		riskLevel: sourceKind === 'url' || sourceKind === 'external_reference' ? 'medium' : 'low',
		evidence: evidenceText,
		content:
			`## Proposal draft\n\n` +
			`- source: ${source || 'unknown'}\n` +
			`- source_kind: ${sourceKind || 'unknown'}\n` +
			`- analysis_mode: ${analysisMode || 'default'}\n` +
			(!!requestPath ? `- request_path: ${requestPath}\n` : '') +
			`- risk_level: ${sourceKind === 'url' || sourceKind === 'external_reference' ? 'medium' : 'low'}\n\n` +
			`### Proposal summary\n${summary}\n\n` +
			`### Candidate claims\n${claimText}\n\n` +
			`### Candidate evidence\n${evidenceText}\n`,
	});

	if (claims.length > 0) {
		drafts.push({
			title: `Source evidence follow-up: ${source || 'unknown'}`,
			proposalKind: 'source_evidence_check',
			riskLevel: 'low',
			evidence: evidences.slice(0, 2).join('\n') || 'No evidence scaffold found.',
			content:
				`## Proposal draft\n\n` +
				`- source: ${source || 'unknown'}\n` +
				`- source_kind: ${sourceKind || 'unknown'}\n` +
				`- analysis_mode: ${analysisMode || 'default'}\n` +
				'- proposal_kind_hint: evidence_followup\n\n' +
				'### Claim candidates for follow-up verification\n' +
				claims.map((claim) => `- ${claim}`).join('\n') +
				'\n\n' +
				'### Follow-up action\n' +
				'- Resolve missing direct evidence references before committing these claims.\n',
		});
	}

	return drafts.slice(0, MAX_PROPOSALS);
}

export function analyzeSourceText(input: SourceAnalysisInput): SourceAnalysisResult {
	const source = sanitizeText(input.source);
	const sourceKind = sanitizeText(input.sourceKind) || 'unknown';
	const analysisMode = sanitizeText(input.analysisMode) || 'default';
	const purpose = sanitizeText(input.purpose || '');
	const content = sanitizeText(input.content || '');

	const summary = buildSummary(source, analysisMode, purpose, content);
	const evidenceScaffolds = extractEvidenceCandidates(content);
	const claimScaffolds = extractClaimCandidates(content);
	const proposalDrafts = buildProposalDrafts(source, sourceKind, analysisMode, summary, evidenceScaffolds, claimScaffolds, input.requestPath);

	let finalClaimScaffolds = claimScaffolds;
	if (finalClaimScaffolds.length === 0) {
		const fallback = [
			'claim: Re-check source text for explicit factual assertions.',
			'claim: Confirm whether source intent aligns with the stated purpose.',
		];
		finalClaimScaffolds = fallback;
	}

	if (IMPORTANT_HINT_RE.test(content) && evidenceScaffolds.length === 0) {
		evidenceScaffolds.push('evidence: Re-scan source for concrete references or links.');
	}

	return {
		summary,
		excerpt: excerptFromText(content),
		evidenceScaffolds,
		claimScaffolds: finalClaimScaffolds,
		proposalDrafts,
	};
}
