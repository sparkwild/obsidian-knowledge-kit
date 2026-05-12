import { ScannedNote } from './scan';

export interface RecallOptions {
	limit?: number;
}

export interface RecallMatch {
	note: ScannedNote;
	score: number;
	matchedTokens: string[];
}

const MIN_TOKEN_LENGTH = 2;
const DEFAULT_LIMIT = 6;

function tokenize(input: string): string[] {
	const text = input.toLowerCase().normalize('NFKC');
	return [...new Set((text.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? []))]
		.filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

function weightedTokensFromNote(note: ScannedNote): Record<string, number> {
	const tokens = new Set<string>([
		...tokenize(note.title),
		...tokenize(note.frontmatter.title as string ?? ''),
		...note.tags.flatMap((tag) => tokenize(tag)),
		...note.aliases.flatMap((alias) => tokenize(alias)),
		...note.headings.flatMap((heading) => tokenize(heading)),
		...tokenize(note.tokens),
	]);
	const weighted: Record<string, number> = {};

	for (const token of tokens) {
		let weight = 1;
		if (tokenize(note.title).includes(token)) {
			weight += 3;
		}
		if (note.tags.some((tag) => tokenize(tag).includes(token))) {
			weight += 2;
		}
		if (note.aliases.some((alias) => tokenize(alias).includes(token))) {
			weight += 2;
		}
		weighted[token] = weight;
	}

	return weighted;
}

export function scoreNote(note: ScannedNote, queryTokens: string[]): number {
	if (queryTokens.length === 0) {
		return 0;
	}

	const weights = weightedTokensFromNote(note);
	let score = 0;
	for (const token of queryTokens) {
		if (weights[token]) {
			score += weights[token];
		}
	}
	return score;
}

export function recallNotes(notes: ScannedNote[], query: string, options: RecallOptions = {}): RecallMatch[] {
	const tokens = tokenize(query);
	const limit = options.limit ?? DEFAULT_LIMIT;
	const matches: RecallMatch[] = [];

	for (const note of notes) {
		const score = scoreNote(note, tokens);
		if (score <= 0) {
			continue;
		}

		const matchedTokens = tokens.filter((token) => weightForNoteToken(note, token) > 0);
		matches.push({
			note,
			score,
			matchedTokens,
		});
	}

	return matches.sort((a, b) => b.score - a.score || a.note.relativePath.localeCompare(b.note.relativePath)).slice(0, limit);
}

function weightForNoteToken(note: ScannedNote, token: string): number {
	if (tokenize(note.title).includes(token)) {
		return 4;
	}
	if (tokenize(note.frontmatter.type as string ?? '').includes(token)) {
		return 3;
	}
	if (note.tags.some((tag) => tokenize(tag).includes(token))) {
		return 2;
	}
	if (note.aliases.some((alias) => tokenize(alias).includes(token))) {
		return 2;
	}
	return 0;
}
