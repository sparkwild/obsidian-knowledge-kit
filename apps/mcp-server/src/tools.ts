import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { VaultPathError, buildContextPack, parseMarkdown, recallNotes, scanVault } from '@obs-wiki/core';
import {
	McpToolDefinition,
	McpStructuredToolResult,
	McpPrompt,
	isRecord,
} from './protocol';
import {
	ToolInputError,
	normalizeNotePath,
	relativeFromAbsolute,
	resolveSafeNotePath,
	toSafeVaultRoot,
} from './safety';

const REVIEW_QUEUE_PREFIX = '01_inbox/review_queue';
const AUDIT_LOG_PATH = '00_control/audit_log.md';
const MAX_LIST_QUEUE_ITEMS = 20;
const MAX_AUDIT_ITEMS = 20;

interface ToolContext {
	defaultVaultRoot?: string;
}

interface ToolArgs {
	vaultRoot?: unknown;
}

interface StatusArgs extends ToolArgs {}

interface StartTaskArgs extends ToolArgs {
	goal?: unknown;
	client?: unknown;
	project_hint?: unknown;
}

interface RecallArgs extends ToolArgs {
	query?: unknown;
	max_items?: unknown;
}

interface ReadNoteArgs extends ToolArgs {
	path?: unknown;
}

interface ListReviewQueueArgs extends ToolArgs {
	max_items?: unknown;
}

interface AuditRecentArgs extends ToolArgs {
	max_items?: unknown;
}

function toolResult(payload: unknown, isError = false): McpStructuredToolResult {
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(payload, null, 2),
			},
		],
		structuredContent: payload,
		isError,
	};
}

function toolError(message: string): McpStructuredToolResult {
	return toolResult({ ok: false, error: message }, true);
}

function vaultRootFromArgs(args: ToolArgs, context: ToolContext): string {
	if (args.vaultRoot !== undefined) {
		return toSafeVaultRoot(args.vaultRoot);
	}
	if (!context.defaultVaultRoot) {
		throw new ToolInputError('vaultRoot is required unless --vault-root is configured.');
	}
	return toSafeVaultRoot(context.defaultVaultRoot);
}

function coerceNonEmptyString(value: unknown, required = false): string {
	if (typeof value !== 'string' || value.trim() === '') {
		if (required) {
			throw new ToolInputError('Missing required string argument.');
		}
		return '';
	}
	return value.trim();
}

function coercePositiveInt(value: unknown, fallback: number, min = 1, max = 100): number {
	if (value === undefined || value === null) {
		return fallback;
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
		throw new ToolInputError('Expected integer within allowed bounds.');
	}
	return value;
}

function safeReadNote(vaultRoot: string, notePath: string): { path: string; text: string } {
	const normalized = normalizeNotePath(notePath);
	const absolute = resolveSafeNotePath(vaultRoot, normalized);
	return {
		path: relativeFromAbsolute(vaultRoot, absolute),
		text: fs.readFileSync(absolute, 'utf8'),
	};
}

function buildProjectCounts(scan: ReturnType<typeof scanVault>['notes']) {
	const typeCount: Record<string, number> = {};
	for (const note of scan) {
		const type = note.type ?? 'note';
		typeCount[type] = (typeCount[type] ?? 0) + 1;
	}
	return Object.entries(typeCount)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([type, count]) => ({ type, count }));
}

function buildRecentSessions(notes: ReturnType<typeof scanVault>['notes']) {
	return notes
		.filter((note) => note.relativePath.startsWith('02_timeline/sessions/'))
		.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
		.slice(0, 5)
		.map((note) => ({
			path: note.relativePath,
			title: note.title,
			modifiedAt: note.modifiedAt,
		}));
}

function buildUserPreferences(scan: ReturnType<typeof scanVault>) {
	const preferenceNote =
		scan.notes.find((note) => note.relativePath === '01_ai_core/longterm_context.md' || note.relativePath === '01_ai_core/active_context.md');

	if (!preferenceNote) {
		return { source: null, keys: [] };
	}

	const keys = Object.entries(preferenceNote.frontmatter)
		.filter(([key, value]) => value !== undefined && value !== null && String(value).trim() !== '')
		.filter(([key]) => key.includes('pref') || key.includes('preference') || key.includes('goal') || key.includes('style'))
		.map(([key, value]) => `${key}: ${String(value)}`);

	return {
		source: preferenceNote.relativePath,
		keys,
	};
}

function parseAuditSections(content: string) {
	const lines = content.split('\n');
	const sections: Array<{ heading: string; body: string[]; atLine: number }> = [];
	let currentHeading = '';
	let currentBody: string[] = [];
	let currentLine = 0;
	let started = false;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		const match = line.match(/^#{2,6}\s+(.+)$/);
		if (match) {
			if (started) {
				sections.push({
					heading: currentHeading,
					body: currentBody,
					atLine: currentLine,
				});
			}
			started = true;
			currentHeading = match[1]?.trim() ?? 'section';
			currentBody = [];
			currentLine = index + 1;
			continue;
		}
		if (!started) {
			continue;
		}
		currentBody.push(line);
	}

	if (started) {
		sections.push({
			heading: currentHeading,
			body: currentBody,
			atLine: currentLine,
		});
	}

	return sections;
}

function isPendingProposal(note: ReturnType<typeof scanVault>['notes'][number]) {
	const rawStatus = note.frontmatter.status;
	if (typeof rawStatus === 'string') {
		const status = rawStatus.toLowerCase();
		if (!['pending', 'todo', 'open', 'review'].some((token) => status.includes(token))) {
			return false;
		}
	}

	const proposalKind = note.frontmatter.proposal_kind;
	if (typeof proposalKind === 'string' && proposalKind.toLowerCase().trim() === 'memory') {
		return true;
	}
	if (typeof proposalKind === 'string' && proposalKind.toLowerCase().includes('proposal')) {
		return true;
	}

	return true;
}

export function toolDefinitions(): McpToolDefinition[] {
	return [
		{
			name: 'obs_wiki.status',
			title: 'obs_wiki.status',
			description: 'Scan vault and return read-only summary counts.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
				},
				additionalProperties: false,
			},
		},
		{
			name: 'obs_wiki.start_task',
			title: 'obs_wiki.start_task',
			description: 'Create a read-only task context pack summary and deterministic task id.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					goal: {
						type: 'string',
						description: 'Task goal statement.',
					},
					client: { type: 'string', description: 'Optional client context.' },
					project_hint: { type: 'string', description: 'Optional project hint.' },
				},
				required: ['goal'],
				additionalProperties: false,
			},
		},
		{
			name: 'obs_wiki.recall',
			title: 'obs_wiki.recall',
			description: 'Scan vault and return matching notes for a recall query.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					query: {
						type: 'string',
						description: 'Recall query text.',
					},
					max_items: {
						type: 'integer',
						description: 'Maximum number of matches to return.',
					},
				},
				required: ['query'],
				additionalProperties: false,
			},
		},
		{
			name: 'obs_wiki.read_note',
			title: 'obs_wiki.read_note',
			description: 'Read markdown/text content of one note in vault.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					path: {
						type: 'string',
						description: 'Vault-relative note path.',
					},
				},
				required: ['path'],
				additionalProperties: false,
			},
		},
		{
			name: 'obs_wiki.list_review_queue',
			title: 'obs_wiki.list_review_queue',
			description: 'Read pending memory proposal notes under 01_inbox/review_queue.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					max_items: {
						type: 'integer',
						description: 'Maximum number of pending entries.',
					},
				},
				additionalProperties: false,
			},
		},
		{
			name: 'obs_wiki.audit_recent',
			title: 'obs_wiki.audit_recent',
			description: 'Read parsed sections from 00_control/audit_log.md.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					max_items: {
						type: 'integer',
						description: 'Maximum number of parsed sections.',
					},
				},
				additionalProperties: false,
			},
		},
	];
}

export function toolPrompts(): McpPrompt[] {
	return [
		{ name: 'obs-wiki Start Task', title: 'obs-wiki Start Task', description: 'Start a task with a read-only context summary.' },
		{ name: 'obs-wiki Recall Memory', title: 'obs-wiki Recall Memory', description: 'Generate matching notes for fast recall.' },
	];
}

export function callTool(name: string, rawParams: unknown, context: ToolContext): McpStructuredToolResult {
	if (!isRecord(rawParams)) {
		return toolError('Tool arguments must be an object.');
	}

	try {
		switch (name) {
			case 'obs_wiki.status':
				return toolResult(handleStatus(rawParams as StatusArgs, context));
			case 'obs_wiki.start_task':
				return toolResult(handleStartTask(rawParams as StartTaskArgs, context));
			case 'obs_wiki.recall':
				return toolResult(handleRecall(rawParams as RecallArgs, context));
			case 'obs_wiki.read_note':
				return toolResult(handleReadNote(rawParams as ReadNoteArgs, context));
			case 'obs_wiki.list_review_queue':
				return toolResult(handleReviewQueue(rawParams as ListReviewQueueArgs, context));
			case 'obs_wiki.audit_recent':
				return toolResult(handleAuditRecent(rawParams as AuditRecentArgs, context));
			default:
				return toolError(`Unknown tool: ${name}`);
		}
	} catch (error) {
		if (error instanceof ToolInputError || error instanceof VaultPathError) {
			return toolError(error.message);
		}
		if (error instanceof Error) {
			return toolError(error.message);
		}
		return toolError('Unknown tool error.');
	}
}

function handleStatus(rawArgs: StatusArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const scan = scanVault(vaultRoot);

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		scanned_at: scan.scannedAt,
		counts: {
			notes: scan.notes.length,
			errors: scan.errors.length,
			by_type: buildProjectCounts(scan.notes),
		},
		scan_errors: scan.errors.slice(0, 5),
	};
}

function handleStartTask(rawArgs: StartTaskArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const goal = coerceNonEmptyString(rawArgs.goal, true);
	const client = coerceNonEmptyString(rawArgs.client);
	const projectHint = coerceNonEmptyString(rawArgs.project_hint);
	if (goal.length < 3) {
		throw new ToolInputError('goal must have at least 3 characters.');
	}

	const scan = scanVault(vaultRoot);
	const contextPack = buildContextPack(vaultRoot, goal, { limit: 8 });
	const taskId = `obs_task_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
	const relatedProjects = scan.notes
		.filter((note) => note.relativePath.startsWith('05_projects/'))
		.slice(0, 10)
		.map((note) => ({ path: note.relativePath, title: note.title }));

	return {
		ok: true,
		task_id: taskId,
		client: client || null,
		project_hint: projectHint || null,
		vault_root: vaultRoot,
		context_pack_summary: {
			query: contextPack.query,
			generated_at: contextPack.generatedAt,
			relevant_notes: contextPack.relevantNotes,
			source_candidates: contextPack.sourceCandidates.slice(0, 10),
			gaps: contextPack.gaps,
			stale_warnings: contextPack.staleWarnings,
		},
		related_projects: relatedProjects,
		recent_sessions: buildRecentSessions(scan.notes),
		user_preferences: buildUserPreferences(scan),
		recommended_next_tool: 'obs_wiki.recall',
	};
}

function handleRecall(rawArgs: RecallArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const query = coerceNonEmptyString(rawArgs.query, true);
	const maxItems = coercePositiveInt(rawArgs.max_items, 6, 1, 20);
	const scan = scanVault(vaultRoot);
	const matches = recallNotes(scan.notes, query, { limit: maxItems });

	return {
		ok: true,
		query,
		vault_root: vaultRoot,
		max_items: maxItems,
		matched_count: matches.length,
		matches: matches.map((match) => ({
			path: match.note.relativePath,
			title: match.note.title,
			type: match.note.type,
			score: match.score,
			matched_tokens: match.matchedTokens,
		})),
	};
}

function handleReadNote(rawArgs: ReadNoteArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const notePath = coerceNonEmptyString(rawArgs.path, true);
	const data = safeReadNote(vaultRoot, notePath);
	const parsed = parseMarkdown(data.text);

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		path: data.path,
		title: parsed.title || path.basename(data.path),
		mime_type: data.path.endsWith('.txt') || data.path.endsWith('.text') ? 'text/plain' : 'text/markdown',
		content: data.text,
		excerpt: parsed.body.slice(0, 1024),
	};
}

function handleReviewQueue(rawArgs: ListReviewQueueArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const maxItems = coercePositiveInt(rawArgs.max_items, MAX_LIST_QUEUE_ITEMS, 1, MAX_LIST_QUEUE_ITEMS);
	const scan = scanVault(vaultRoot);
	const pending = scan.notes
		.filter((note) => note.relativePath.startsWith(REVIEW_QUEUE_PREFIX))
		.filter(isPendingProposal)
		.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
		.slice(0, maxItems)
		.map((note) => ({
			path: note.relativePath,
			title: note.title,
			modifiedAt: note.modifiedAt,
			status: typeof note.frontmatter.status === 'string' ? note.frontmatter.status : 'pending',
			proposal_kind: note.frontmatter.proposal_kind || null,
			risk_level: note.frontmatter.risk_level || null,
		}));

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		count: pending.length,
		entries: pending,
	};
}

function handleAuditRecent(rawArgs: AuditRecentArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const maxItems = coercePositiveInt(rawArgs.max_items, MAX_AUDIT_ITEMS, 1, 100);
	const auditPath = resolveSafeNotePath(vaultRoot, AUDIT_LOG_PATH);
	const text = fs.readFileSync(auditPath, 'utf8');
	const sections = parseAuditSections(text).map((section) => ({
		heading: section.heading,
		line_start: section.atLine,
		body: section.body.join('\n').trim(),
	}));

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		audit_log: relativeFromAbsolute(vaultRoot, auditPath),
		total_sections: sections.length,
		sections: sections.slice(0, maxItems),
	};
}
