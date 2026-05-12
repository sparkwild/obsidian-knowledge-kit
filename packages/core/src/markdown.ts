export interface ParsedFrontmatter {
	fields: Record<string, unknown>;
	raw: string;
	body: string;
}

export interface Wikilink {
	raw: string;
	target: string;
	alias?: string;
	heading?: string;
	line: number;
}

export interface CalloutBlock {
	type: string;
	rawHeader: string;
	content: string;
	sourceRefs: string[];
	blockId?: string;
	line: number;
	endLine: number;
}

export interface ParsedMarkdown {
	frontmatter: ParsedFrontmatter;
	title: string;
	body: string;
	tags: string[];
	headings: string[];
	blockIds: string[];
	wikilinks: Wikilink[];
	claimBlocks: CalloutBlock[];
	evidenceBlocks: CalloutBlock[];
	searchText: string;
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const YAML_LIST_PATTERN = /^\[(.*)\]$/;
const CALLER_BLOCK_ID = /^\s*\^([A-Za-z0-9._-]+)\s*$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)\s*$/;
const EXTERNAL_LINK = /^(?:https?:\/\/|mailto:|file:|ftp:)/i;

export function parseFrontmatter(rawContent: string): ParsedFrontmatter {
	const normalized = rawContent.replace(/\r\n/g, '\n');
	const match = normalized.match(FRONT_MATTER_PATTERN);
	if (!match) {
		return {
			fields: {},
			raw: '',
			body: normalized,
		};
	}

	const frontmatterRaw = match[1] ?? '';
	const body = normalized.slice((match[0] ?? '').length);

	return {
		fields: parseFrontmatterBody(frontmatterRaw),
		raw: frontmatterRaw,
		body,
	};
}

function parseFrontmatterBody(frontmatterRaw: string): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	const lines = frontmatterRaw.split('\n').map((line) => line.trim());

	for (const line of lines) {
		if (!line || line.startsWith('#')) {
			continue;
		}
		const delimiterIndex = line.indexOf(':');
		if (delimiterIndex <= 0) {
			continue;
		}

		const key = line.slice(0, delimiterIndex).trim();
		const value = line.slice(delimiterIndex + 1).trim();
		fields[key] = parseFrontmatterValue(value);
	}

	return fields;
}

function parseFrontmatterValue(value: string): unknown {
	if (!value) {
		return '';
	}
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	if (value === 'null') {
		return null;
	}
	if (!Number.isNaN(Number(value)) && Number.isFinite(Number(value))) {
		return Number(value);
	}

	const listMatch = value.match(YAML_LIST_PATTERN);
	if (listMatch) {
		return listMatch[1]
			.split(',')
			.map((item) => parseFrontmatterValue(item.trim().replace(/^['"]|['"]$/g, '')))
			.filter((item) => item !== '');
	}

	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	return value;
}

export function extractWikilinks(content: string): Wikilink[] {
	const lines = content.split('\n');
	const wikilinks: Wikilink[] = [];
	const wikilinkPattern = /\[\[([^\]]+)\]\]/g;

	for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
		const line = lines[lineNumber];
		let match: RegExpExecArray | null;
		while ((match = wikilinkPattern.exec(line)) !== null) {
			const raw = match[1].trim();
			if (!raw || EXTERNAL_LINK.test(raw)) {
				continue;
			}

			const [targetPart, alias] = raw.split('|', 2);
			const [targetBase, heading] = targetPart.split('#', 2);
			if (!targetBase) {
				continue;
			}

			wikilinks.push({
				raw: match[0],
				target: targetBase.trim(),
				alias: alias?.trim(),
				heading: heading?.trim(),
				line: lineNumber + 1,
			});
		}
	}

	return wikilinks;
}

export function extractHeadings(content: string): string[] {
	const headings: string[] = [];
	const lines = content.split('\n');
	for (const line of lines) {
		const match = line.match(HEADING_PATTERN);
		if (match) {
			headings.push(match[2].trim());
		}
	}
	return headings;
}

export function extractTags(frontmatter: Record<string, unknown>, content: string): string[] {
	const tags = new Set<string>();
	const fmTags = frontmatter.tags;

	if (typeof fmTags === 'string') {
		for (const tag of fmTags.split(',').map((tag) => tag.trim())) {
			if (tag) {
				tags.add(tag);
			}
		}
	} else if (Array.isArray(fmTags)) {
		for (const item of fmTags) {
			if (typeof item === 'string' && item.trim()) {
				tags.add(item.trim());
			}
		}
	}

	const hashTags = content.match(/#[A-Za-z0-9/_-]+/g);
	if (hashTags) {
		for (const tag of hashTags) {
			tags.add(tag.slice(1));
		}
	}

	return [...tags];
}

function parseSourceRefsFromCallout(lines: string[]): string[] {
	const refs = new Set<string>();
	for (const line of lines) {
		const match = line.match(/source::\s*(.*)/i);
		if (!match) {
			continue;
		}
		const trailing = match[1] ?? '';
		for (const link of extractWikilinks(trailing)) {
			refs.add(link.target);
		}
	}
	return [...refs];
}

function extractCalloutBlocks(content: string, kind: 'claim' | 'evidence'): CalloutBlock[] {
	const rawLines = content.split('\n');
	const results: CalloutBlock[] = [];
	const startPattern = new RegExp(`^>\\s*\\[!${kind}\\]\\b`, 'i');
	let lineIndex = 0;

	while (lineIndex < rawLines.length) {
		const line = rawLines[lineIndex];
		const trimmed = line.trim();

		if (!startPattern.test(trimmed)) {
			lineIndex += 1;
			continue;
		}

		const startLine = lineIndex + 1;
		const blockLines: string[] = [line];
		lineIndex += 1;

		while (lineIndex < rawLines.length) {
			const current = rawLines[lineIndex];
			if (current.trim() === '' && blockLines.length > 0) {
				blockLines.push(current);
				lineIndex += 1;
				continue;
			}

			if (!current.trim().startsWith('>')) {
				break;
			}
			blockLines.push(current);
			lineIndex += 1;
		}

		let blockId: string | undefined;
		if (lineIndex < rawLines.length && rawLines[lineIndex].match(CALLER_BLOCK_ID)) {
			blockId = rawLines[lineIndex].match(CALLER_BLOCK_ID)?.[1];
			lineIndex += 1;
		}

		const sourceRefs = parseSourceRefsFromCallout(blockLines);
		const contentText = blockLines
			.map((entry) => entry.replace(/^\s*>\s?/, ''))
			.join('\n')
			.trim();

		results.push({
			type: kind,
			rawHeader: blockLines[0]?.trim() ?? '',
			content: contentText,
			sourceRefs,
			blockId,
			line: startLine,
			endLine: lineIndex,
		});
	}

	return results;
}

export function extractBlockIds(content: string): string[] {
	const ids = new Set<string>();
	const lines = content.split('\n');
	for (const line of lines) {
		const match = line.match(CALLER_BLOCK_ID);
		if (match) {
			ids.add(match[1]);
		}
	}
	return [...ids];
}

export function parseMarkdown(rawContent: string): ParsedMarkdown {
	const normalized = rawContent.replace(/\r\n/g, '\n');
	const frontmatter = parseFrontmatter(normalized);
	const frontmatterTitle = typeof frontmatter.fields.title === 'string' ? frontmatter.fields.title : '';
	const tags = extractTags(frontmatter.fields, frontmatter.body);
	const headings = extractHeadings(frontmatter.body);
	const wikilinks = extractWikilinks(frontmatter.body);
	const blockIds = extractBlockIds(frontmatter.body);
	const claimBlocks = extractCalloutBlocks(frontmatter.body, 'claim');
	const evidenceBlocks = extractCalloutBlocks(frontmatter.body, 'evidence');
	const searchText = [frontmatterTitle, ...tags, ...headings, frontmatter.body].join('\n');

	return {
		frontmatter,
		title: frontmatterTitle,
		body: frontmatter.body,
		tags,
		headings,
		blockIds,
		wikilinks,
		claimBlocks,
		evidenceBlocks,
		searchText,
	};
}
