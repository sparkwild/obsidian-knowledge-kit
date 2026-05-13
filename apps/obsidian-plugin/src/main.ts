import {
	App,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	WorkspaceLeaf,
} from 'obsidian';

const OBS_WIKI_ACTIVITY_VIEW = 'obs-wiki-activity';
const OBS_WIKI_SOURCE_STATUS_VIEW = 'obs-wiki-source-status';
const OBS_WIKI_REVIEW_QUEUE_VIEW = 'obs-wiki-review-queue';
const OBS_WIKI_MEMORY_INSPECTOR_VIEW = 'obs-wiki-memory-inspector';
const OBS_WIKI_AUDIT_LOG_VIEW = 'obs-wiki-audit-log';
const OBS_WIKI_RUNTIME_STATUS_VIEW = 'obs-wiki-runtime-status';
const OBS_WIKI_PERMISSION_POLICY_VIEW = 'obs-wiki-permission-policy';
const CONTROL_FILES: Array<{ path: string; content: string }> = [
	{
		path: '00_control/system.md',
		content: '# System Control\n\nObsidian-native memory system control defaults for obs-wiki.\n',
	},
	{
		path: '00_control/memory_policy.md',
		content: '# Memory Policy\n\n- Writing is permissioned.\n- Vault scope: vault-root only.\n',
	},
	{
		path: '00_control/permissions.md',
		content: '# Permissions\n\n- Default: read-only for automation.\n- User confirmation required for memory writes.\n',
	},
];
const CONTROL_PATHS = {
	root: '00_control',
	auditLog: '00_control/audit_log.md',
	auditDir: '00_control/audit',
	dashboards: '00_control/dashboards',
};
const SOURCE_REQUESTS_PATH = '01_inbox/agent_requests';
const REVIEW_QUEUE_PATH = '01_inbox/review_queue';
const AGENT_TASKS_PATH = '02_timeline/agent_tasks';
const MAX_TASK_SNIPPET_LENGTH = 160;
const MAX_TASK_ROWS = 6;
const MAX_AUDIT_ROWS = 12;
const MAX_SOURCE_STATUS_ROWS = 20;
const MAX_REVIEW_QUEUE_ROWS = 20;
const MEMORY_STRUCTURE: string[] = [
	'01_inbox/agent_requests',
	'01_inbox/review_queue',
	'02_timeline/sessions',
	'02_timeline/agent_tasks',
	'03_sources/web',
	'03_sources/files',
	'03_sources/transcripts',
	'03_sources/attachments',
	'04_memory/concepts',
	'04_memory/claims',
	'04_memory/procedures',
	'04_memory/preferences',
	'04_memory/reflections',
	'05_projects',
	'06_outputs/context_packs',
	'06_outputs/reports',
	'06_outputs/source_analysis',
	'06_outputs/summaries',
	'07_archive',
];

type ParsedRecordValue = string | string[];

interface ParsedRecord {
	[key: string]: ParsedRecordValue;
}

interface ParsedFrontmatter {
	fields: ParsedRecord;
	body: string;
}

interface MemoryInitializationPlan {
	foldersToCreate: string[];
	filesToCreate: string[];
	missingAuditLog: boolean;
}

interface AgentTaskRecord {
	path: string;
	type: string;
	taskId: string;
	agent: string;
	objective: string;
	status: string;
	startedAt: string;
	finishedAt: string;
	contextPack: string;
	relatedProject: string;
	memoryReads: string[];
	memoryWrites: string[];
	sourceCaptures: string[];
	proposals: string[];
	snippet: string;
	sortTimestamp: number;
}

interface SourceRequestRecord {
	path: string;
	type: string;
	source: string;
	sourceKind: string;
	purpose: string;
	relatedProject: string;
	analysisMode: string;
	status: string;
	created: string;
	summary: string;
	sortTimestamp: number;
}

interface SourceAnalysisSnapshot {
	requests: SourceRequestRecord[];
	missingRequestFolder: boolean;
	updatedAt: string;
}

type MemoryProposalStatus =
	| 'pending'
	| 'approved'
	| 'rejected'
	| 'deferred'
	| 'revision_requested'
	| 'applied';

interface AuditEventRecord {
	path: string;
	auditId: string;
	actor: string;
	action: string;
	target: string;
	reason: string;
	taskId: string;
	timestamp: string;
	sortTimestamp: number;
	snippet: string;
}

interface MemoryProposalRecord {
	path: string;
	proposalId: string;
	proposalKind: string;
	proposedBy: string;
	taskId: string;
	targetNote: string;
	evidence: string[];
	riskLevel: string;
	approvalStatus: MemoryProposalStatus;
	created: string;
	snippet: string;
	sortTimestamp: number;
}

interface MemoryReviewQueueSnapshot {
	proposals: MemoryProposalRecord[];
	missingReviewQueueFolder: boolean;
	updatedAt: string;
}

interface AgentActivitySnapshot {
	currentTask: AgentTaskRecord | null;
	recentTasks: AgentTaskRecord[];
	recentAuditEvents: AuditEventRecord[];
	missingTaskFolder: boolean;
	missingAuditSources: boolean;
	updatedAt: string;
}

interface ObsWikiSettings {
	showWelcomeMessage: boolean;
	defaultAgentScope: string;
	statusMessage: string;
}

const DEFAULT_SETTINGS: ObsWikiSettings = {
	showWelcomeMessage: true,
	defaultAgentScope: 'vault',
	statusMessage: 'Welcome to obs-wiki Agent Activity.',
};

export default class ObsWikiPlugin extends Plugin {
	settings: ObsWikiSettings = DEFAULT_SETTINGS;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.registerView(
			OBS_WIKI_SOURCE_STATUS_VIEW,
			(leaf) => new ObsWikiSourceStatusView(leaf, this)
		);
		this.registerView(
			OBS_WIKI_ACTIVITY_VIEW,
			(leaf) => new ObsWikiActivityView(leaf, this)
		);
		this.registerView(
			OBS_WIKI_REVIEW_QUEUE_VIEW,
			(leaf) => new ObsWikiReviewQueueView(leaf, this)
		);
		this.registerView(
			OBS_WIKI_MEMORY_INSPECTOR_VIEW,
			(leaf) => new ObsWikiMemoryInspectorView(leaf)
		);
		this.registerView(
			OBS_WIKI_AUDIT_LOG_VIEW,
			(leaf) => new ObsWikiAuditLogView(leaf, this)
		);
		this.registerView(
			OBS_WIKI_RUNTIME_STATUS_VIEW,
			(leaf) => new ObsWikiRuntimeStatusView(leaf)
		);
		this.registerView(
			OBS_WIKI_PERMISSION_POLICY_VIEW,
			(leaf) => new ObsWikiPermissionPolicyView(leaf)
		);

		this.addRibbonIcon('layout-dashboard', 'Open obs-wiki Activity', () => {
			this.openPluginView(OBS_WIKI_ACTIVITY_VIEW);
		});

		this.addCommand({
			id: 'open-agent-activity',
			name: 'Open Agent Activity',
			callback: () => this.openPluginView(OBS_WIKI_ACTIVITY_VIEW),
		});

		this.addCommand({
			id: 'open-review-queue',
			name: 'Open Review Queue',
			callback: () => this.openPluginView(OBS_WIKI_REVIEW_QUEUE_VIEW),
		});

		this.addCommand({
			id: 'open-memory-inspector',
			name: 'Open Memory Inspector',
			callback: () => this.openPluginView(OBS_WIKI_MEMORY_INSPECTOR_VIEW),
		});

		this.addCommand({
			id: 'open-audit-log',
			name: 'Open Audit Log',
			callback: () => this.openPluginView(OBS_WIKI_AUDIT_LOG_VIEW),
		});

		this.addCommand({
			id: 'open-runtime-status',
			name: 'Open Runtime Status',
			callback: () => this.openPluginView(OBS_WIKI_RUNTIME_STATUS_VIEW),
		});

		this.addCommand({
			id: 'open-permission-policy',
			name: 'Open Permission Policy',
			callback: () => this.openPluginView(OBS_WIKI_PERMISSION_POLICY_VIEW),
		});

		this.addCommand({
			id: 'refresh-views',
			name: 'Refresh Views',
			callback: () => {
				void this.refreshGovernanceViews();
			},
		});

		this.addSettingTab(new ObsWikiSettingTab(this.app, this));
	}

	private async promptInitializeMemoryStructure(): Promise<void> {
		const plan = this.buildInitializationPlan();
		new InitializeMemoryStructureModal(this.app, {
			plan,
			onConfirm: async () => {
				await this.initializeMemoryStructure(plan);
			},
		}).open();
	}

	private buildInitializationPlan(): MemoryInitializationPlan {
		const foldersToCreate = this.getNormalizedFolderPlan();
		const missingFolders = foldersToCreate.filter(
			(path) => this.app.vault.getAbstractFileByPath(path) === null
		);

		const missingAuditLog =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;

		const filesToCreate: string[] = [];
		for (const controlFile of CONTROL_FILES) {
			if (!this.app.vault.getAbstractFileByPath(controlFile.path)) {
				filesToCreate.push(controlFile.path);
			}
		}
		if (missingAuditLog && !filesToCreate.includes(CONTROL_PATHS.auditLog)) {
			filesToCreate.push(CONTROL_PATHS.auditLog);
		}

		return {
			foldersToCreate: missingFolders,
			filesToCreate,
			missingAuditLog,
		};
	}

	private getNormalizedFolderPlan(): string[] {
		const foldersToCreate: string[] = [];
		const seen = new Set<string>();

		for (const path of [CONTROL_PATHS.root, CONTROL_PATHS.dashboards, ...MEMORY_STRUCTURE]) {
			for (const folder of this.expandFolderHierarchy(path)) {
				if (!seen.has(folder)) {
					seen.add(folder);
					foldersToCreate.push(folder);
				}
			}
		}

		return foldersToCreate;
	}

	private expandFolderHierarchy(path: string): string[] {
		const normalized = this.normalizeVaultPath(path);
		if (!normalized) {
			return [];
		}

		const parts = normalized.split('/').filter(Boolean);
		const folders: string[] = [];
		let current = '';

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			folders.push(current);
		}

		return folders;
	}

	private normalizeVaultPath(path: string): string {
		return path
			.trim()
			.replace(/\\+/g, '/')
			.replace(/\/+$/g, '');
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalized = this.normalizeVaultPath(folderPath);
		if (!normalized) return;

		let current = '';
		for (const segment of normalized.split('/').filter(Boolean)) {
			current = current ? `${current}/${segment}` : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (!existing) {
				await this.app.vault.createFolder(current);
				continue;
			}
			if (!(existing instanceof TFolder)) {
				throw new Error(`Cannot create folder: ${current} already exists as a file.`);
			}
		}
	}

	private async ensureFileDoesNotExist(path: string, content: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(this.normalizeVaultPath(path));
		if (existing) {
			if (!(existing instanceof TFile)) {
				throw new Error(`Cannot create file: ${path} already exists as a folder.`);
			}
			return;
		}
		await this.app.vault.create(this.normalizeVaultPath(path), content);
	}

	private buildAuditLogPath(): string {
		return this.normalizeVaultPath(CONTROL_PATHS.auditLog);
	}

	private async initializeMemoryStructure(plan: MemoryInitializationPlan): Promise<void> {
		try {
			for (const folder of plan.foldersToCreate) {
				await this.ensureFolderExists(folder);
			}

			for (const controlFile of CONTROL_FILES.filter((file) =>
				plan.filesToCreate.includes(file.path)
			)) {
				await this.ensureFileDoesNotExist(controlFile.path, controlFile.content);
			}

			if (plan.missingAuditLog) {
				await this.ensureFileDoesNotExist(
					CONTROL_PATHS.auditLog,
					this.buildAuditLogHeader()
				);
			}

			await this.appendAuditEvent(plan);
			new Notice('obs-wiki memory structure initialized.');
		} catch (error) {
			console.error('obs-wiki failed to initialize memory structure', error);
			new Notice('obs-wiki failed to initialize memory structure.');
		}
	}

	private buildAuditLogHeader(): string {
		return '# Audit Log\n\n';
	}

	private async appendAuditEvent(plan: MemoryInitializationPlan): Promise<void> {
		const now = new Date().toISOString();
		const event = this.renderAuditEvent(now, plan.foldersToCreate.length, plan.filesToCreate.length);
		await this.appendToAuditLog(event);
	}

	private renderAuditEvent(timestamp: string, folderCount: number, fileCount: number): string {
		return `## ${timestamp}\naction: memory.initialize\nactor: user\nfolders_created: ${folderCount}\nfiles_created: ${fileCount}\nresult: success\n\n`;
	}

	private async appendProposalStatusAuditEvent(
		proposal: MemoryProposalRecord,
		nextStatus: MemoryProposalStatus
	): Promise<void> {
		const now = new Date().toISOString();
		const event = this.renderProposalStatusAuditEvent(
			now,
			proposal.path,
			proposal.proposalId,
			nextStatus,
			proposal.taskId
		);
		await this.appendToAuditLog(event);
	}

	private renderProposalStatusAuditEvent(
		timestamp: string,
		target: string,
		proposalId: string,
		nextStatus: MemoryProposalStatus,
		taskId?: string
	): string {
		return (
			`## ${timestamp}\n` +
			`action: memory.proposal.${nextStatus}\n` +
			`actor: user\n` +
			`target: ${target}\n` +
			`reason: proposal ${proposalId} marked ${nextStatus}\n` +
			`task_id: ${taskId || ''}\n` +
			`timestamp: ${timestamp}\n\n`
		);
	}

	private async appendToAuditLog(rawEvent: string): Promise<void> {
		const auditPath = this.buildAuditLogPath();
		const auditFile = this.app.vault.getAbstractFileByPath(auditPath);
		if (!auditFile) {
			await this.ensureFileDoesNotExist(auditPath, this.buildAuditLogHeader());
		}

		const finalAuditFile = this.app.vault.getAbstractFileByPath(auditPath);
		if (!(finalAuditFile instanceof TFile)) {
			throw new Error(`Cannot append audit log: ${auditPath} is not a file.`);
		}

		const current = await this.app.vault.read(finalAuditFile);
		const normalizedCurrent = current.endsWith('\n') ? current : `${current}\n`;
		const separator = normalizedCurrent.length > 0 ? '\n' : '';
		await this.app.vault.modify(
			finalAuditFile,
			`${normalizedCurrent}${separator}${rawEvent}`
		);
	}

	private async refreshActivityViews(): Promise<void> {
		const activityLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_ACTIVITY_VIEW);
		for (const leaf of activityLeaves) {
			const view = leaf.view;
			if (view instanceof ObsWikiActivityView) {
				await view.refresh();
			}
		}
	}

	private async refreshReviewQueueViews(): Promise<void> {
		const reviewQueueLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_REVIEW_QUEUE_VIEW);
		for (const leaf of reviewQueueLeaves) {
			const view = leaf.view;
			if (view instanceof ObsWikiReviewQueueView) {
				await view.refresh();
			}
		}
	}

	private async refreshSourceStatusViews(): Promise<void> {
		const sourceStatusLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_SOURCE_STATUS_VIEW);
		for (const leaf of sourceStatusLeaves) {
			const view = leaf.view;
			if (view instanceof ObsWikiSourceStatusView) {
				await view.refresh();
			}
		}
	}

	private quoteYamlString(value: string): string {
		const trimmed = (value || '').trim().replace(/\r/g, '');
		if (!trimmed) {
			return '""';
		}
		const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return `"${escaped}"`;
	}

	private async refreshGovernanceViews(): Promise<void> {
		await this.refreshActivityViews();
		await this.refreshReviewQueueViews();
		await this.refreshSourceStatusViews();
	}

	async loadSourceStatusSnapshot(): Promise<SourceAnalysisSnapshot> {
		const folder = this.app.vault.getAbstractFileByPath(SOURCE_REQUESTS_PATH);
		if (!(folder instanceof TFolder)) {
			return {
				requests: [],
				missingRequestFolder: true,
				updatedAt: new Date().toISOString(),
			};
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(files.map((file) => this.readSourceRequestFile(file)));
		const requests = records
			.filter((record): record is SourceRequestRecord => Boolean(record))
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, MAX_SOURCE_STATUS_ROWS);

		return {
			requests,
			missingRequestFolder: false,
			updatedAt: new Date().toISOString(),
		};
	}

	private async readSourceRequestFile(file: TFile): Promise<SourceRequestRecord | null> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read source request: ${file.path}`, error);
			content = '';
		}

		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const type = this.firstString(data, ['type']);
		if (!type.toLowerCase().includes('agent-request')) {
			return null;
		}

		const source = this.firstString(data, ['source']);
		const status = this.firstString(data, ['status']);
		if (!source || status.toLowerCase() !== 'pending') {
			return null;
		}

		const created = this.firstString(data, ['created']);
		const sortTimestamp = this.parseTimestamp(created, file.stat?.mtime);

		return {
			path: file.path,
			type,
			source,
			sourceKind: this.firstString(data, ['source_kind', 'sourceKind']) || 'unknown',
			purpose: this.firstString(data, ['purpose']) || '',
			relatedProject: this.firstString(data, ['related_project', 'relatedProject']) || '',
			analysisMode: this.firstString(data, ['analysis_mode', 'analysisMode']) || 'default',
			status,
			created,
			summary: this.snippetFromText(parsed.body, source),
			sortTimestamp,
		};
	}

	async loadAgentActivitySnapshot(): Promise<AgentActivitySnapshot> {
		const recentTasks = await this.readRecentAgentTasks(MAX_TASK_ROWS);
		const currentTask = this.pickCurrentTask(recentTasks);
		const recentAuditEvents = await this.readRecentAuditEvents(MAX_AUDIT_ROWS);
		const taskFolderMissing =
			this.app.vault.getAbstractFileByPath(AGENT_TASKS_PATH) === null;
		const auditLogMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;
		const auditDirMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir) === null;

		return {
			currentTask,
			recentTasks,
			recentAuditEvents,
			missingTaskFolder: taskFolderMissing,
			missingAuditSources: auditLogMissing && auditDirMissing,
			updatedAt: new Date().toISOString(),
		};
	}

	async loadMemoryReviewQueueSnapshot(): Promise<MemoryReviewQueueSnapshot> {
		const folder = this.app.vault.getAbstractFileByPath(REVIEW_QUEUE_PATH);
		if (!(folder instanceof TFolder)) {
			return {
				proposals: [],
				missingReviewQueueFolder: true,
				updatedAt: new Date().toISOString(),
			};
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(files.map((file) => this.readMemoryProposalFile(file)));
		const proposals = records
			.filter((record): record is MemoryProposalRecord => Boolean(record))
			.sort((a, b) => this.compareProposalRecords(a, b))
			.slice(0, MAX_REVIEW_QUEUE_ROWS);

		return {
			proposals,
			missingReviewQueueFolder: false,
			updatedAt: new Date().toISOString(),
		};
	}

	private async readMemoryProposalFile(file: TFile): Promise<MemoryProposalRecord | null> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read memory proposal: ${file.path}`, error);
			content = '';
		}

		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const proposalType = this.firstString(data, ['type']);
		const normalizedProposalType = proposalType.toLowerCase().replace(/_/g, '-');
		if (
			proposalType &&
			!normalizedProposalType.includes('memory-proposal')
		) {
			return null;
		}

		const created = this.firstString(data, ['created']);
		const proposalId = this.firstString(data, ['proposal_id', 'proposalId']) || file.basename;
		const approvalStatus = this.normalizeProposalStatus(
			this.firstString(data, ['approval_status', 'approvalStatus'])
		);
		const sortTimestamp = this.parseTimestamp(
			created,
			file.stat?.mtime
		);

		return {
			path: file.path,
			proposalId,
			proposalKind: this.firstString(data, ['proposal_kind', 'proposalKind']) || 'unknown',
			proposedBy: this.firstString(data, ['proposed_by', 'proposedBy']) || 'unknown',
			taskId: this.firstString(data, ['task_id', 'taskId']) || '',
			targetNote: this.firstString(data, ['target_note', 'targetNote']) || '',
			evidence: this.readStringList(data, ['evidence']),
			riskLevel: this.firstString(data, ['risk_level', 'riskLevel']) || 'unknown',
			approvalStatus,
			created,
			snippet: this.snippetFromText(parsed.body, proposalId),
			sortTimestamp,
		};
	}

	async updateMemoryProposalStatus(
		proposal: MemoryProposalRecord,
		nextStatus: MemoryProposalStatus
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(proposal.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot update proposal status: ${proposal.path} is not available.`);
		}

		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read proposal for update: ${proposal.path}`, error);
			throw error;
		}

		const normalizedStatus = this.normalizeProposalStatus(nextStatus);
		const updatedContent = this.updateApprovalStatusInFrontmatter(content, normalizedStatus);
		await this.app.vault.modify(file, updatedContent);
		await this.appendProposalStatusAuditEvent(
			{
				...proposal,
				approvalStatus: normalizedStatus,
			},
			normalizedStatus
		);
	}

	private normalizeProposalStatus(rawStatus?: string): MemoryProposalStatus {
		const status = (rawStatus || 'pending').toLowerCase().trim();
		if (
			status === 'approved' ||
			status === 'rejected' ||
			status === 'deferred' ||
			status === 'revision_requested' ||
			status === 'applied'
		) {
			return status;
		}
		if (status === 'pending_review') {
			return 'pending';
		}
		return 'pending';
	}

	private compareProposalRecords(a: MemoryProposalRecord, b: MemoryProposalRecord): number {
		const statusRank: Record<MemoryProposalStatus, number> = {
			pending: 0,
			revision_requested: 1,
			approved: 2,
			applied: 3,
			deferred: 4,
			rejected: 5,
		};
		const rankA = statusRank[a.approvalStatus] ?? 1;
		const rankB = statusRank[b.approvalStatus] ?? 1;
		if (rankA !== rankB) {
			return rankA - rankB;
		}
		return b.sortTimestamp - a.sortTimestamp;
	}

	private async readRecentAgentTasks(limit: number): Promise<AgentTaskRecord[]> {
		const folder = this.app.vault.getAbstractFileByPath(AGENT_TASKS_PATH);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(
			files.map((file) => this.readAgentTaskFile(file))
		);
		return records
			.filter((record): record is AgentTaskRecord => Boolean(record))
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, limit);
	}

	private async readRecentAuditEvents(limit: number): Promise<AuditEventRecord[]> {
		const auditLogRecords = await this.readAuditLogFile();
		const folderRecords = await this.readAuditFolderEvents();

		return [...auditLogRecords, ...folderRecords]
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, limit);
	}

	private collectMarkdownFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.collectMarkdownFiles(child));
			}
		}
		return files;
	}

	private async readAgentTaskFile(file: TFile): Promise<AgentTaskRecord> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read agent task: ${file.path}`, error);
			content = '';
		}
		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const objective = this.firstString(data, ['objective']);
		const path = file.path;

		const startedAt = this.firstString(data, ['started_at', 'startedAt']);
		const finishedAt = this.firstString(data, ['finished_at', 'finishedAt']);
		const sortTimestamp = this.parseTimestamp(
			startedAt || finishedAt,
			file.stat?.mtime
		);

		return {
			path,
			type: this.firstString(data, ['type']) || 'agent-task',
			taskId: this.firstString(data, ['task_id', 'taskId']) || file.basename,
			agent: this.firstString(data, ['agent']) || 'unknown',
			objective: objective || this.snippetFromText(parsed.body, file.basename),
			status: this.firstString(data, ['status']) || 'unknown',
			startedAt,
			finishedAt,
			contextPack: this.firstString(data, ['context_pack', 'contextPack']),
			relatedProject: this.firstString(data, ['related_project', 'relatedProject']),
			memoryReads: this.readStringList(data, ['memory_reads', 'memoryReads']),
			memoryWrites: this.readStringList(data, ['memory_writes', 'memoryWrites']),
			sourceCaptures: this.readStringList(data, ['source_captures', 'sourceCaptures']),
			proposals: this.readStringList(data, ['proposals']),
			snippet: this.snippetFromText(parsed.body, objective || file.basename),
			sortTimestamp,
		};
	}

	private pickCurrentTask(tasks: AgentTaskRecord[]): AgentTaskRecord | null {
		const active = tasks.find((task) =>
			task.status?.toLowerCase() === 'active'
		);
		return active ?? tasks[0] ?? null;
	}

	private async readAuditLogFile(): Promise<AuditEventRecord[]> {
		const file = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog);
		if (!(file instanceof TFile)) {
			return [];
		}

		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error('obs-wiki failed to read audit log', error);
			return [];
		}

		return this.parseAuditLogSections(content, file.path);
	}

	private async readAuditFolderEvents(): Promise<AuditEventRecord[]> {
		const folder = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const files = this.collectMarkdownFiles(folder);
		const events: AuditEventRecord[] = [];
		for (const file of files) {
			const fileEvents = await this.readAuditMarkdownFile(file);
			events.push(...fileEvents);
		}
		return events;
	}

	private async readAuditMarkdownFile(file: TFile): Promise<AuditEventRecord[]> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read audit file: ${file.path}`, error);
			return [];
		}

		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const timestamp = this.firstString(data, ['timestamp']) || this.timestampFromFilename(file.basename);
		const fallbackTs =
			this.parseTimestamp(timestamp, file.stat?.mtime || Date.now()) || file.stat?.mtime || Date.now();

		if (Object.keys(data).length > 0) {
			return [
				{
					path: file.path,
					auditId: this.firstString(data, ['audit_id', 'auditId', 'id']),
					actor: this.firstString(data, ['actor']) || 'unknown',
					action: this.firstString(data, ['action']) || 'unknown',
					target: this.firstString(data, ['target']) || '',
					reason: this.firstString(data, ['reason']) || '',
					taskId: this.firstString(data, ['task_id', 'taskId']),
					timestamp: timestamp || '',
					sortTimestamp: fallbackTs,
					snippet: this.snippetFromText(parsed.body, this.trimText(file.basename)),
				},
			];
		}

		const sectionRecords = this.parseAuditLogSections(content, file.path);
		return sectionRecords.length > 0 ? sectionRecords : [];
	}

	private parseAuditLogSections(content: string, sourcePath: string): AuditEventRecord[] {
		const lines = content.replace(/\r\n/g, '\n').split('\n');
		const events: AuditEventRecord[] = [];
		let cursor = 0;

		while (cursor < lines.length) {
			const header = lines[cursor].trim();
			if (!header.startsWith('## ')) {
				cursor += 1;
				continue;
			}

			const timestampHeader = header.replace(/^##\s+/, '').trim();
			cursor += 1;
			const bodyLines: string[] = [];
			while (
				cursor < lines.length &&
				!lines[cursor].trim().startsWith('## ')
			) {
				bodyLines.push(lines[cursor]);
				cursor += 1;
			}

			const row = this.readKeyValueRows(bodyLines);
			const fallbackTimestamp =
				this.firstString(row, ['timestamp']) || timestampHeader;
			events.push({
				path: sourcePath,
				auditId: this.firstString(row, ['audit_id', 'auditId', 'id']),
				actor: this.firstString(row, ['actor']) || 'unknown',
				action: this.firstString(row, ['action']) || 'unknown',
				target: this.firstString(row, ['target']) || '',
				reason: this.firstString(row, ['reason']) || '',
				taskId: this.firstString(row, ['task_id', 'taskId']),
				timestamp: fallbackTimestamp,
				sortTimestamp: this.parseTimestamp(
					fallbackTimestamp,
					Date.now()
				),
				snippet: this.snippetFromText(bodyLines.join('\n')),
			});
		}

		return events;
	}

	private updateApprovalStatusInFrontmatter(content: string, nextStatus: MemoryProposalStatus): string {
		const normalized = content.replace(/\r\n/g, '\n');
		const fmStatusLine = `approval_status: ${nextStatus}`;
		const fmPrefix = '---';

		if (normalized.trim() === '') {
			return `${fmPrefix}\n${fmStatusLine}\n${fmPrefix}\n`;
		}

		const lines = normalized.split('\n');
		if (lines.length === 0 || lines[0].trim() !== fmPrefix) {
			return `${fmPrefix}\n${fmStatusLine}\n${fmPrefix}\n${normalized}`;
		}

		let end = -1;
		for (let index = 1; index < lines.length; index++) {
			if (lines[index].trim() === fmPrefix) {
				end = index;
				break;
			}
		}

		if (end < 0) {
			return `${fmPrefix}\n${fmStatusLine}\n${fmPrefix}\n${normalized}`;
		}

		const frontmatterLines = lines.slice(1, end);
		let found = false;
		const updatedFrontmatter = frontmatterLines.map((line) => {
			if (/^\s*approval_status\s*:/i.test(line)) {
				found = true;
				const indent = line.match(/^(\s*)/)?.[0] || '';
				return `${indent}${fmStatusLine}`;
			}
			return line;
		});

		if (!found) {
			updatedFrontmatter.push(fmStatusLine);
		}

		return [
			fmPrefix,
			...updatedFrontmatter,
			fmPrefix,
			...lines.slice(end + 1),
		].join('\n');
	}

	private readFrontmatter(content: string): ParsedFrontmatter {
		const normalized = content.replace(/\r\n/g, '\n');
		const lines = normalized.split('\n');
		if (lines.length === 0 || lines[0].trim() !== '---') {
			return { fields: {}, body: normalized };
		}

		const fields: ParsedRecord = {};
		let cursor = 1;
		for (; cursor < lines.length; cursor++) {
			const line = lines[cursor];
			if (line.trim() === '---') {
				cursor += 1;
				break;
			}

			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			const pair = trimmed.match(/^([^:]+):\s*(.*)$/);
			if (!pair) {
				continue;
			}

			const key = pair[1].trim();
			const rawValue = pair[2].trim();
			if (rawValue === '') {
				const values: string[] = [];
				let next = cursor + 1;
				while (next < lines.length) {
					const match = lines[next].match(/^\s*-\s+(.*)$/);
					if (!match) {
						break;
					}
					values.push(match[1].trim());
					next += 1;
				}
				if (values.length > 0) {
					fields[key] = values;
					cursor = next - 1;
				}
				continue;
			}

			fields[key] = this.parseScalarOrArray(rawValue);
		}

		return { fields, body: lines.slice(cursor).join('\n') };
	}

	private parseScalarOrArray(value: string): ParsedRecordValue {
		const trimmed = value.trim();
		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			const inner = trimmed.slice(1, -1).trim();
			if (!inner) {
				return [];
			}
			return inner
				.split(',')
				.map((item) => this.trimText(item.replace(/^['"]|['"]$/g, '')))
				.filter(Boolean);
		}

		if (
			(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))
		) {
			return trimmed.slice(1, -1);
		}

		return trimmed;
	}

	private readKeyValueRows(lines: string[]): ParsedRecord {
		const rows: ParsedRecord = {};
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			const match = trimmed.match(/^([^:]+):\s*(.*)$/);
			if (!match) {
				continue;
			}
			rows[match[1].trim()] = this.parseScalarOrArray(match[2].trim());
		}
		return rows;
	}

	private firstString(values: ParsedRecord, keys: string[]): string {
		for (const key of keys) {
			const value = values[key];
			if (typeof value === 'string' && value.trim()) {
				return value.trim();
			}
			if (Array.isArray(value)) {
				const first = value.find((entry) => Boolean(entry && entry.trim()));
				if (first) {
					return first;
				}
			}
		}
		return '';
	}

	private readStringList(values: ParsedRecord, keys: string[]): string[] {
		const items: string[] = [];
		for (const key of keys) {
			const value = values[key];
			if (!value) continue;
			if (Array.isArray(value)) {
				items.push(...value.filter(Boolean));
				continue;
			}
			items.push(
				...value
					.split(',')
					.map((entry) => entry.trim())
					.filter(Boolean)
			);
		}
		return [...new Set(items)];
	}

	private parseTimestamp(timestamp: string | undefined, fallbackMs?: number): number {
		if (timestamp) {
			const parsed = Date.parse(timestamp);
			if (!Number.isNaN(parsed)) {
				return parsed;
			}
		}
		if (fallbackMs) {
			return fallbackMs;
		}
		return 0;
	}

	private timestampFromFilename(name: string): string {
		const match = name.match(/\d{4}[-_]?\d{2}[-_]?\d{2}([T_]\d{2}[-_]?\d{2}[-_]?\d{2})?/);
		if (!match) return '';
		return match[0].replace(/_/g, 'T').replace(/-/g, '-');
	}

	private snippetFromText(text: string, fallback: string = ''): string {
		const lines = text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.filter((line) => !line.startsWith('#'))
			.filter((line) => !line.startsWith('---'));

		const raw =
			lines.length > 0 ? lines[0] : this.trimText(fallback, MAX_TASK_SNIPPET_LENGTH);
		return this.trimText(raw, MAX_TASK_SNIPPET_LENGTH);
	}

	trimText(value: string, maxLength = MAX_TASK_SNIPPET_LENGTH): string {
		const trimmed = value.trim();
		if (trimmed.length <= maxLength) {
			return trimmed;
		}
		return `${trimmed.slice(0, maxLength - 1)}…`;
	}

	formatDisplayTime(value: number): string {
		if (!value) {
			return 'unknown time';
		}
		return new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
	}

	private async openPluginView(viewType: string) {
		const existingLeaves = this.app.workspace.getLeavesOfType(viewType);
		if (existingLeaves.length > 0) {
			this.app.workspace.setActiveLeaf(existingLeaves[0]);
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({
			type: viewType,
			state: {},
			active: true,
		});
		this.app.workspace.revealLeaf(leaf);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class InitializeMemoryStructureModal extends Modal {
	constructor(
		app: App,
		private options: {
			plan: MemoryInitializationPlan;
			onConfirm: () => Promise<void>;
		}
	) {
		super(app);
	}

	onOpen(): void {
		super.onOpen();
		this.titleEl.setText('Initialize Memory Structure');

		const { contentEl } = this;
		contentEl.empty();

		const { foldersToCreate, filesToCreate } = this.options.plan;
		contentEl.createEl('p', {
			text: 'The following obs-wiki structure will be created if missing in this vault.',
		});

		if (foldersToCreate.length === 0 && filesToCreate.length === 0) {
			contentEl.createEl('p', {
				text: 'Nothing is missing. No files or folders will be created.',
			});
		} else {
			const section = contentEl.createDiv();
			section.createEl('h3', { text: 'Folders' });
			const folderList = section.createEl('ul');
			for (const folder of foldersToCreate) {
				folderList.createEl('li', { text: folder });
			}

			section.createEl('h3', { text: 'Files' });
			const fileList = section.createEl('ul');
			for (const file of filesToCreate) {
				fileList.createEl('li', { text: file });
			}
		}

		const actions = contentEl.createDiv({ cls: 'modal-button-container' });
		const cancel = actions.createEl('button', { text: 'Cancel', cls: 'mod-warning' });
		cancel.addEventListener('click', () => this.close());

		const confirm = actions.createEl('button', { text: 'Initialize', cls: 'mod-cta' });
		confirm.addEventListener('click', async () => {
			await this.options.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		super.onClose();
	}
}

class ObsWikiSourceStatusView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ObsWikiPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_SOURCE_STATUS_VIEW;
	}

	getDisplayText() {
		return 'Source Status';
	}

	getViewData() {
		return '';
	}

	setViewData(_data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		await this.refresh();
	}

	private async render(snapshot: SourceAnalysisSnapshot): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Source Status', cls: 'obs-wiki-view__title' });

		const header = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		header.createEl('div', {
			text: `Last refreshed: ${this.plugin.formatDisplayTime(
				Date.parse(snapshot.updatedAt)
			)}`,
			cls: 'obs-wiki-view__description',
		});
		const actions = header.createDiv();
		const refreshButton = actions.createEl('button', {
			text: 'Refresh',
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			await this.refresh();
		});

		if (snapshot.missingRequestFolder) {
			contentEl.createEl('p', {
				text: 'No agent source request folder found at 01_inbox/agent_requests. Agent-created requests will appear here after the memory structure exists.',
				cls: 'obs-wiki-view__description',
			});
			return;
		}

		if (snapshot.requests.length === 0) {
			contentEl.createEl('p', {
				text: 'No pending agent-created source requests yet.',
				cls: 'obs-wiki-view__description',
			});
			return;
		}

		const list = contentEl.createEl('ul', { cls: 'obs-wiki-view__list' });
		for (const request of snapshot.requests) {
			const item = list.createEl('li', { cls: 'obs-wiki-view__item' });
			item.createEl('div', {
				text: `${this.plugin.formatDisplayTime(request.sortTimestamp)} • ${request.sourceKind} • ${request.status}`,
			});
			if (request.source) {
				item.createEl('div', { text: `Source: ${this.plugin.trimText(request.source, 120)}` });
			}
			if (request.purpose) {
				item.createEl('div', { text: `Purpose: ${request.purpose}` });
			}
			if (request.analysisMode) {
				item.createEl('div', { text: `Analysis mode: ${request.analysisMode}` });
			}
			if (request.relatedProject) {
				item.createEl('div', { text: `Related project: ${request.relatedProject}` });
			}
			if (request.summary) {
				item.createEl('div', { text: this.plugin.trimText(request.summary, 140) });
			}
			item.createEl('small', { text: `file: ${request.path}` });
		}
	}

	async refresh(): Promise<void> {
		const snapshot = await this.plugin.loadSourceStatusSnapshot();
		await this.render(snapshot);
	}
}

class ObsWikiActivityView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ObsWikiPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_ACTIVITY_VIEW;
	}

	getDisplayText() {
		return 'obs-wiki Activity';
	}

	getViewData() {
		return '';
	}

	setViewData(data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		await this.refresh();
	}

	private async render(snapshot: AgentActivitySnapshot): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		const header = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		header.createEl('h2', { text: 'Agent Activity', cls: 'obs-wiki-view__title' });
		const actions = header.createDiv();
		const refreshButton = actions.createEl('button', {
			text: 'Refresh',
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			await this.refresh();
		});

		contentEl.createEl('p', {
			text: this.plugin.settings.showWelcomeMessage
				? this.plugin.settings.statusMessage
				: 'Welcome message is disabled. Activity data is shown in read-only mode.',
			cls: 'obs-wiki-view__description',
		});
		contentEl.createEl('p', {
			text: `Last refreshed: ${this.plugin.formatDisplayTime(
				Date.parse(snapshot.updatedAt)
			)}`,
			cls: 'obs-wiki-view__description',
		});

		const currentSection = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		currentSection.createEl('h3', { text: 'Current Task' });
		if (!snapshot.currentTask) {
			currentSection.createEl('p', {
				text: snapshot.missingTaskFolder
					? 'No agent task folder found at 02_timeline/agent_tasks. Agent/runtime setup should create the memory structure.'
					: 'No active or recent agent task found.',
				cls: 'obs-wiki-view__description',
			});
		} else {
			this.renderTaskEntry(currentSection, snapshot.currentTask, true);
		}

		const recentTaskSection = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		recentTaskSection.createEl('h3', { text: 'Recent Agent Tasks' });
		if (snapshot.recentTasks.length === 0) {
			recentTaskSection.createEl('p', {
				text: 'No agent task notes found yet.',
				cls: 'obs-wiki-view__description',
			});
		} else {
			const list = recentTaskSection.createEl('ul', {
				cls: 'obs-wiki-view__list',
			});
			for (const task of snapshot.recentTasks) {
				const item = list.createEl('li', { cls: 'obs-wiki-view__item' });
				this.renderTaskSummary(item, task);
			}
		}

		const auditSection = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		auditSection.createEl('h3', { text: 'Recent Audit Events' });
		if (snapshot.recentAuditEvents.length === 0) {
			auditSection.createEl('p', {
				text: snapshot.missingAuditSources
					? 'No audit source found. Create 00_control/audit_log.md or 00_control/audit/*.md.'
					: 'No audit events found yet.',
				cls: 'obs-wiki-view__description',
			});
		} else {
			const list = auditSection.createEl('ul', { cls: 'obs-wiki-view__list' });
			for (const event of snapshot.recentAuditEvents) {
				const item = list.createEl('li', { cls: 'obs-wiki-view__item' });
				item.createEl('div', {
					text: `${this.plugin.formatDisplayTime(event.sortTimestamp)} • ${event.action} • ${event.actor}`,
				});
				if (event.reason) {
					item.createEl('div', { text: `Reason: ${event.reason}` });
				}
				if (event.target || event.taskId) {
					const extras: string[] = [];
					if (event.target) extras.push(`target: ${event.target}`);
					if (event.taskId) extras.push(`task: ${event.taskId}`);
					item.createEl('div', { text: extras.join(' • ') });
				}
				item.createEl('small', { text: `file: ${event.path}` });
				if (event.snippet) {
					item.createEl('div', {
						text: this.plugin.trimText(event.snippet, 140),
					});
				}
			}
		}
	}

	private renderTaskEntry(container: HTMLElement, task: AgentTaskRecord, expanded: boolean): void {
		const item = container.createDiv({ cls: 'obs-wiki-view__item' });
		item.createEl('div', {
			text: `${this.plugin.formatDisplayTime(task.sortTimestamp)} • ${task.taskId} • ${task.agent} • ${task.status}`,
		});
		if (task.objective) {
			item.createEl('div', { text: `Objective: ${task.objective}` });
		}
		if (task.contextPack || task.relatedProject) {
			const extra: string[] = [];
			if (task.contextPack) extra.push(`context: ${task.contextPack}`);
			if (task.relatedProject) extra.push(`project: ${task.relatedProject}`);
			item.createEl('div', { text: extra.join(' • ') });
		}
		if (expanded) {
			const summary: string[] = [];
			if (task.startedAt) summary.push(`started ${task.startedAt}`);
			if (task.finishedAt) summary.push(`finished ${task.finishedAt}`);
			summary.push(`reads ${task.memoryReads.length}`);
			summary.push(`writes ${task.memoryWrites.length}`);
			summary.push(`captures ${task.sourceCaptures.length}`);
			summary.push(`proposals ${task.proposals.length}`);
			item.createEl('div', { text: summary.join(' • ') });
		}
		item.createEl('small', { text: `file: ${task.path}` });
		if (task.snippet) {
			item.createEl('div', {
				text: this.plugin.trimText(task.snippet, 140),
			});
		}
	}

	private renderTaskSummary(container: HTMLElement, task: AgentTaskRecord): void {
		const compact = container.createEl('div', {
			text: `${task.taskId} • ${this.plugin.formatDisplayTime(task.sortTimestamp)} • ${task.status}`,
			cls: 'obs-wiki-view__item',
		});
		if (task.objective) {
			compact.createEl('div', { text: task.objective });
		}
	}

	async refresh(): Promise<void> {
		const snapshot = await this.plugin.loadAgentActivitySnapshot();
		await this.render(snapshot);
	}
}

class ObsWikiReviewQueueView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ObsWikiPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_REVIEW_QUEUE_VIEW;
	}

	getDisplayText() {
		return 'Review Queue';
	}

	getViewData() {
		return '';
	}

	setViewData(_data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		await this.refresh();
	}

	private async render(snapshot: MemoryReviewQueueSnapshot): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Review Queue', cls: 'obs-wiki-view__title' });

		const header = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		header.createEl('div', {
			text: `Last refreshed: ${this.plugin.formatDisplayTime(
				Date.parse(snapshot.updatedAt)
			)}`,
			cls: 'obs-wiki-view__description',
		});

		const actions = header.createDiv();
		const refreshButton = actions.createEl('button', {
			text: 'Refresh',
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			await this.refresh();
		});

		if (snapshot.missingReviewQueueFolder) {
			contentEl.createEl('p', {
				text: 'No review queue folder found at 01_inbox/review_queue. Agent/runtime setup should create the memory structure.',
				cls: 'obs-wiki-view__description',
			});
			return;
		}

		if (snapshot.proposals.length === 0) {
			contentEl.createEl('p', {
				text: 'No memory proposals in the review queue yet.',
				cls: 'obs-wiki-view__description',
			});
			return;
		}

		const sections = this.groupByStatus(snapshot.proposals);
		const orderedStatuses: MemoryProposalStatus[] = [
			'pending',
			'revision_requested',
			'approved',
			'applied',
			'deferred',
			'rejected',
		];
		const unknown = sections['unknown'] || [];

		for (const status of orderedStatuses) {
			const proposals = sections[status] || [];
			if (proposals.length === 0) {
				continue;
			}

			const section = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
			section.createEl('h3', { text: `${status.toUpperCase()} (${proposals.length})` });

			for (const proposal of proposals) {
				const card = section.createDiv({ cls: 'obs-wiki-view__item' });
				card.createEl('div', {
					text: `${proposal.proposalId} • ${proposal.proposalKind} • ${proposal.riskLevel}`,
				});
				if (proposal.taskId) {
					card.createEl('div', { text: `Task: ${proposal.taskId}` });
				}
				if (proposal.targetNote) {
					card.createEl('div', { text: `Target: ${proposal.targetNote}` });
				}
				if (proposal.evidence.length > 0) {
					card.createEl('div', { text: `Evidence refs: ${proposal.evidence.join(', ')}` });
				}
				card.createEl('div', {
					text: `Created: ${proposal.created || 'unknown'} • Proposed by: ${proposal.proposedBy}`,
				});
				if (proposal.snippet) {
					card.createEl('div', {
						text: this.plugin.trimText(proposal.snippet, 140),
					});
				}

				card.createEl('small', { text: `file: ${proposal.path}` });

				if (proposal.approvalStatus === 'pending') {
					const actionRow = card.createDiv({ cls: 'obs-wiki-view__actions' });
					const approve = actionRow.createEl('button', {
						text: 'Approve',
						cls: 'mod-cta',
					});
					const reject = actionRow.createEl('button', {
						text: 'Reject',
						cls: 'mod-warning',
					});
					const defer = actionRow.createEl('button', {
						text: 'Defer',
					});
					const requestRevision = actionRow.createEl('button', {
						text: 'Request Revision',
					});

					const actionButtons = [approve, reject, defer, requestRevision];
					const updateStatus = async (status: MemoryProposalStatus) => {
						for (const button of actionButtons) {
							button.setAttribute('disabled', 'true');
						}
						try {
							await this.plugin.updateMemoryProposalStatus(proposal, status);
							await this.refresh();
						} finally {
							for (const button of actionButtons) {
								button.removeAttribute('disabled');
							}
						}
					};

					approve.addEventListener('click', () => void updateStatus('approved'));
					reject.addEventListener('click', () => void updateStatus('rejected'));
					defer.addEventListener('click', () => void updateStatus('deferred'));
					requestRevision.addEventListener('click', () => void updateStatus('revision_requested'));
				} else if (proposal.approvalStatus === 'approved') {
					const actionRow = card.createDiv({ cls: 'obs-wiki-view__actions' });
					const apply = actionRow.createEl('button', {
						text: 'Apply Approved Writeback',
						cls: 'mod-cta',
					});
					apply.addEventListener('click', () => {
						new Notice('Approved writeback is applied by Runtime through obs_wiki.apply_approved_writeback. The plugin does not write protected memory directly.');
					});
				}
			}
		}

		if (unknown.length > 0) {
			const section = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
			section.createEl('h3', {
				text: `UNKNOWN (${unknown.length})`,
			});
			for (const proposal of unknown) {
				const card = section.createDiv({ cls: 'obs-wiki-view__item' });
				card.createEl('div', {
					text: `${proposal.proposalId} • status: ${proposal.approvalStatus}`,
				});
			}
		}
	}

	async refresh(): Promise<void> {
		const snapshot = await this.plugin.loadMemoryReviewQueueSnapshot();
		await this.render(snapshot);
	}

	private groupByStatus(proposals: MemoryProposalRecord[]): Record<string, MemoryProposalRecord[]> {
		const grouped: Record<string, MemoryProposalRecord[]> = {};
		for (const proposal of proposals) {
			const status = proposal.approvalStatus || 'pending';
			if (!grouped[status]) {
				grouped[status] = [];
			}
			grouped[status].push(proposal);
		}
		return grouped;
	}
}

class ObsWikiMemoryInspectorView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_MEMORY_INSPECTOR_VIEW;
	}

	getDisplayText() {
		return 'Memory Inspector';
	}

	getViewData() {
		return '';
	}

	setViewData(_data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Memory Inspector', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: 'Scaffold placeholder: note source, claim, evidence, and agent usage inspection will be added later.',
			cls: 'obs-wiki-view__description',
		});
	}
}

class ObsWikiAuditLogView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ObsWikiPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_AUDIT_LOG_VIEW;
	}

	getDisplayText() {
		return 'Audit Log';
	}

	getViewData() {
		return '';
	}

	setViewData(_data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Audit Log', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: 'Scaffold placeholder: detailed agent, runtime, plugin, and user audit timeline will be added later. Recent audit events are visible in Agent Activity.',
			cls: 'obs-wiki-view__description',
		});
	}
}

class ObsWikiRuntimeStatusView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_RUNTIME_STATUS_VIEW;
	}

	getDisplayText() {
		return 'Runtime Status';
	}

	getViewData() {
		return '';
	}

	setViewData(_data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Runtime Status', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: 'Scaffold placeholder: MCP server, runtime index, context pack, lint, and source-analysis status will be added later.',
			cls: 'obs-wiki-view__description',
		});
	}
}

class ObsWikiPermissionPolicyView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_PERMISSION_POLICY_VIEW;
	}

	getDisplayText() {
		return 'Permission Policy';
	}

	getViewData() {
		return '';
	}

	setViewData(_data: string, _clear: boolean): void {
		return;
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onOpen() {
		await super.onOpen();
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Permission Policy', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: 'Runtime policy is read-only by default, with controlled writes for working records and review-gated apply for protected memory writeback.',
			cls: 'obs-wiki-view__description',
		});

		const sections = [
			{
				title: 'Read-only tools',
				items: [
					'obs_wiki.status',
					'obs_wiki.start_task',
					'obs_wiki.recall',
					'obs_wiki.read_note',
					'obs_wiki.list_review_queue',
					'obs_wiki.list_source_requests',
					'obs_wiki.list_approved_writebacks',
					'obs_wiki.audit_recent',
				],
			},
			{
				title: 'Low-risk write tools',
				items: [
					'obs_wiki.write_context_pack -> 06_outputs/context_packs/',
					'obs_wiki.write_session_note -> 02_timeline/sessions/',
					'obs_wiki.capture_source -> 03_sources/',
					'obs_wiki.propose_memory -> 01_inbox/review_queue/',
					'obs_wiki.analyze_source_request -> source, analysis, proposal, request status, audit',
				],
			},
			{
				title: 'Review-gated apply',
				items: [
					'obs_wiki.apply_approved_writeback requires approval_status=approved',
					'Runtime appends explicit ## Writeback content to an existing target note',
					'Proposal status becomes applied and an audit event is written',
				],
			},
			{
				title: 'Forbidden actions',
				items: [
					'No shell execution or package installation through MCP',
					'No vault-outside or .obsidian access',
					'No delete, rename, move, or bulk rewrite tools',
					'No direct protected memory write without Review Queue approval',
					'No Obsidian plugin entry for source submission or maintenance actions',
				],
			},
		];

		for (const policySection of sections) {
			const section = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
			section.createEl('h3', { text: policySection.title });
			const list = section.createEl('ul', { cls: 'obs-wiki-view__list' });
			for (const item of policySection.items) {
				list.createEl('li', { text: item, cls: 'obs-wiki-view__item' });
			}
		}

		const source = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		source.createEl('h3', { text: 'Policy source' });
		source.createEl('p', {
			text: 'docs/MCP_Tool_Permission_Matrix.md',
			cls: 'obs-wiki-view__description',
		});
	}
}

class ObsWikiSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: ObsWikiPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'obs-wiki' });

		new Setting(containerEl)
			.setName('Show welcome message')
			.setDesc('Display a welcome/status line in the Activity view.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showWelcomeMessage)
					.onChange(async (value) => {
						this.plugin.settings.showWelcomeMessage = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Status message')
			.setDesc('Text shown in Activity when welcome messages are enabled.')
			.addText((text) =>
				text
					.setPlaceholder(this.plugin.settings.statusMessage)
					.setValue(this.plugin.settings.statusMessage)
					.onChange(async (value) => {
						this.plugin.settings.statusMessage =
							value || 'Welcome to obs-wiki Agent Activity.';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Default agent scope')
			.setDesc('Reserved for later use while wiring permission controls.')
			.setDisabled(true)
			.addText((text) => {
				text.setValue(this.plugin.settings.defaultAgentScope);
			});
	}
}
