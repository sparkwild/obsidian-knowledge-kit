import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
	VaultPathError,
	analyzeSourceText,
	type SourceAnalysisResult,
	buildContextPack,
	parseMarkdown,
	recallNotes,
	scanVault,
} from '@obs-wiki/core';
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
	resolveSafeWritableNotePath,
	assertNoSymlinkSegments,
	toSafeVaultRoot,
} from './safety';

const REVIEW_QUEUE_PREFIX = '01_inbox/review_queue';
const AUDIT_LOG_PATH = '00_control/audit_log.md';
const MAX_LIST_QUEUE_ITEMS = 20;
const MAX_AUDIT_ITEMS = 20;
const MAX_APPROVED_WRITEBACKS = 20;
const CONTEXT_PACK_DIR = '06_outputs/context_packs';
const SESSION_NOTE_DIR = '02_timeline/sessions';
const SOURCE_REQUESTS_DIR = '01_inbox/agent_requests';
const SOURCES_DIR = '03_sources';
const SOURCE_ANALYSIS_REPORT_DIR = '06_outputs/source_analysis';
const MEMORY_PROPOSAL_DIR = '01_inbox/review_queue';
const MAX_SOURCE_EXCERPT_LENGTH = 1000;

type CaptureSourceMode = 'external_reference' | 'extracted_snapshot' | 'local_copy';
type SensitiveTextScan = { ok: true } | { ok: false; reason: string };

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

interface WriteContextPackArgs extends ToolArgs {
	filename?: unknown;
	content?: unknown;
	title?: unknown;
	task_id?: unknown;
}

interface WriteSessionNoteArgs extends ToolArgs {
	filename?: unknown;
	content?: unknown;
	task_id?: unknown;
}

interface CaptureSourceArgs extends ToolArgs {
	source?: unknown;
	source_kind?: unknown;
	capture_reason?: unknown;
	task_id?: unknown;
	related_project?: unknown;
	mode?: unknown;
	filename?: unknown;
	title?: unknown;
	content?: unknown;
	text?: unknown;
}

interface ProposeMemoryArgs extends ToolArgs {
	proposal_kind?: unknown;
	content?: unknown;
	evidence?: unknown;
	target_note?: unknown;
	risk_level?: unknown;
	task_id?: unknown;
	filename?: unknown;
	title?: unknown;
}

interface ListApprovedWritebacksArgs extends ToolArgs {
	scope?: unknown;
	max_items?: unknown;
	limit?: unknown;
}

interface ApplyApprovedWritebackArgs extends ToolArgs {
	proposal_id?: unknown;
	proposal_path?: unknown;
	path?: unknown;
	dry_run?: unknown;
}

interface ListSourceRequestsArgs extends ToolArgs {
	max_items?: unknown;
	status?: unknown;
	source_kind?: unknown;
}

interface AnalyzeSourceRequestArgs extends ToolArgs {
	request_path?: unknown;
	path?: unknown;
	update_request_status?: unknown;
	force_reprocess?: unknown;
}

interface SourceRequestRecord {
	type: string;
	path: string;
	source: string;
	sourceKind: string;
	purpose: string;
	relatedProject: string;
	analysisMode: string;
	status: string;
	created: string;
	content: string;
	filename: string;
}

interface AuditEventInput {
	tool: string;
	targetPath: string;
	status: 'written' | 'skipped' | 'failed';
	taskId?: string | null;
	warnings?: string[];
	metadata?: Record<string, unknown>;
}

interface AuditEventOutput {
	path: string;
}

interface MemoryProposalDocument {
	absolutePath: string;
	path: string;
	proposalId: string;
	proposalKind: string;
	approvalStatus: string;
	targetNote: string;
	riskLevel: string;
	taskId: string;
	body: string;
	text: string;
	frontmatter: Record<string, unknown>;
}

interface WritebackPlan {
	proposal: MemoryProposalDocument;
	targetNote: string;
	writebackContent: string;
	ready: boolean;
	reason?: string;
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

function coerceNonEmptyString(value: unknown, required = false, field = 'value'): string {
	if (typeof value !== 'string' || value.trim() === '') {
		if (required) {
			throw new ToolInputError(`Missing required string argument: ${field}.`);
		}
		return '';
	}
	return value.trim();
}

function coerceOptionalString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
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

function coerceBoolean(value: unknown, field: string, fallback = false): boolean {
	if (value === undefined || value === null) {
		return fallback;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
			return true;
		}
		if (normalized === 'false' || normalized === '0' || normalized === 'no') {
			return false;
		}
	}
	throw new ToolInputError(`Invalid boolean argument: ${field}.`);
}

function sanitizeYamlValue(value: unknown): string {
	if (value === null || value === undefined) {
		return 'null';
	}
	if (typeof value === 'string') {
		return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return JSON.stringify(value);
}

function buildYamlFrontMatter(frontmatter: Record<string, unknown>): string {
	const entries = Object.entries(frontmatter)
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}: ${sanitizeYamlValue(value)}`);
	const body = entries.length === 0 ? '' : `${entries.join('\n')}`;
	return `---\n${body}\n---`;
}

function buildMarkdownNote(frontmatter: Record<string, unknown>, body: string): string {
	const front = buildYamlFrontMatter(frontmatter);
	return `${front}\n\n${body.trim()}\n`;
}

function scanSensitiveText(value: string): SensitiveTextScan {
	const patterns: Array<{ pattern: RegExp; reason: string }> = [
		{ pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, reason: 'private key block' },
		{ pattern: /\b(?:password|passwd|api[_-]?key|secret|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*['"]?[^'"\s]+/i, reason: 'credential assignment' },
		{ pattern: /[?&](?:token|access_token|refresh_token|api_key|apikey|key|secret)=([^&#\s]+)/i, reason: 'secret-like URL query parameter' },
		{ pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/, reason: 'secret key token' },
	];

	for (const item of patterns) {
		if (item.pattern.test(value)) {
			return { ok: false, reason: item.reason };
		}
	}
	return { ok: true };
}

function assertNoSensitiveText(values: Array<{ label: string; value: string }>): void {
	for (const item of values) {
		if (!item.value) {
			continue;
		}
		const scan = scanSensitiveText(item.value);
		if (!scan.ok) {
			throw new ToolInputError(`Refusing to write potential secret in ${item.label}: ${scan.reason}.`);
		}
	}
}

function toText(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'string') {
		return value.trim();
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value
			.map((entry) => toText(entry))
			.filter((entry) => entry.length > 0)
			.join('\n');
	}
	return '';
}

function readFrontmatterString(frontmatter: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = frontmatter[key];
		if (value === undefined) {
			continue;
		}
		const text = toText(value);
		if (text) {
			return text;
		}
	}
	return '';
}

function isLikelyVaultPath(value: string, sourceKind: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) {
		return false;
	}
	if (trimmed.includes('\n') || trimmed.includes('\r')) {
		return false;
	}
	if (/^https?:\/\//i.test(trimmed) || /^(mailto:|file:|ftp:)/i.test(trimmed)) {
		return false;
	}
	if (['url', 'selection', 'http', 'external'].includes(sourceKind.toLowerCase())) {
		return false;
	}
	if (trimmed.startsWith('.') && !trimmed.includes('/')) {
		return false;
	}
	return /\.(md|markdown|txt)$/i.test(trimmed) || trimmed.includes('/') || sourceKind === 'current_note' || sourceKind === 'local_file';
}

function isSourceRequestPending(status: string): boolean {
	const normalized = status.toLowerCase();
	return ['pending', 'todo', 'open', 'queued', 'new'].includes(normalized);
}

function isUrlSource(source: string): boolean {
	return /^https?:\/\//i.test(source.trim());
}

function safeReadNote(vaultRoot: string, notePath: string): { path: string; text: string } {
	const normalized = normalizeNotePath(notePath);
	const absolute = resolveSafeNotePath(vaultRoot, normalized);
	return {
		path: relativeFromAbsolute(vaultRoot, absolute),
		text: fs.readFileSync(absolute, 'utf8'),
	};
}

function safeReadTextFile(vaultRoot: string, notePath: string): string {
	const normalized = normalizeNotePath(notePath);
	const absolute = resolveSafeNotePath(vaultRoot, normalized);
	assertNoSymlinkSegments(vaultRoot, absolute);
	return fs.readFileSync(absolute, 'utf8');
}

function assertSourceRequestPath(relativePath: string): void {
	if (!relativePath.startsWith(`${SOURCE_REQUESTS_DIR}/`)) {
		throw new ToolInputError(`Source request path must be under ${SOURCE_REQUESTS_DIR}.`);
	}
}

function readSourceRequest(vaultRoot: string, requestPath: string): SourceRequestRecord {
	const data = safeReadNote(vaultRoot, requestPath);
	assertSourceRequestPath(data.path);
	const parsed = parseMarkdown(data.text);
	const frontmatter = parsed.frontmatter.fields;
	const sourceKind = readFrontmatterString(frontmatter, ['source_kind', 'sourceKind', 'source-kind']);
	const status = readFrontmatterString(frontmatter, ['status']) || 'pending';
	const requestPathRelative = data.path;

	return {
		path: requestPathRelative,
		type: readFrontmatterString(frontmatter, ['type']) || 'agent-request',
		source: readFrontmatterString(frontmatter, ['source']),
		sourceKind: sourceKind || 'unknown',
		purpose: readFrontmatterString(frontmatter, ['purpose']),
		relatedProject: readFrontmatterString(frontmatter, ['related_project', 'relatedProject']),
		analysisMode: readFrontmatterString(frontmatter, ['analysis_mode', 'analysisMode']) || 'default',
		status,
		created: readFrontmatterString(frontmatter, ['created']) || '',
		content: parsed.body,
		filename: requestPathRelative,
	};
}

function stripYamlQuotes(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function assertReviewQueuePath(relativePath: string): void {
	if (!relativePath.startsWith(`${REVIEW_QUEUE_PREFIX}/`)) {
		throw new ToolInputError(`Memory proposal path must be under ${REVIEW_QUEUE_PREFIX}.`);
	}
}

function readProposalApprovalStatus(frontmatter: Record<string, unknown>): string {
	return stripYamlQuotes(
		readFrontmatterString(frontmatter, ['approval_status', 'approvalStatus', 'status']) || 'pending'
	)
		.toLowerCase()
		.replace(/\s+/g, '_');
}

function isMemoryProposalFrontmatter(frontmatter: Record<string, unknown>): boolean {
	const type = stripYamlQuotes(readFrontmatterString(frontmatter, ['type'])).toLowerCase();
	if (!type) {
		return Boolean(readFrontmatterString(frontmatter, ['proposal_kind', 'proposalKind']));
	}
	return type.includes('memory-proposal') || type.includes('memory_proposal');
}

function readMemoryProposal(vaultRoot: string, proposalPath: string): MemoryProposalDocument {
	const normalized = normalizeNotePath(proposalPath);
	const absolutePath = resolveSafeNotePath(vaultRoot, normalized);
	const relative = relativeFromAbsolute(vaultRoot, absolutePath);
	assertReviewQueuePath(relative);

	const text = fs.readFileSync(absolutePath, 'utf8');
	const parsed = parseMarkdown(text);
	const frontmatter = parsed.frontmatter.fields;
	if (!isMemoryProposalFrontmatter(frontmatter)) {
		throw new ToolInputError(`Review Queue note is not a memory proposal: ${relative}`);
	}

	return {
		absolutePath,
		path: relative,
		proposalId:
			stripYamlQuotes(readFrontmatterString(frontmatter, ['proposal_id', 'proposalId'])) ||
			path.basename(relative, path.extname(relative)),
		proposalKind: stripYamlQuotes(readFrontmatterString(frontmatter, ['proposal_kind', 'proposalKind'])) || 'unknown',
		approvalStatus: readProposalApprovalStatus(frontmatter),
		targetNote: stripYamlQuotes(readFrontmatterString(frontmatter, ['target_note', 'targetNote'])),
		riskLevel: stripYamlQuotes(readFrontmatterString(frontmatter, ['risk_level', 'riskLevel'])) || 'unknown',
		taskId: stripYamlQuotes(readFrontmatterString(frontmatter, ['task_id', 'taskId'])),
		body: parsed.body,
		text,
		frontmatter,
	};
}

function findMemoryProposalPathById(vaultRoot: string, proposalId: string): string {
	const normalizedId = stripYamlQuotes(proposalId);
	if (!normalizedId) {
		throw new ToolInputError('proposal_id is required.');
	}

	const scan = scanVault(vaultRoot);
	const match = scan.notes.find((note) => {
		if (!note.relativePath.startsWith(`${REVIEW_QUEUE_PREFIX}/`)) {
			return false;
		}
		const noteProposalId =
			stripYamlQuotes(readFrontmatterString(note.frontmatter, ['proposal_id', 'proposalId'])) ||
			path.basename(note.relativePath, path.extname(note.relativePath));
		return noteProposalId === normalizedId || note.relativePath === normalizedId;
	});

	if (!match) {
		throw new ToolInputError(`Approved writeback proposal not found: ${normalizedId}`);
	}
	return match.relativePath;
}

function resolveMemoryProposalFromArgs(
	vaultRoot: string,
	rawArgs: ApplyApprovedWritebackArgs
): MemoryProposalDocument {
	const explicitPath = coerceOptionalString(rawArgs.proposal_path) || coerceOptionalString(rawArgs.path);
	if (explicitPath) {
		return readMemoryProposal(vaultRoot, explicitPath);
	}

	const proposalId = coerceOptionalString(rawArgs.proposal_id);
	if (!proposalId) {
		throw new ToolInputError('proposal_id or proposal_path is required.');
	}
	return readMemoryProposal(vaultRoot, findMemoryProposalPathById(vaultRoot, proposalId));
}

function extractMarkdownSection(body: string, allowedHeadings: string[]): string {
	const allowed = new Set(allowedHeadings.map((heading) => heading.toLowerCase()));
	const lines = body.replace(/\r\n/g, '\n').split('\n');
	const collected: string[] = [];
	let capturing = false;

	for (const line of lines) {
		const headingMatch = line.match(/^#{2,6}\s+(.+?)\s*$/);
		if (headingMatch) {
			const heading = (headingMatch[1] || '').trim().toLowerCase();
			if (capturing) {
				break;
			}
			if (allowed.has(heading)) {
				capturing = true;
			}
			continue;
		}

		if (capturing) {
			collected.push(line);
		}
	}

	return collected.join('\n').trim();
}

function buildWritebackPlan(proposal: MemoryProposalDocument): WritebackPlan {
	const frontmatterWriteback = stripYamlQuotes(
		readFrontmatterString(proposal.frontmatter, ['writeback_content', 'writebackContent'])
	);
	const writebackContent =
		frontmatterWriteback ||
		extractMarkdownSection(proposal.body, ['writeback', 'approved writeback', 'writeback content']);

	if (proposal.approvalStatus !== 'approved') {
		return {
			proposal,
			targetNote: proposal.targetNote,
			writebackContent,
			ready: false,
			reason: `proposal approval_status/status is ${proposal.approvalStatus}`,
		};
	}
	if (!proposal.targetNote) {
		return {
			proposal,
			targetNote: proposal.targetNote,
			writebackContent,
			ready: false,
			reason: 'target_note is required',
		};
	}
	if (!writebackContent) {
		return {
			proposal,
			targetNote: proposal.targetNote,
			writebackContent,
			ready: false,
			reason: 'approved proposal must include ## Writeback content',
		};
	}

	return {
		proposal,
		targetNote: proposal.targetNote,
		writebackContent,
		ready: true,
	};
}

function formatFrontmatterUpdateValue(value: string): string {
	if (/^[A-Za-z0-9._/-]+$/.test(value)) {
		return value;
	}
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function updateFrontmatterFields(content: string, fields: Record<string, string>): string {
	const normalized = content.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	const renderedFields = Object.entries(fields).map(
		([key, value]) => `${key}: ${formatFrontmatterUpdateValue(value)}`
	);

	if (lines.length === 0 || lines[0].trim() !== '---') {
		return ['---', ...renderedFields, '---', normalized].join('\n');
	}

	let end = -1;
	for (let index = 1; index < lines.length; index += 1) {
		if (lines[index].trim() === '---') {
			end = index;
			break;
		}
	}
	if (end < 0) {
		return ['---', ...renderedFields, '---', normalized].join('\n');
	}

	const pending = new Map(Object.entries(fields));
	const frontmatterLines = lines.slice(1, end).map((line) => {
		const pair = line.match(/^(\s*)([^:#]+):\s*(.*)$/);
		if (!pair) {
			return line;
		}
		const key = pair[2]?.trim() || '';
		const nextValue = pending.get(key);
		if (nextValue === undefined) {
			return line;
		}
		pending.delete(key);
		return `${pair[1] || ''}${key}: ${formatFrontmatterUpdateValue(nextValue)}`;
	});

	for (const [key, value] of pending) {
		frontmatterLines.push(`${key}: ${formatFrontmatterUpdateValue(value)}`);
	}

	return ['---', ...frontmatterLines, '---', ...lines.slice(end + 1)].join('\n');
}

function assertAllowedWritebackTarget(relativePath: string): void {
	const forbiddenPrefixes = [
		'00_control/',
		'01_inbox/',
		'03_sources/',
		'06_outputs/',
	];
	for (const prefix of forbiddenPrefixes) {
		if (relativePath.startsWith(prefix)) {
			throw new ToolInputError(`Approved writeback target is protected from direct apply: ${relativePath}`);
		}
	}
}

function extractSelectionText(sourceBody: string): string {
	const marker = '## Selected Text';
	const markerIndex = sourceBody.indexOf(marker);
	if (markerIndex >= 0) {
		const selected = sourceBody.slice(markerIndex + marker.length).trim();
		return selected
			.split('\n')
			.map((line) => line.replace(/^>\s?/, ''))
			.join('\n')
			.trim();
	}

	const bodyLines = sourceBody.split('\n');
	const contentLines: string[] = [];
	let started = false;
	for (const line of bodyLines) {
		if (!started) {
			if (line.startsWith('- ')) {
				continue;
			}
			if (line.startsWith('#')) {
				continue;
			}
			if (line.trim() === '') {
				continue;
			}
			started = true;
		}
		contentLines.push(line);
	}
	return contentLines.join('\n').trim();
}

function resolveRequestStatusPath(vaultRoot: string, requestPath: string): string {
	const normalized = normalizeNotePath(requestPath);
	const absolute = resolveSafeNotePath(vaultRoot, normalized);
	const relative = relativeFromAbsolute(vaultRoot, absolute);
	assertSourceRequestPath(relative);
	assertNoSymlinkSegments(vaultRoot, absolute);
	return absolute;
}

function updateRequestStatus(vaultRoot: string, requestPath: string, nextStatus: string): { path: string } {
	const absolutePath = resolveRequestStatusPath(vaultRoot, requestPath);
	let text = fs.readFileSync(absolutePath, 'utf8');
	const fmMatch = text.match(/^---\n[\s\S]*?\n---\n?/);
	if (!fmMatch) {
		throw new ToolInputError(`Request note does not have frontmatter: ${requestPath}`);
	}

	const fmBlock = fmMatch[0];
	const fmStart = fmBlock.length;
	const body = text.slice(fmStart);
	const hasStatus = /^status:\s*/m.test(fmBlock);

	let updatedFrontmatter = fmBlock;
	if (hasStatus) {
		updatedFrontmatter = fmBlock.replace(/^status:\s*.*$/m, `status: ${nextStatus}`);
	} else {
		updatedFrontmatter = fmBlock.replace(/\n---\n?$/, `\nstatus: ${nextStatus}\n---\n`);
	}

	text = `${updatedFrontmatter}${body}`;
	fs.writeFileSync(absolutePath, text, 'utf8');

	return {
		path: relativeFromAbsolute(vaultRoot, absolutePath),
	};
}

function parseOptionalIntendedSourcePath(rawSource: string, sourceKind: string): { requestedPath?: string; inferredText?: string } {
	const source = rawSource.trim();
	if (!source) {
		return {};
	}

	if (isUrlSource(source)) {
		return {};
	}

	if (!isLikelyVaultPath(source, sourceKind)) {
		return {};
	}

	return { requestedPath: source };
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
	const status = readProposalApprovalStatus(note.frontmatter);
	if (!['pending', 'todo', 'open', 'review'].some((token) => status.includes(token))) {
		return false;
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

function coerceCaptureMode(value: unknown): CaptureSourceMode {
	const mode = coerceNonEmptyString(value, true, 'mode').toLowerCase();
	switch (mode) {
		case 'external_reference':
		case 'extracted_snapshot':
		case 'local_copy':
			return mode;
		default:
			throw new ToolInputError('capture_source mode must be one of: external_reference | extracted_snapshot | local_copy');
	}
}

function buildSafeFilename(rawFilename: unknown, fallbackPrefix: string): string {
	const candidate = coerceOptionalString(rawFilename);
	if (candidate) {
		return normalizeNotePath(candidate);
	}
	const now = new Date().toISOString().replace(/[:.]/g, '-');
	const token = crypto.randomUUID().slice(0, 8);
	return `${fallbackPrefix}_${now}_${token}`;
}

function buildAndWriteNote(
	vaultRoot: string,
	toolName: string,
	allowedDir: string,
	filename: string,
	frontmatter: Record<string, unknown>,
	body: string,
	taskId: string | null,
	metadata: Record<string, unknown> = {}
): { path: string; audit_path: string; status: string; warnings: string[] } {
	const safeLeaf = normalizeNotePath(filename);
	const normalized = safeLeaf.endsWith('.md') ? safeLeaf : `${safeLeaf}.md`;
	const targetPath = `${allowedDir}/${normalized}`;
	const resolved = resolveSafeWritableNotePath(vaultRoot, targetPath, allowedDir);
	fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
	if (fs.existsSync(resolved.absolutePath)) {
		throw new ToolInputError(`Target already exists: ${resolved.relativePath}`);
	}

	const markdown = buildMarkdownNote(frontmatter, body);
	fs.writeFileSync(resolved.absolutePath, markdown, 'utf8');

	const audit = appendAuditEvent(vaultRoot, {
		tool: toolName,
		targetPath: resolved.relativePath,
		status: 'written',
		taskId,
		metadata,
	});

	return {
		path: resolved.relativePath,
		audit_path: audit.path,
		status: 'written',
		warnings: [],
	};
}

function ensureAuditLog(vaultRoot: string): { absolute: string; relative: string } {
	const safeAuditPath = normalizeNotePath(AUDIT_LOG_PATH);
	const absolute = path.resolve(vaultRoot, safeAuditPath);
	const relative = path.relative(vaultRoot, absolute).replace(/\\/g, '/');
	if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new ToolInputError('Audit log path must be inside vault.');
	}
	assertNoSymlinkSegments(vaultRoot, absolute);
	fs.mkdirSync(path.dirname(absolute), { recursive: true });
	if (!fs.existsSync(absolute)) {
		fs.writeFileSync(absolute, '# Audit Log\n\n');
	}
	return { absolute, relative };
}

function appendAuditEvent(vaultRoot: string, input: AuditEventInput): AuditEventOutput {
	const audit = ensureAuditLog(vaultRoot);
	const eventLines = [
		`## ${new Date().toISOString()} ${input.tool}`,
		`- status: ${input.status}`,
		`- target_path: ${input.targetPath}`,
	];
	if (input.taskId) {
		eventLines.push(`- task_id: ${input.taskId}`);
	}
	if (input.warnings && input.warnings.length > 0) {
		eventLines.push(`- warnings: ${JSON.stringify(input.warnings)}`);
	}
	if (input.metadata && Object.keys(input.metadata).length > 0) {
		const entries = Object.entries(input.metadata).filter(([, value]) => value !== undefined);
		for (const [key, value] of entries) {
			eventLines.push(`- ${key}: ${sanitizeYamlValue(value)}`);
		}
	}

	fs.appendFileSync(audit.absolute, `${eventLines.join('\n')}\n\n`);
	return { path: audit.relative };
}

function makeToolResultForWrite(tool: string, payload: ReturnType<typeof buildAndWriteNote>) {
	return {
		ok: true,
		tool,
		status: payload.status,
		path: payload.path,
		audit_path: payload.audit_path,
		warnings: payload.warnings,
	};
}

export function toolDefinitions(): McpToolDefinition[] {
	return [
		{
			name: 'obs_wiki.status',
			title: 'obs_wiki.status',
			description: '[read-only] Scan vault and return summary counts.',
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
			description: '[read-only] Create a task context pack summary and deterministic task id.',
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
			annotations: {
				readOnlyHint: true,
			},
		},
		{
			name: 'obs_wiki.recall',
			title: 'obs_wiki.recall',
			description: '[read-only] Scan vault and return matching notes for a recall query.',
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
			annotations: {
				readOnlyHint: true,
			},
		},
		{
			name: 'obs_wiki.read_note',
			title: 'obs_wiki.read_note',
			description: '[read-only] Read markdown/text content of one note in vault.',
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
			annotations: {
				readOnlyHint: true,
			},
		},
		{
			name: 'obs_wiki.list_review_queue',
			title: 'obs_wiki.list_review_queue',
			description: '[read-only] Read pending memory proposal notes under 01_inbox/review_queue.',
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
			name: 'obs_wiki.list_source_requests',
			title: 'obs_wiki.list_source_requests',
			description: '[read-only] Read pending source-analysis agent requests under 01_inbox/agent_requests.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					max_items: {
						type: 'integer',
						description: 'Maximum number of pending requests to return.',
					},
					status: {
						type: 'string',
						description: 'Optional status filter, defaults to pending.',
					},
					source_kind: {
						type: 'string',
						description: 'Optional source kind filter.',
					},
				},
				additionalProperties: false,
			},
		},
		{
			name: 'obs_wiki.list_approved_writebacks',
			title: 'obs_wiki.list_approved_writebacks',
			description: '[read-only] Read approved Review Queue proposals that are candidates for runtime writeback.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					scope: {
						type: 'string',
						description: 'Optional proposal kind or target-note prefix filter.',
					},
					max_items: {
						type: 'integer',
						description: 'Maximum number of approved writebacks to return.',
					},
					limit: {
						type: 'integer',
						description: 'Alias of max_items.',
					},
				},
				additionalProperties: false,
			},
			annotations: {
				readOnlyHint: true,
			},
		},
		{
			name: 'obs_wiki.audit_recent',
			title: 'obs_wiki.audit_recent',
			description: '[read-only] Read parsed sections from 00_control/audit_log.md.',
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
			annotations: {
				readOnlyHint: true,
			},
		},
		{
			name: 'obs_wiki.analyze_source_request',
			title: 'obs_wiki.analyze_source_request',
			description:
				'[low-risk write] Analyze one pending source request and write source note, report, review proposals, request status, and audit entry.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					request_path: {
						type: 'string',
						description: 'Vault-relative path to an agent-request note.',
					},
					path: {
						type: 'string',
						description: 'Alias of request_path.',
					},
					update_request_status: {
						type: 'boolean',
						description: 'Whether to update request status to completed/failed. Defaults to true.',
					},
					force_reprocess: {
						type: 'boolean',
						description: 'Process request even if status is not pending.',
					},
				},
				additionalProperties: false,
			},
			annotations: {
				destructiveHint: true,
			},
		},
		{
			name: 'obs_wiki.apply_approved_writeback',
			title: 'obs_wiki.apply_approved_writeback',
			description:
				'[review-gated apply] Apply an approved Review Queue proposal by appending explicit writeback content to its target note.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: {
						type: 'string',
						description: 'Vault root path. If omitted, uses server configured --vault-root.',
					},
					proposal_id: {
						type: 'string',
						description: 'Proposal id to apply.',
					},
					proposal_path: {
						type: 'string',
						description: 'Vault-relative proposal note path.',
					},
					path: {
						type: 'string',
						description: 'Alias of proposal_path.',
					},
					dry_run: {
						type: 'boolean',
						description: 'When true, return the writeback plan without modifying files.',
					},
				},
				additionalProperties: false,
			},
			annotations: {
				destructiveHint: true,
			},
		},
		{
			name: 'obs_wiki.write_context_pack',
			title: 'obs_wiki.write_context_pack',
			description: '[low-risk write] Create a new context-pack note under 06_outputs/context_packs.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: { type: 'string', description: 'Vault root path. If omitted, uses server configured --vault-root.' },
					filename: {
						type: 'string',
						description: 'Optional file stem. If omitted, auto-generates one.',
					},
					title: { type: 'string', description: 'Optional note title.' },
					content: { type: 'string', description: 'Context pack markdown/text content.' },
					task_id: { type: 'string', description: 'Optional task id for traceability.' },
				},
				required: ['content'],
				additionalProperties: false,
			},
			annotations: {
				destructiveHint: true,
			},
		},
		{
			name: 'obs_wiki.write_session_note',
			title: 'obs_wiki.write_session_note',
			description: '[low-risk write] Create a new session note under 02_timeline/sessions.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: { type: 'string', description: 'Vault root path. If omitted, uses server configured --vault-root.' },
					filename: {
						type: 'string',
						description: 'Optional file stem. If omitted, auto-generates one.',
					},
					content: { type: 'string', description: 'Session content.' },
					task_id: { type: 'string', description: 'Optional task id for traceability.' },
				},
				required: ['content'],
				additionalProperties: false,
			},
			annotations: {
				destructiveHint: true,
			},
		},
		{
			name: 'obs_wiki.capture_source',
			title: 'obs_wiki.capture_source',
			description: '[low-risk write] Capture source metadata/content under 03_sources with mode control.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: { type: 'string', description: 'Vault root path. If omitted, uses server configured --vault-root.' },
					source: { type: 'string', description: 'Source identifier (usually URL or local path).' },
					source_kind: { type: 'string', description: 'Source type label (optional).' },
					capture_reason: { type: 'string', description: 'Capture reason.' },
					task_id: { type: 'string', description: 'Optional task id for traceability.' },
					related_project: { type: 'string', description: 'Optional project hint.' },
					mode: {
						type: 'string',
						enum: ['external_reference', 'extracted_snapshot', 'local_copy'],
						description: 'Capture mode.',
					},
					filename: {
						type: 'string',
						description: 'Optional file stem. If omitted, auto-generates one.',
					},
					title: { type: 'string', description: 'Optional source note title.' },
					content: { type: 'string', description: 'Required when mode is extracted_snapshot or local_copy.' },
					text: { type: 'string', description: 'Alias of content for compatibility.' },
				},
				required: ['source', 'mode'],
				additionalProperties: false,
			},
			annotations: {
				destructiveHint: true,
			},
		},
		{
			name: 'obs_wiki.propose_memory',
			title: 'obs_wiki.propose_memory',
			description: '[low-risk write] Create a memory proposal note under 01_inbox/review_queue.',
			inputSchema: {
				type: 'object',
				properties: {
					vaultRoot: { type: 'string', description: 'Vault root path. If omitted, uses server configured --vault-root.' },
					proposal_kind: { type: 'string', description: 'Proposal kind.' },
					content: { type: 'string', description: 'Proposal markdown/text content.' },
					evidence: { type: 'string', description: 'Optional evidence summary.' },
					target_note: { type: 'string', description: 'Optional target note path.' },
					risk_level: { type: 'string', description: 'Risk level label.' },
					task_id: { type: 'string', description: 'Optional task id for traceability.' },
					filename: {
						type: 'string',
						description: 'Optional file stem. If omitted, auto-generates one.',
					},
					title: { type: 'string', description: 'Optional proposal title.' },
				},
				required: ['proposal_kind', 'content'],
				additionalProperties: false,
			},
			annotations: {
				destructiveHint: true,
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
			case 'obs_wiki.list_source_requests':
				return toolResult(handleListSourceRequests(rawParams as ListSourceRequestsArgs, context));
			case 'obs_wiki.list_approved_writebacks':
				return toolResult(handleListApprovedWritebacks(rawParams as ListApprovedWritebacksArgs, context));
			case 'obs_wiki.audit_recent':
				return toolResult(handleAuditRecent(rawParams as AuditRecentArgs, context));
			case 'obs_wiki.analyze_source_request':
				return toolResult(handleAnalyzeSourceRequest(rawParams as AnalyzeSourceRequestArgs, context));
			case 'obs_wiki.apply_approved_writeback':
				return toolResult(handleApplyApprovedWriteback(rawParams as ApplyApprovedWritebackArgs, context));
			case 'obs_wiki.write_context_pack':
				return toolResult(handleWriteContextPack(rawParams as WriteContextPackArgs, context));
			case 'obs_wiki.write_session_note':
				return toolResult(handleWriteSessionNote(rawParams as WriteSessionNoteArgs, context));
			case 'obs_wiki.capture_source':
				return toolResult(handleCaptureSource(rawParams as CaptureSourceArgs, context));
			case 'obs_wiki.propose_memory':
				return toolResult(handleProposeMemory(rawParams as ProposeMemoryArgs, context));
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
	const goal = coerceNonEmptyString(rawArgs.goal, true, 'goal');
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
	const query = coerceNonEmptyString(rawArgs.query, true, 'query');
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
	const notePath = coerceNonEmptyString(rawArgs.path, true, 'path');
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

function handleListSourceRequests(rawArgs: ListSourceRequestsArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const maxItems = coercePositiveInt(rawArgs.max_items, MAX_LIST_QUEUE_ITEMS, 1, MAX_LIST_QUEUE_ITEMS);
	const statusFilter = coerceOptionalString(rawArgs.status) || 'pending';
	const sourceKindFilter = coerceOptionalString(rawArgs.source_kind).toLowerCase();
	const scan = scanVault(vaultRoot);
	const normalizedStatus = statusFilter.toLowerCase().trim();

	const requests = scan.notes
		.filter((note) => note.relativePath.startsWith(`${SOURCE_REQUESTS_DIR}/`))
		.filter((note) => {
			const noteType = typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
			return noteType.includes('agent-request');
		})
		.map((note) => ({
			path: note.relativePath,
			source: String(note.frontmatter.source || ''),
			sourceKind: String(note.frontmatter.source_kind || note.frontmatter.sourceKind || note.frontmatter.sourcekind || ''),
			purpose: String(note.frontmatter.purpose || ''),
			relatedProject: String(
				note.frontmatter.related_project || note.frontmatter.relatedProject || ''
			),
			analysisMode: String(note.frontmatter.analysis_mode || note.frontmatter.analysisMode || 'default'),
			status: String(note.frontmatter.status || 'pending'),
			modifiedAt: note.modifiedAt,
		}))
		.filter((request) => sourceKindFilter === '' || request.sourceKind.toLowerCase() === sourceKindFilter)
		.filter((request) => {
			if (!normalizedStatus || normalizedStatus === 'pending') {
				return isSourceRequestPending(request.status);
			}
			return request.status.toLowerCase() === normalizedStatus;
		})
		.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
		.slice(0, maxItems);

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		count: requests.length,
		filter: {
			status: statusFilter || 'pending',
			source_kind: sourceKindFilter || 'any',
		},
		entries: requests,
	};
}

function buildSourceRunToken(request: SourceRequestRecord): string {
	const safeRequest = request.filename
		.replace(/\.[^/.]+$/, '')
		.replace(/[^a-z0-9._-]+/gi, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return `${safeRequest}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function resolveSourceInput(request: SourceRequestRecord, vaultRoot: string): { sourceText: string; mode: 'external_reference' | 'local_copy' | 'extracted_snapshot'; resolvedSourcePath?: string; warnings: string[] } {
	const source = request.source.trim();
	const sourceKind = request.sourceKind.trim().toLowerCase();
	const warnings: string[] = [];

	if (!source) {
		return {
			sourceText: `No source identifier found in request ${request.path}.`,
			mode: 'extracted_snapshot',
			warnings: ['request has empty source field'],
		};
	}

	if (isUrlSource(source)) {
		return {
			sourceText:
				`External reference pending human/agent fetch. ` +
				`Source URL: ${source}. ` +
				'This request intentionally avoids network fetch.',
			mode: 'external_reference',
			warnings: ['external network fetch intentionally skipped'],
		};
	}

	const parsedPath = parseOptionalIntendedSourcePath(source, sourceKind);
	if (parsedPath.requestedPath) {
		try {
			const fileText = safeReadTextFile(vaultRoot, parsedPath.requestedPath);
			return {
				sourceText: fileText,
				mode: 'local_copy',
				resolvedSourcePath: parsedPath.requestedPath,
				warnings: [],
			};
		} catch (error) {
			if (error instanceof ToolInputError || error instanceof VaultPathError) {
				return {
					sourceText: request.content || source,
					mode: 'extracted_snapshot',
					warnings: ['source path is not readable, fallback to request body'],
				};
			}
			throw error;
		}
	}

	const bodyText = extractSelectionText(request.content);
	return {
		sourceText: bodyText || request.content || source,
		mode: 'extracted_snapshot',
		warnings: ['using request-provided text for analysis'],
	};
}

function buildSourceNoteContent(
	request: SourceRequestRecord,
	mode: 'external_reference' | 'local_copy' | 'extracted_snapshot',
	sourceText: string,
	analysis: ReturnType<typeof analyzeSourceText>,
	resolvedSourcePath?: string,
): string {
	const section = ['## Source note', `- request_path: ${request.path}`, `- mode: ${mode}`, `- source_kind: ${request.sourceKind || 'unknown'}`];
	section.push(`- analysis_mode: ${request.analysisMode || 'default'}`);
	if (resolvedSourcePath) {
		section.push(`- resolved_source_path: ${resolvedSourcePath}`);
	}
	section.push('');
	section.push('## Source summary');
	section.push(analysis.summary);
	section.push('');
	section.push('## Evidence scaffold');
	for (const item of analysis.evidenceScaffolds) {
		section.push(`- ${item}`);
	}
	section.push('');
	section.push('## Claim scaffold');
	for (const item of analysis.claimScaffolds) {
		section.push(`- ${item}`);
	}
	section.push('');
	section.push('## Source excerpt');
	section.push(analysis.excerpt);
	return section.join('\n');
}

function buildReportContent(
	request: SourceRequestRecord,
	mode: 'external_reference' | 'local_copy' | 'extracted_snapshot',
	sourceText: string,
	analysis: SourceAnalysisResult,
	sourceNotePath: string,
	warnings: string[],
): string {
	const sourceContent = `\n## Source\n\n${sourceText.slice(0, MAX_SOURCE_EXCERPT_LENGTH)}\n`;
	const section = [
		'## Source Analysis Report',
		`- source: ${request.source}`,
		`- request_path: ${request.path}`,
		`- source_kind: ${request.sourceKind || 'unknown'}`,
		`- analysis_mode: ${request.analysisMode || 'default'}`,
		`- mode: ${mode}`,
		`- source_note: ${sourceNotePath}`,
		`- related_project: ${request.relatedProject || 'unset'}`,
		`- purpose: ${request.purpose || 'unset'}`,
	];
	if (warnings.length > 0) {
		section.push(`- warnings: ${JSON.stringify(warnings)}`);
	}
	section.push('');
	section.push('## Summary');
	section.push(analysis.summary);
	section.push('');
	section.push('## Excerpt');
	section.push(`\n${analysis.excerpt}\n`);
	section.push('');
	section.push('## Evidence scaffold');
	section.push(...analysis.evidenceScaffolds.map((entry: string) => `- ${entry}`));
	section.push('');
	section.push('## Claim scaffold');
	section.push(...analysis.claimScaffolds.map((entry: string) => `- ${entry}`));
	section.push('');
	section.push(sourceContent);
	return section.join('\n');
}

function handleAnalyzeSourceRequest(rawArgs: AnalyzeSourceRequestArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const requestPath = coerceOptionalString(rawArgs.request_path) || coerceOptionalString(rawArgs.path);
	if (!requestPath) {
		throw new ToolInputError('Missing required argument: request_path or path.');
	}
	const requestPathAlias = requestPath;
	const updateStatus = coerceBoolean(rawArgs.update_request_status, 'update_request_status', true);
	const forceReprocess = coerceBoolean(rawArgs.force_reprocess, 'force_reprocess', false);
	const now = new Date().toISOString();

	try {
		const request = readSourceRequest(vaultRoot, requestPathAlias);
		if (!request.type.toLowerCase().includes('agent-request')) {
			throw new ToolInputError('Request note is not an agent-request note.');
		}
		if (!forceReprocess && request.status && !isSourceRequestPending(request.status)) {
			throw new ToolInputError(`Request status is ${request.status}; use force_reprocess=true to process anyway.`);
		}

		const { sourceText, mode, resolvedSourcePath, warnings } = resolveSourceInput(request, vaultRoot);
		const analysis = analyzeSourceText({
			source: request.source,
			sourceKind: request.sourceKind || 'unknown',
			analysisMode: request.analysisMode || 'default',
			purpose: request.purpose,
			content: sourceText,
			requestPath: request.path,
		});

		assertNoSensitiveText([
			{ label: 'source', value: request.source },
			{ label: 'purpose', value: request.purpose },
			{ label: 'summary', value: analysis.summary },
			{ label: 'excerpt', value: analysis.excerpt },
		]);

		const runToken = buildSourceRunToken(request);
		const sourceFilename = buildSafeFilename(`${runToken}-source`, 'source');
		const sourceNote = buildAndWriteNote(
			vaultRoot,
			'obs_wiki.analyze_source_request',
			SOURCES_DIR,
			sourceFilename,
			{
				tool: 'obs_wiki.analyze_source_request',
				type: 'source_analysis_source',
				title: `source_analysis_source_${runToken}`,
				source: request.source,
				source_kind: request.sourceKind || null,
				analysis_mode: request.analysisMode || 'default',
				request_path: request.path,
				mode,
				created_at: now,
			},
			buildSourceNoteContent(request, mode, sourceText, analysis, resolvedSourcePath),
			null,
			{ target_type: 'source', mode, request_path: request.path }
		);

		const reportFilename = buildSafeFilename(`${runToken}-report`, 'source-report');
		const report = buildAndWriteNote(
			vaultRoot,
			'obs_wiki.analyze_source_request',
			SOURCE_ANALYSIS_REPORT_DIR,
			reportFilename,
			{
				tool: 'obs_wiki.analyze_source_request',
				type: 'source_analysis_report',
				title: `source_analysis_report_${runToken}`,
				source: request.source,
				source_kind: request.sourceKind || null,
				analysis_mode: request.analysisMode || 'default',
				request_path: request.path,
				source_note: sourceNote.path,
				created_at: now,
			},
			buildReportContent(request, mode, sourceText, analysis, sourceNote.path, warnings),
			null,
			{ target_type: 'source_analysis_report', request_path: request.path }
		);

		const proposalPaths = analysis.proposalDrafts.map((entry: { title?: string; proposalKind: string; riskLevel?: string; evidence: string; content: string }) => {
			const proposalNote = buildAndWriteNote(
				vaultRoot,
				'obs_wiki.analyze_source_request',
				MEMORY_PROPOSAL_DIR,
				buildSafeFilename(`proposal-${runToken}-${entry.proposalKind}`, entry.proposalKind),
				{
					tool: 'obs_wiki.analyze_source_request',
					type: 'memory_proposal',
					title: entry.title || `source_proposal_${runToken}`,
					proposal_kind: entry.proposalKind,
					status: 'pending',
					source: request.source,
					source_kind: request.sourceKind || null,
					target_note: report.path,
					risk_level: entry.riskLevel || null,
					created_at: now,
					task_id: null,
				},
				`## Source analysis proposal\n\n- evidence: ${entry.evidence}\n\n${entry.content}\n`,
				null,
				{
					target_type: 'memory_proposal',
					proposal_kind: entry.proposalKind,
					request_path: request.path,
					source_note: sourceNote.path,
				}
			);
			return proposalNote.path;
		});

		if (updateStatus) {
			updateRequestStatus(vaultRoot, request.path, 'completed');
			appendAuditEvent(vaultRoot, {
				tool: 'obs_wiki.analyze_source_request',
				targetPath: request.path,
				status: 'written',
				taskId: null,
				metadata: {
					action: 'source.request.completed',
					source_note: sourceNote.path,
					source_report: report.path,
					proposals: proposalPaths.join(','),
				},
			});
		}

		return {
			ok: true,
			read_only: false,
			tool: 'obs_wiki.analyze_source_request',
			status: 'completed',
			vault_root: vaultRoot,
			request_path: request.path,
			mode,
			source_note: {
				path: sourceNote.path,
				audit_path: sourceNote.audit_path,
			},
			report: {
				path: report.path,
				audit_path: report.audit_path,
			},
			proposals: proposalPaths.map((proposalPath: string) => ({ path: proposalPath })),
			summary: analysis.summary,
			warnings,
		};
	} catch (error) {
		if (updateStatus) {
			try {
				updateRequestStatus(vaultRoot, requestPathAlias, 'failed');
				appendAuditEvent(vaultRoot, {
					tool: 'obs_wiki.analyze_source_request',
					targetPath: requestPathAlias,
					status: 'failed',
					taskId: null,
					metadata: {
						action: 'source.request.failed',
						error: error instanceof Error ? error.message : String(error),
					},
				});
			} catch {
				// audit and state update are best-effort; keep original error handling path.
			}
		}
		throw error;
	}
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
			status: readProposalApprovalStatus(note.frontmatter),
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

function handleListApprovedWritebacks(rawArgs: ListApprovedWritebacksArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const rawLimit = rawArgs.max_items ?? rawArgs.limit;
	const maxItems = coercePositiveInt(rawLimit, MAX_APPROVED_WRITEBACKS, 1, MAX_APPROVED_WRITEBACKS);
	const scope = coerceOptionalString(rawArgs.scope);
	const scan = scanVault(vaultRoot);
	const candidates: ReturnType<typeof buildWritebackPlan>[] = [];

	for (const note of scan.notes) {
		if (!note.relativePath.startsWith(`${REVIEW_QUEUE_PREFIX}/`)) {
			continue;
		}
		if (readProposalApprovalStatus(note.frontmatter) !== 'approved') {
			continue;
		}
		if (scope) {
			const proposalKind = stripYamlQuotes(readFrontmatterString(note.frontmatter, ['proposal_kind', 'proposalKind']));
			const targetNote = stripYamlQuotes(readFrontmatterString(note.frontmatter, ['target_note', 'targetNote']));
			if (!proposalKind.includes(scope) && !targetNote.startsWith(scope)) {
				continue;
			}
		}
		const proposal = readMemoryProposal(vaultRoot, note.relativePath);
		candidates.push(buildWritebackPlan(proposal));
	}

	const entries = candidates
		.sort((a, b) => a.proposal.path.localeCompare(b.proposal.path))
		.slice(0, maxItems)
		.map((plan) => ({
			proposal_id: plan.proposal.proposalId,
			proposal_path: plan.proposal.path,
			proposal_kind: plan.proposal.proposalKind,
			target_note: plan.targetNote || null,
			risk_level: plan.proposal.riskLevel,
			task_id: plan.proposal.taskId || null,
			ready_to_apply: plan.ready,
			blocker: plan.ready ? null : plan.reason || 'not ready',
		}));

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		count: entries.length,
		entries,
	};
}

function handleApplyApprovedWriteback(rawArgs: ApplyApprovedWritebackArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const dryRun = coerceBoolean(rawArgs.dry_run, 'dry_run', false);
	const proposal = resolveMemoryProposalFromArgs(vaultRoot, rawArgs);
	const plan = buildWritebackPlan(proposal);
	const now = new Date().toISOString();

	if (!plan.ready) {
		throw new ToolInputError(plan.reason || 'approved writeback is not ready to apply.');
	}

	const targetAbsolute = resolveSafeNotePath(vaultRoot, plan.targetNote);
	const targetRelative = relativeFromAbsolute(vaultRoot, targetAbsolute);
	assertAllowedWritebackTarget(targetRelative);

	const writebackBlock = [
		`## Approved Writeback: ${proposal.proposalId}`,
		'',
		plan.writebackContent,
		'',
		`^writeback-${proposal.proposalId.replace(/[^A-Za-z0-9._-]/g, '-')}`,
	].join('\n');

	if (dryRun) {
		return {
			ok: true,
			read_only: true,
			dry_run: true,
			permission_level: 'review-gated apply',
			proposal_id: proposal.proposalId,
			proposal_path: proposal.path,
			target_note: targetRelative,
			touched_notes: [targetRelative, proposal.path, AUDIT_LOG_PATH],
			writeback_preview: writebackBlock,
		};
	}

	const currentTarget = fs.readFileSync(targetAbsolute, 'utf8');
	const targetWithWriteback = `${currentTarget.replace(/\s*$/, '')}\n\n${writebackBlock}\n`;
	fs.writeFileSync(targetAbsolute, targetWithWriteback, 'utf8');

	const updatedProposal = updateFrontmatterFields(proposal.text, {
		approval_status: 'applied',
		status: 'applied',
		writeback_applied_at: now,
		writeback_target: targetRelative,
	});
	fs.writeFileSync(proposal.absolutePath, updatedProposal, 'utf8');

	const audit = appendAuditEvent(vaultRoot, {
		tool: 'obs_wiki.apply_approved_writeback',
		targetPath: targetRelative,
		status: 'written',
		taskId: proposal.taskId || null,
		metadata: {
			action: 'writeback.apply',
			proposal_id: proposal.proposalId,
			proposal_path: proposal.path,
			permission_level: 'review-gated apply',
		},
	});

	return {
		ok: true,
		read_only: false,
		permission_level: 'review-gated apply',
		status: 'applied',
		proposal_id: proposal.proposalId,
		proposal_path: proposal.path,
		target_note: targetRelative,
		touched_notes: [targetRelative, proposal.path, audit.path],
		audit_path: audit.path,
	};
}

function handleAuditRecent(rawArgs: AuditRecentArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const maxItems = coercePositiveInt(rawArgs.max_items, MAX_AUDIT_ITEMS, 1, 100);
	let auditPath: string | null = null;
	let text = '';

	try {
		auditPath = resolveSafeNotePath(vaultRoot, AUDIT_LOG_PATH);
		text = fs.readFileSync(auditPath, 'utf8');
	} catch (error) {
		if (!(error instanceof ToolInputError || error instanceof VaultPathError)) {
			throw error;
		}
	}

	const sections = text ? parseAuditSections(text) : [];
	const rel = auditPath ? relativeFromAbsolute(vaultRoot, auditPath) : AUDIT_LOG_PATH;

	return {
		ok: true,
		read_only: true,
		vault_root: vaultRoot,
		audit_log: rel,
		total_sections: sections.length,
		sections: sections.slice(0, maxItems),
	};
}

function handleWriteContextPack(rawArgs: WriteContextPackArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const content = coerceNonEmptyString(rawArgs.content, true, 'content');
	const title = coerceNonEmptyString(rawArgs.title);
	const filename = buildSafeFilename(rawArgs.filename, 'context_pack');
	const taskId = coerceOptionalString(rawArgs.task_id) || null;
	const now = new Date().toISOString();
	assertNoSensitiveText([
		{ label: 'content', value: content },
		{ label: 'title', value: title },
	]);

	const note = buildAndWriteNote(
		vaultRoot,
		'obs_wiki.write_context_pack',
		CONTEXT_PACK_DIR,
		filename,
		{
			tool: 'obs_wiki.write_context_pack',
			type: 'context_pack',
			title: title || `context_pack_${now}`,
			created_at: now,
			task_id: taskId || null,
		},
		content,
		taskId,
		{ target_type: 'context_pack', tool: 'obs_wiki.write_context_pack' }
	);

	return makeToolResultForWrite('obs_wiki.write_context_pack', note);
}

function handleWriteSessionNote(rawArgs: WriteSessionNoteArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const content = coerceNonEmptyString(rawArgs.content, true, 'content');
	const filename = buildSafeFilename(rawArgs.filename, 'session');
	const taskId = coerceOptionalString(rawArgs.task_id) || null;
	const now = new Date().toISOString();
	assertNoSensitiveText([
		{ label: 'content', value: content },
	]);

	const note = buildAndWriteNote(
		vaultRoot,
		'obs_wiki.write_session_note',
		SESSION_NOTE_DIR,
		filename,
		{
			tool: 'obs_wiki.write_session_note',
			type: 'session_note',
			created_at: now,
			task_id: taskId || null,
		},
		content,
		taskId,
		{ target_type: 'session_note', tool: 'obs_wiki.write_session_note' }
	);

	return makeToolResultForWrite('obs_wiki.write_session_note', note);
}

function handleCaptureSource(rawArgs: CaptureSourceArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const source = coerceNonEmptyString(rawArgs.source, true, 'source');
	const sourceKind = coerceOptionalString(rawArgs.source_kind);
	const mode = coerceCaptureMode(rawArgs.mode);
	const captureReason = coerceOptionalString(rawArgs.capture_reason);
	const relatedProject = coerceOptionalString(rawArgs.related_project);
	const filename = buildSafeFilename(rawArgs.filename, 'source');
	const title = coerceOptionalString(rawArgs.title);
	const taskId = coerceOptionalString(rawArgs.task_id) || null;
	const now = new Date().toISOString();
	const warnings: string[] = [];

	const sourceText = coerceOptionalString(rawArgs.content) || coerceOptionalString(rawArgs.text);
	if (mode !== 'external_reference' && !sourceText) {
		throw new ToolInputError(`content/text is required when mode is "${mode}".`);
	}
	if (mode === 'external_reference' && sourceText) {
		warnings.push('content/text is ignored for external_reference mode.');
	}
	assertNoSensitiveText([
		{ label: 'source', value: source },
		{ label: 'capture_reason', value: captureReason },
		{ label: 'content', value: sourceText },
		{ label: 'title', value: title },
	]);

	let body = `## Source capture\n\n`;
	if (mode === 'external_reference') {
		body += `- mode: external_reference\n- source: ${source}\n`;
		if (sourceKind) {
			body += `- source_kind: ${sourceKind}\n`;
		}
		if (captureReason) {
			body += `- capture_reason: ${captureReason}\n`;
		}
	} else {
		body += `- mode: ${mode}\n- source: ${source}\n`;
		if (sourceKind) {
			body += `- source_kind: ${sourceKind}\n`;
		}
		body += `\n${sourceText}\n`;
	}

	const note = buildAndWriteNote(
		vaultRoot,
		'obs_wiki.capture_source',
		SOURCES_DIR,
		filename,
		{
			tool: 'obs_wiki.capture_source',
			type: 'source_capture',
			title: title || `source_${mode}_${now}`,
			source,
			source_kind: sourceKind || null,
			mode,
			capture_reason: captureReason || null,
			related_project: relatedProject || null,
			created_at: now,
			task_id: taskId || null,
		},
		body,
		taskId,
		{ target_type: 'source_capture', mode }
	);

	return {
		ok: true,
		tool: 'obs_wiki.capture_source',
		status: note.status,
		path: note.path,
		audit_path: note.audit_path,
		warnings,
		metadata: {
			source,
			mode,
		},
	};
}

function handleProposeMemory(rawArgs: ProposeMemoryArgs, context: ToolContext) {
	const vaultRoot = vaultRootFromArgs(rawArgs, context);
	const proposalKind = coerceNonEmptyString(rawArgs.proposal_kind, true, 'proposal_kind');
	const content = coerceNonEmptyString(rawArgs.content, true, 'content');
	const evidence = coerceOptionalString(rawArgs.evidence);
	const targetNote = coerceOptionalString(rawArgs.target_note);
	const riskLevel = coerceOptionalString(rawArgs.risk_level);
	const title = coerceOptionalString(rawArgs.title);
	const filename = buildSafeFilename(rawArgs.filename, 'proposal');
	const taskId = coerceOptionalString(rawArgs.task_id) || null;
	const now = new Date().toISOString();
	assertNoSensitiveText([
		{ label: 'content', value: content },
		{ label: 'evidence', value: evidence },
		{ label: 'target_note', value: targetNote },
		{ label: 'title', value: title },
	]);

	const body = [
		'## Proposal',
		`- status: pending`,
		`- proposal_kind: ${proposalKind}`,
		evidence ? `- evidence: ${evidence}` : '',
		targetNote ? `- target_note: ${targetNote}` : '',
		riskLevel ? `- risk_level: ${riskLevel}` : '',
		'',
		content,
	].filter(Boolean).join('\n');

	const note = buildAndWriteNote(
		vaultRoot,
		'obs_wiki.propose_memory',
		MEMORY_PROPOSAL_DIR,
		filename,
		{
			tool: 'obs_wiki.propose_memory',
			type: 'memory_proposal',
			title: title || `proposal_${proposalKind}_${now}`,
			proposal_kind: proposalKind,
			status: 'pending',
			target_note: targetNote || null,
			risk_level: riskLevel || null,
			created_at: now,
			task_id: taskId || null,
		},
		body,
		taskId,
		{
			target_type: 'memory_proposal',
			proposal_kind: proposalKind,
			risk_level: riskLevel || null,
		}
	);

	return makeToolResultForWrite('obs_wiki.propose_memory', note);
}
