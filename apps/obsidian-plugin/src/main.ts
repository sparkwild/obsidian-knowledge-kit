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
	getLanguage,
} from 'obsidian';

declare const __OBS_WIKI_MCP_SERVER_PATH__: string;

const OBS_WIKI_ACTIVITY_VIEW = 'obs-wiki-activity';
const OBS_WIKI_SOURCE_STATUS_VIEW = 'obs-wiki-source-status';
const OBS_WIKI_REVIEW_QUEUE_VIEW = 'obs-wiki-review-queue';
const OBS_WIKI_MEMORY_INSPECTOR_VIEW = 'obs-wiki-memory-inspector';
const OBS_WIKI_AUDIT_LOG_VIEW = 'obs-wiki-audit-log';
const OBS_WIKI_RUNTIME_STATUS_VIEW = 'obs-wiki-runtime-status';
const OBS_WIKI_PERMISSION_POLICY_VIEW = 'obs-wiki-permission-policy';
const OBS_WIKI_AGENT_CONNECTIONS_VIEW = 'obs-wiki-agent-connections';
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
const CONTEXT_PACKS_PATH = '06_outputs/context_packs';
const SOURCES_PATH = '03_sources';
const MAX_TASK_SNIPPET_LENGTH = 160;
const MAX_TASK_ROWS = 6;
const MAX_AUDIT_ROWS = 12;
const MAX_SOURCE_STATUS_ROWS = 20;
const MAX_REVIEW_QUEUE_ROWS = 20;
const MAX_ACTIVITY_CONTEXT_PACK_ROWS = 5;
const MAX_ACTIVITY_SOURCE_CAPTURE_ROWS = 5;
const MAX_ACTIVITY_PROPOSAL_ROWS = 5;
const MAX_AGENT_CONNECTION_ROWS = 8;
const MAX_AGENT_TOOL_CALL_ROWS = 12;
const PLUGIN_DISPLAY_NAME_ZH = 'obs-wiki';
const PLUGIN_DISPLAY_NAME_EN = 'obs-wiki';
const DEFAULT_MCP_SERVER_PATH = __OBS_WIKI_MCP_SERVER_PATH__;
const LEGACY_DEFAULT_STATUS_MESSAGE = 'Welcome to obs-wiki Agent Activity.';
const LEGACY_BILINGUAL_DEFAULT_STATUS_MESSAGE =
	'欢迎使用 obs-wiki Agent Activity。 / Welcome to obs-wiki Agent Activity.';
const DEFAULT_STATUS_MESSAGE_ZH = '欢迎使用 obs-wiki。';
const DEFAULT_STATUS_MESSAGE_EN = 'Welcome to obs-wiki.';
const isChineseLanguage = (language: string): boolean => {
	const normalized = language.toLowerCase();
	return normalized === 'zh' || normalized.startsWith('zh-') || normalized.startsWith('zh_');
};
const ui = (zh: string, en: string): string => (isChineseLanguage(getLanguage()) ? zh : en);
const pluginDisplayName = (): string => ui(PLUGIN_DISPLAY_NAME_ZH, PLUGIN_DISPLAY_NAME_EN);
const defaultStatusMessage = (): string => ui(DEFAULT_STATUS_MESSAGE_ZH, DEFAULT_STATUS_MESSAGE_EN);
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

interface ContextPackRecord {
	path: string;
	title: string;
	taskId: string;
	createdAt: string;
	snippet: string;
	sortTimestamp: number;
}

interface SourceCaptureRecord {
	path: string;
	type: string;
	title: string;
	source: string;
	sourceKind: string;
	mode: string;
	taskId: string;
	createdAt: string;
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

const REVIEW_QUEUE_FILTERS: Array<MemoryProposalStatus | 'all'> = [
	'pending',
	'approved',
	'rejected',
	'revision_requested',
	'applied',
	'all',
];

const memoryProposalStatusLabel = (status: MemoryProposalStatus): string => {
	switch (status) {
		case 'approved':
			return ui('已批准', 'Approved');
		case 'rejected':
			return ui('已拒绝', 'Rejected');
		case 'deferred':
			return ui('已暂缓', 'Deferred');
		case 'revision_requested':
			return ui('需修订', 'Revision requested');
		case 'applied':
			return ui('已写回', 'Applied');
		case 'pending':
		default:
			return ui('待审核', 'Pending');
	}
};

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
	eventType: string;
	agentId: string;
	clientName: string;
	toolName: string;
	resultStatus: string;
	targetPaths: string[];
	durationMs: string;
	riskLevel: string;
	argsSummary: string;
	transport: string;
	runtimeVersion: string;
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
	recentContextPacks: ContextPackRecord[];
	recentSourceCaptures: SourceCaptureRecord[];
	recentProposals: MemoryProposalRecord[];
	recentAuditEvents: AuditEventRecord[];
	missingTaskFolder: boolean;
	missingAuditSources: boolean;
	updatedAt: string;
}

interface AgentConnectionRecord {
	agentId: string;
	clientName: string;
	transport: string;
	status: string;
	lastSeen: string;
	lastToolCall: string;
	runtimeVersion: string;
	permissionProfile: string;
	sortTimestamp: number;
}

interface AgentToolCallRecord {
	agentId: string;
	clientName: string;
	toolName: string;
	resultStatus: string;
	targetPaths: string[];
	timestamp: string;
	durationMs: string;
	riskLevel: string;
	argsSummary: string;
	sortTimestamp: number;
}

interface AgentConnectionsSnapshot {
	vaultRoot: string;
	mcpCommand: string;
	codexConfig: string;
	claudeConfig: string;
	cursorConfig: string;
	customConfig: string;
	recentAgents: AgentConnectionRecord[];
	recentToolCalls: AgentToolCallRecord[];
	missingAuditSources: boolean;
	updatedAt: string;
}

interface ObsWikiSettings {
	showWelcomeMessage: boolean;
	defaultAgentScope: string;
	statusMessage: string;
	mcpServerPath: string;
}

const DEFAULT_SETTINGS: ObsWikiSettings = {
	showWelcomeMessage: true,
	defaultAgentScope: 'vault',
	statusMessage: '',
	mcpServerPath: DEFAULT_MCP_SERVER_PATH,
};

export default class ObsWikiPlugin extends Plugin {
	settings: ObsWikiSettings = DEFAULT_SETTINGS;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (typeof this.settings.statusMessage !== 'string') {
			this.settings.statusMessage = '';
		}
		if (typeof this.settings.mcpServerPath !== 'string' || !this.settings.mcpServerPath.trim()) {
			this.settings.mcpServerPath = DEFAULT_MCP_SERVER_PATH;
		}
		if (
			this.settings.statusMessage === LEGACY_DEFAULT_STATUS_MESSAGE ||
			this.settings.statusMessage === LEGACY_BILINGUAL_DEFAULT_STATUS_MESSAGE ||
			this.settings.statusMessage === DEFAULT_STATUS_MESSAGE_ZH ||
			this.settings.statusMessage === DEFAULT_STATUS_MESSAGE_EN
		) {
			this.settings.statusMessage = '';
			await this.saveSettings();
		}

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
		this.registerView(
			OBS_WIKI_AGENT_CONNECTIONS_VIEW,
			(leaf) => new ObsWikiAgentConnectionsView(leaf, this)
		);

		this.addRibbonIcon('brain-circuit', ui('打开 obs-wiki 活动', 'Open obs-wiki activity'), () => {
			this.openPluginView(OBS_WIKI_ACTIVITY_VIEW);
		});

		this.addCommand({
			id: 'open-agent-activity',
			name: ui('打开 Agent 活动', 'Open agent activity'),
			callback: () => this.openPluginView(OBS_WIKI_ACTIVITY_VIEW),
		});

		this.addCommand({
			id: 'open-review-queue',
			name: ui('打开审核队列', 'Open review queue'),
			callback: () => this.openPluginView(OBS_WIKI_REVIEW_QUEUE_VIEW),
		});

		this.addCommand({
			id: 'open-memory-inspector',
			name: ui('打开记忆检查器', 'Open memory inspector'),
			callback: () => this.openPluginView(OBS_WIKI_MEMORY_INSPECTOR_VIEW),
		});

		this.addCommand({
			id: 'open-audit-log',
			name: ui('打开审计日志', 'Open audit log'),
			callback: () => this.openPluginView(OBS_WIKI_AUDIT_LOG_VIEW),
		});

		this.addCommand({
			id: 'open-runtime-status',
			name: ui('打开运行状态', 'Open runtime status'),
			callback: () => this.openPluginView(OBS_WIKI_RUNTIME_STATUS_VIEW),
		});

		this.addCommand({
			id: 'open-permission-policy',
			name: ui('打开权限策略', 'Open permission policy'),
			callback: () => this.openPluginView(OBS_WIKI_PERMISSION_POLICY_VIEW),
		});

		this.addCommand({
			id: 'open-agent-connections',
			name: ui('打开 Agent 连接中心', 'Open agent connections'),
			callback: () => this.openPluginView(OBS_WIKI_AGENT_CONNECTIONS_VIEW),
		});

		this.addCommand({
			id: 'refresh-views',
			name: ui('刷新视图', 'Refresh views'),
			callback: () => {
				void this.refreshGovernanceViews();
			},
		});

		this.addCommand({
			id: 'initialize-memory-structure',
			name: ui('初始化记忆结构', 'Initialize memory structure'),
			callback: () => {
				void this.promptInitializeMemoryStructure();
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
			new Notice(ui('obs-wiki 记忆结构已初始化。', 'obs-wiki memory structure initialized.'));
		} catch (error) {
			console.error('obs-wiki failed to initialize memory structure', error);
			new Notice(ui('obs-wiki 记忆结构初始化失败。', 'obs-wiki failed to initialize memory structure.'));
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

		await this.app.vault.process(finalAuditFile, (current) => {
			const normalizedCurrent = current.endsWith('\n') ? current : `${current}\n`;
			const separator = normalizedCurrent.length > 0 ? '\n' : '';
			return `${normalizedCurrent}${separator}${rawEvent}`;
		});
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

	private async refreshAgentConnectionViews(): Promise<void> {
		const connectionLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_AGENT_CONNECTIONS_VIEW);
		for (const leaf of connectionLeaves) {
			const view = leaf.view;
			if (view instanceof ObsWikiAgentConnectionsView) {
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

	async refreshGovernanceViews(): Promise<void> {
		await this.refreshActivityViews();
		await this.refreshReviewQueueViews();
		await this.refreshSourceStatusViews();
		await this.refreshAgentConnectionViews();
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
		const [
			recentTasks,
			recentContextPacks,
			recentSourceCaptures,
			recentProposals,
			recentAuditEvents,
		] = await Promise.all([
			this.readRecentAgentTasks(MAX_TASK_ROWS),
			this.readRecentContextPacks(MAX_ACTIVITY_CONTEXT_PACK_ROWS),
			this.readRecentSourceCaptures(MAX_ACTIVITY_SOURCE_CAPTURE_ROWS),
			this.readRecentMemoryProposals(MAX_ACTIVITY_PROPOSAL_ROWS),
			this.readRecentAuditEvents(MAX_AUDIT_ROWS),
		]);
		const currentTask = this.pickCurrentTask(recentTasks);
		const taskFolderMissing =
			this.app.vault.getAbstractFileByPath(AGENT_TASKS_PATH) === null;
		const auditLogMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;
		const auditDirMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir) === null;

		return {
			currentTask,
			recentTasks,
			recentContextPacks,
			recentSourceCaptures,
			recentProposals,
			recentAuditEvents,
			missingTaskFolder: taskFolderMissing,
			missingAuditSources: auditLogMissing && auditDirMissing,
			updatedAt: new Date().toISOString(),
		};
	}

	async loadAgentConnectionsSnapshot(): Promise<AgentConnectionsSnapshot> {
		const auditLogMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;
		const auditDirMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir) === null;
		const auditEvents = await this.readRecentAuditEvents(80);
		const toolCalls = auditEvents
			.filter((event) => this.isToolCallAuditEvent(event))
			.map((event) => this.toAgentToolCallRecord(event))
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, MAX_AGENT_TOOL_CALL_ROWS);
		const recentAgents = this.buildRecentAgentConnections(auditEvents, toolCalls)
			.slice(0, MAX_AGENT_CONNECTION_ROWS);
		const vaultRoot = this.getVaultRoot();
		const mcpCommand = this.buildMcpCommand(vaultRoot);

		return {
			vaultRoot,
			mcpCommand,
			codexConfig: this.buildMcpConfig(vaultRoot, 'codex'),
			claudeConfig: this.buildMcpConfig(vaultRoot, 'claude'),
			cursorConfig: this.buildMcpConfig(vaultRoot, 'cursor'),
			customConfig: this.buildMcpConfig(vaultRoot, 'custom'),
			recentAgents,
			recentToolCalls: toolCalls,
			missingAuditSources: auditLogMissing && auditDirMissing,
			updatedAt: new Date().toISOString(),
		};
	}

	private getVaultRoot(): string {
		const adapter = this.app.vault.adapter as unknown as { basePath?: string };
		return adapter.basePath || ui('当前 vault 路径不可用', 'Current vault path unavailable');
	}

	private buildMcpCommand(vaultRoot: string): string {
		return `node "${this.getMcpServerPath()}" --vault-root "${vaultRoot}"`;
	}

	private buildMcpConfig(vaultRoot: string, client: string): string {
		const serverPath = this.getMcpServerPath();
		if (client === 'codex') {
			return [
				'[mcp_servers.obs-wiki]',
				'type = "stdio"',
				'command = "node"',
				`args = [${JSON.stringify(serverPath)}, "--vault-root", ${JSON.stringify(vaultRoot)}]`,
			].join('\n');
		}

		const config = {
			mcpServers: {
				'obs-wiki': {
					command: 'node',
					args: [
						serverPath,
						'--vault-root',
						vaultRoot,
					],
				},
			},
			client,
		};
		return JSON.stringify(config, null, 2);
	}

	private getMcpServerPath(): string {
		return (this.settings.mcpServerPath || DEFAULT_MCP_SERVER_PATH).trim();
	}

	private isToolCallAuditEvent(event: AuditEventRecord): boolean {
		return event.eventType === 'tool-call'
			|| event.eventType === 'agent-tool-call'
			|| (Boolean(event.toolName) && !this.isConnectionAuditEvent(event));
	}

	private isConnectionAuditEvent(event: AuditEventRecord): boolean {
		return event.eventType === 'connection' || event.eventType === 'agent-connection-event' || event.action === 'connection' || event.action === 'mcp.initialize';
	}

	private toAgentToolCallRecord(event: AuditEventRecord): AgentToolCallRecord {
		return {
			agentId: event.agentId || 'unknown',
			clientName: event.clientName || 'unknown',
			toolName: event.toolName || event.action || 'unknown',
			resultStatus: event.resultStatus || 'unknown',
			targetPaths: event.targetPaths,
			timestamp: event.timestamp,
			durationMs: event.durationMs,
			riskLevel: event.riskLevel || 'unknown',
			argsSummary: event.argsSummary,
			sortTimestamp: event.sortTimestamp,
		};
	}

	private buildRecentAgentConnections(
		auditEvents: AuditEventRecord[],
		toolCalls: AgentToolCallRecord[]
	): AgentConnectionRecord[] {
		const agents = new Map<string, AgentConnectionRecord>();
		const upsertAgent = (agentId: string, clientName: string, timestamp: string, sortTimestamp: number) => {
			const key = `${clientName || 'unknown'}::${agentId || 'unknown'}`;
			const existing = agents.get(key);
			if (existing && existing.sortTimestamp >= sortTimestamp) {
				return existing;
			}
			const next = existing || {
				agentId: agentId || 'unknown',
				clientName: clientName || 'unknown',
				transport: 'stdio',
				status: 'seen',
				lastSeen: timestamp,
				lastToolCall: '',
				runtimeVersion: '',
				permissionProfile: 'read-only default + controlled write',
				sortTimestamp,
			};
			next.lastSeen = timestamp || next.lastSeen;
			next.sortTimestamp = sortTimestamp || next.sortTimestamp;
			agents.set(key, next);
			return next;
		};

		for (const event of auditEvents.filter((item) => this.isConnectionAuditEvent(item))) {
			const agent = upsertAgent(event.agentId, event.clientName, event.timestamp, event.sortTimestamp);
			agent.transport = event.transport || agent.transport;
			agent.runtimeVersion = event.runtimeVersion || agent.runtimeVersion;
			agent.status = event.resultStatus || 'connected';
		}

		for (const call of toolCalls) {
			const agent = upsertAgent(call.agentId, call.clientName, call.timestamp, call.sortTimestamp);
			agent.lastToolCall = call.toolName;
			agent.status = call.resultStatus === 'failed' ? 'warning' : 'active';
		}

		return [...agents.values()].sort((a, b) => b.sortTimestamp - a.sortTimestamp);
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

		const normalizedStatus = this.normalizeProposalStatus(nextStatus);
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.approval_status = normalizedStatus;
		});
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

	private async readRecentContextPacks(limit: number): Promise<ContextPackRecord[]> {
		const folder = this.app.vault.getAbstractFileByPath(CONTEXT_PACKS_PATH);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(files.map((file) => this.readContextPackFile(file)));
		return records
			.filter((record): record is ContextPackRecord => Boolean(record))
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, limit);
	}

	private async readContextPackFile(file: TFile): Promise<ContextPackRecord | null> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read context pack: ${file.path}`, error);
			return null;
		}

		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const createdAt = this.firstString(data, ['created_at', 'createdAt', 'created']);
		const title = this.firstString(data, ['title']) || file.basename;

		return {
			path: file.path,
			title,
			taskId: this.firstString(data, ['task_id', 'taskId']),
			createdAt,
			snippet: this.snippetFromText(parsed.body, title),
			sortTimestamp: this.parseTimestamp(createdAt, file.stat?.mtime),
		};
	}

	private async readRecentSourceCaptures(limit: number): Promise<SourceCaptureRecord[]> {
		const folder = this.app.vault.getAbstractFileByPath(SOURCES_PATH);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(files.map((file) => this.readSourceCaptureFile(file)));
		return records
			.filter((record): record is SourceCaptureRecord => Boolean(record))
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, limit);
	}

	private async readSourceCaptureFile(file: TFile): Promise<SourceCaptureRecord | null> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`obs-wiki failed to read source capture: ${file.path}`, error);
			return null;
		}

		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const type = this.firstString(data, ['type']) || 'source';
		const createdAt = this.firstString(data, ['created_at', 'createdAt', 'created']);
		const source = this.firstString(data, ['source']) || file.basename;
		const title = this.firstString(data, ['title']) || source;

		return {
			path: file.path,
			type,
			title,
			source,
			sourceKind: this.firstString(data, ['source_kind', 'sourceKind']) || 'unknown',
			mode: this.firstString(data, ['mode']) || '',
			taskId: this.firstString(data, ['task_id', 'taskId']),
			createdAt,
			snippet: this.snippetFromText(parsed.body, source),
			sortTimestamp: this.parseTimestamp(createdAt, file.stat?.mtime),
		};
	}

	private async readRecentMemoryProposals(limit: number): Promise<MemoryProposalRecord[]> {
		const folder = this.app.vault.getAbstractFileByPath(REVIEW_QUEUE_PATH);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(files.map((file) => this.readMemoryProposalFile(file)));
		return records
			.filter((record): record is MemoryProposalRecord => Boolean(record))
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
					eventType: this.firstString(data, ['type']),
					agentId: this.firstString(data, ['agent_id', 'agentId', 'session_id', 'sessionId']),
					clientName: this.firstString(data, ['client_name', 'clientName', 'client']),
					toolName: this.firstString(data, ['tool_name', 'toolName', 'tool']),
					resultStatus: this.firstString(data, ['result_status', 'resultStatus', 'status']),
					targetPaths: this.readStringList(data, ['target_paths', 'targetPaths', 'target_path', 'targetPath', 'target']),
					durationMs: this.firstString(data, ['duration_ms', 'durationMs']),
					riskLevel: this.firstString(data, ['risk_level', 'riskLevel']),
					argsSummary: this.firstString(data, ['args_summary', 'argsSummary']),
					transport: this.firstString(data, ['transport']),
					runtimeVersion: this.firstString(data, ['runtime_version', 'runtimeVersion']),
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
				eventType: this.firstString(row, ['type']),
				agentId: this.firstString(row, ['agent_id', 'agentId', 'session_id', 'sessionId']),
				clientName: this.firstString(row, ['client_name', 'clientName', 'client']),
				toolName: this.firstString(row, ['tool_name', 'toolName', 'tool']),
				resultStatus: this.firstString(row, ['result_status', 'resultStatus', 'status']),
				targetPaths: this.readStringList(row, ['target_paths', 'targetPaths', 'target_path', 'targetPath', 'target']),
				durationMs: this.firstString(row, ['duration_ms', 'durationMs']),
				riskLevel: this.firstString(row, ['risk_level', 'riskLevel']),
				argsSummary: this.firstString(row, ['args_summary', 'argsSummary']),
				transport: this.firstString(row, ['transport']),
				runtimeVersion: this.firstString(row, ['runtime_version', 'runtimeVersion']),
			});
		}

		return events;
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
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			const normalized = trimmed.replace(/^-\s+/, '');
			const match = normalized.match(/^([^:]+):\s*(.*)$/);
			if (!match) {
				continue;
			}
			const key = match[1].trim();
			const rawValue = match[2].trim();
			if (rawValue) {
				rows[key] = this.parseScalarOrArray(rawValue);
				continue;
			}

			const listValues: string[] = [];
			for (let listIndex = index + 1; listIndex < lines.length; listIndex += 1) {
				const listMatch = lines[listIndex].match(/^\s+-\s+(.*)$/);
				if (!listMatch) {
					break;
				}
				const value = this.parseScalarOrArray(listMatch[1].trim());
				if (typeof value === 'string' && value) {
					listValues.push(value);
				} else if (Array.isArray(value)) {
					listValues.push(...value);
				}
				index = listIndex;
			}
			rows[key] = listValues;
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

	async openPluginView(viewType: string) {
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

	async copyToClipboard(value: string, successMessage: string): Promise<void> {
		await navigator.clipboard.writeText(value);
		new Notice(successMessage);
	}

	getStatusMessage(): string {
		const customStatusMessage = (this.settings.statusMessage || '').trim();
		return customStatusMessage.length > 0 ? customStatusMessage : defaultStatusMessage();
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
		this.titleEl.setText(ui('初始化记忆结构', 'Initialize memory structure'));

		const { contentEl } = this;
		contentEl.empty();

		const { foldersToCreate, filesToCreate } = this.options.plan;
		contentEl.createEl('p', {
			text: ui(
				'将为当前仓库创建以下缺失的 obs-wiki 结构。',
				'The following obs-wiki structure will be created if missing in this vault.'
			),
		});

		if (foldersToCreate.length === 0 && filesToCreate.length === 0) {
			contentEl.createEl('p', {
				text: ui(
					'没有缺失项，不会创建新的文件或文件夹。',
					'Nothing is missing. No files or folders will be created.'
				),
			});
		} else {
			const section = contentEl.createDiv();
			section.createEl('h3', { text: ui('文件夹', 'Folders') });
			const folderList = section.createEl('ul');
			for (const folder of foldersToCreate) {
				folderList.createEl('li', { text: folder });
			}

			section.createEl('h3', { text: ui('文件', 'Files') });
			const fileList = section.createEl('ul');
			for (const file of filesToCreate) {
				fileList.createEl('li', { text: file });
			}
		}

		const actions = contentEl.createDiv({ cls: 'modal-button-container' });
		const cancel = actions.createEl('button', { text: ui('取消', 'Cancel'), cls: 'mod-warning' });
		cancel.addEventListener('click', () => this.close());

		const confirm = actions.createEl('button', { text: ui('初始化', 'Initialize'), cls: 'mod-cta' });
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
		return ui('来源状态', 'Source status');
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

		contentEl.createEl('h2', { text: ui('来源状态', 'Source status'), cls: 'obs-wiki-view__title' });

		const header = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		header.createEl('div', {
			text: `${ui('最后刷新', 'Last refreshed')}: ${this.plugin.formatDisplayTime(
				Date.parse(snapshot.updatedAt)
			)}`,
			cls: 'obs-wiki-view__description',
		});
		const actions = header.createDiv();
		const refreshButton = actions.createEl('button', {
			text: ui('刷新', 'Refresh'),
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			await this.refresh();
		});

		if (snapshot.missingRequestFolder) {
			contentEl.createEl('p', {
				text: ui(
					'未找到 Agent 来源请求文件夹 01_inbox/agent_requests。记忆结构创建后，Agent 生成的请求会显示在这里。',
					'No agent source request folder found at 01_inbox/agent_requests. Agent-created requests will appear here after the memory structure exists.'
				),
				cls: 'obs-wiki-view__description',
			});
			return;
		}

		if (snapshot.requests.length === 0) {
			contentEl.createEl('p', {
				text: ui(
					'当前没有待处理的 Agent 来源请求。',
					'No pending agent-created source requests yet.'
				),
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
				item.createEl('div', { text: `${ui('来源', 'Source')}: ${this.plugin.trimText(request.source, 120)}` });
			}
			if (request.purpose) {
				item.createEl('div', { text: `${ui('用途', 'Purpose')}: ${request.purpose}` });
			}
			if (request.analysisMode) {
				item.createEl('div', { text: `${ui('分析模式', 'Analysis mode')}: ${request.analysisMode}` });
			}
			if (request.relatedProject) {
				item.createEl('div', { text: `${ui('关联项目', 'Related project')}: ${request.relatedProject}` });
			}
			if (request.summary) {
				item.createEl('div', { text: this.plugin.trimText(request.summary, 140) });
			}
			item.createEl('small', { text: `${ui('文件', 'File')}: ${request.path}` });
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
		return pluginDisplayName();
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

		const header = contentEl.createDiv({ cls: 'obs-wiki-shell-header' });
		const heading = header.createDiv();
		heading.createEl('h2', { text: ui('Agent 活动', 'Agent activity'), cls: 'obs-wiki-view__title' });
		heading.createEl('p', {
			text: this.plugin.settings.showWelcomeMessage
				? this.plugin.getStatusMessage()
				: ui(
					'欢迎信息已关闭。活动数据以只读模式显示。',
					'Welcome message is disabled. Activity data is shown in read-only mode.'
				),
			cls: 'obs-wiki-view__description',
		});
		const actions = header.createDiv({ cls: 'obs-wiki-action-row' });
		const refreshButton = actions.createEl('button', {
			text: ui('刷新', 'Refresh'),
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			await this.refresh();
		});
		const reviewButton = actions.createEl('button', {
			text: ui('打开审核队列', 'Open Review Queue'),
		});
		reviewButton.addEventListener('click', () => {
			void this.plugin.openPluginView(OBS_WIKI_REVIEW_QUEUE_VIEW);
		});
		const connectionsButton = actions.createEl('button', {
			text: ui('打开 Agent 连接', 'Open Agent Connections'),
		});
		connectionsButton.addEventListener('click', () => {
			void this.plugin.openPluginView(OBS_WIKI_AGENT_CONNECTIONS_VIEW);
		});

		const statusBar = contentEl.createDiv({ cls: 'obs-wiki-status-bar' });
		this.renderStatusItem(statusBar, 'MCP', snapshot.recentAuditEvents.some((event) => event.toolName) ? ui('已看到调用', 'Tool calls seen') : ui('等待连接', 'Waiting'));
		this.renderStatusItem(statusBar, 'Runtime', snapshot.missingTaskFolder ? ui('待初始化', 'Setup needed') : ui('可读取', 'Readable'));
		this.renderStatusItem(statusBar, 'Vault', snapshot.missingTaskFolder ? ui('结构缺失', 'Missing structure') : ui('已初始化', 'Initialized'));
		this.renderStatusItem(statusBar, 'Mode', ui('只读默认 + 受控写入', 'Read-only default + controlled write'));
		this.renderStatusItem(statusBar, ui('刷新', 'Refresh'), this.plugin.formatDisplayTime(Date.parse(snapshot.updatedAt)));

		const metrics = contentEl.createDiv({ cls: 'obs-wiki-metric-grid' });
		this.renderMetricCard(metrics, ui('当前任务', 'Active task'), snapshot.currentTask ? snapshot.currentTask.status : ui('无', 'None'), snapshot.currentTask?.taskId || ui('等待 Agent 调用 obs_wiki.start_task', 'Waiting for obs_wiki.start_task'));
		this.renderMetricCard(metrics, ui('待审核', 'Pending review'), String(snapshot.recentProposals.filter((proposal) => proposal.approvalStatus === 'pending').length), ui('最近提案中的待处理项', 'Pending items among recent proposals'));
		this.renderMetricCard(metrics, ui('来源请求', 'Source requests'), String(snapshot.recentSourceCaptures.length), ui('最近来源捕获记录', 'Recent source capture records'));
		this.renderMetricCard(metrics, ui('工具调用', 'Tool calls'), String(snapshot.recentAuditEvents.filter((event) => event.toolName).length), ui('最近 MCP tool-call 审计', 'Recent MCP tool-call audit'));

		const currentSection = contentEl.createDiv({ cls: 'obs-wiki-card' });
		currentSection.createEl('h3', { text: ui('当前任务', 'Current task') });
		if (!snapshot.currentTask) {
			this.renderEmptyState(
				currentSection,
				snapshot.missingTaskFolder
					? ui('Agent 任务文件夹缺失。', 'Agent task folder is missing.')
					: ui('还没有 Agent 活动。', 'No Agent activity yet.'),
				snapshot.missingTaskFolder
					? ui('Runtime 或初始化流程应创建 02_timeline/agent_tasks。', 'The runtime or initialization flow should create 02_timeline/agent_tasks.')
					: ui('请从 Agent 客户端开始，并让它使用 obs-wiki 记忆。建议第一个工具：obs_wiki.start_task。', 'Start from your Agent client and ask it to use obs-wiki memory. Suggested first tool: obs_wiki.start_task.')
			);
		} else {
			this.renderTaskEntry(currentSection, snapshot.currentTask, true);
		}

		const timelineItems = [
			...snapshot.recentTasks.map((task) => ({
				time: task.sortTimestamp,
				type: ui('任务', 'Task'),
				title: task.taskId,
				meta: `${task.agent} • ${task.status}`,
				body: task.objective || task.snippet,
				path: task.path,
			})),
			...snapshot.recentContextPacks.map((contextPack) => ({
				time: contextPack.sortTimestamp,
				type: 'context',
				title: contextPack.title,
				meta: contextPack.taskId,
				body: contextPack.snippet,
				path: contextPack.path,
			})),
			...snapshot.recentSourceCaptures.map((source) => ({
				time: source.sortTimestamp,
				type: ui('来源', 'Source'),
				title: source.sourceKind,
				meta: source.mode || source.type,
				body: source.source || source.snippet,
				path: source.path,
			})),
			...snapshot.recentProposals.map((proposal) => ({
				time: proposal.sortTimestamp,
				type: ui('提案', 'Proposal'),
				title: proposal.proposalId,
				meta: `${memoryProposalStatusLabel(proposal.approvalStatus)} • ${proposal.proposalKind}`,
				body: proposal.snippet,
				path: proposal.path,
			})),
			...snapshot.recentAuditEvents.map((event) => ({
				time: event.sortTimestamp,
				type: event.toolName ? ui('工具调用', 'Tool call') : ui('审计', 'Audit'),
				title: event.toolName || event.action,
				meta: event.resultStatus || event.actor,
				body: event.reason || event.argsSummary || event.snippet,
				path: event.target || event.path,
			})),
		].sort((a, b) => b.time - a.time).slice(0, 18);

		const timeline = contentEl.createDiv({ cls: 'obs-wiki-card' });
		timeline.createEl('h3', { text: ui('活动时间线', 'Activity timeline') });
		if (timelineItems.length === 0) {
			this.renderEmptyState(
				timeline,
				ui('还没有可展示的活动。', 'No activity to display yet.'),
				ui('让 Agent 通过 MCP 调用 obs_wiki.start_task、obs_wiki.recall 或其他 obs-wiki 工具后，这里会显示时间线。', 'Ask an Agent to call obs_wiki.start_task, obs_wiki.recall, or other obs-wiki tools through MCP to populate this timeline.')
			);
		} else {
			const list = timeline.createDiv({ cls: 'obs-wiki-timeline' });
			for (const item of timelineItems) {
				const row = list.createDiv({ cls: 'obs-wiki-timeline__item' });
				row.createEl('div', { text: item.type, cls: 'obs-wiki-badge' });
				const body = row.createDiv({ cls: 'obs-wiki-timeline__body' });
				body.createEl('strong', { text: `${item.title || ui('未命名', 'Untitled')} • ${this.plugin.formatDisplayTime(item.time)}` });
				if (item.meta) {
					body.createEl('div', { text: item.meta, cls: 'obs-wiki-view__description' });
				}
				if (item.body) {
					body.createEl('div', { text: this.plugin.trimText(item.body, 160) });
				}
				if (item.path) {
					body.createEl('small', { text: item.path });
				}
			}
		}
	}

	private renderStatusItem(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'obs-wiki-status-pill' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderMetricCard(container: HTMLElement, label: string, value: string, detail: string): void {
		const card = container.createDiv({ cls: 'obs-wiki-metric-card' });
		card.createEl('div', { text: label, cls: 'obs-wiki-metric-card__label' });
		card.createEl('strong', { text: value, cls: 'obs-wiki-metric-card__value' });
		card.createEl('div', { text: detail, cls: 'obs-wiki-view__description' });
	}

	private renderEmptyState(container: HTMLElement, title: string, detail: string): void {
		const empty = container.createDiv({ cls: 'obs-wiki-empty-state' });
		empty.createEl('strong', { text: title });
		empty.createEl('p', { text: detail });
	}

	private renderTaskEntry(container: HTMLElement, task: AgentTaskRecord, expanded: boolean): void {
		const item = container.createDiv({ cls: 'obs-wiki-view__item' });
		item.createEl('div', {
			text: `${this.plugin.formatDisplayTime(task.sortTimestamp)} • ${task.taskId} • ${task.agent} • ${task.status}`,
		});
		if (task.objective) {
			item.createEl('div', { text: `${ui('目标', 'Objective')}: ${task.objective}` });
		}
		if (task.contextPack || task.relatedProject) {
			const extra: string[] = [];
			if (task.contextPack) extra.push(`${ui('上下文', 'Context')}: ${task.contextPack}`);
			if (task.relatedProject) extra.push(`${ui('项目', 'Project')}: ${task.relatedProject}`);
			item.createEl('div', { text: extra.join(' • ') });
		}
		if (expanded) {
			const summary: string[] = [];
			if (task.startedAt) summary.push(`${ui('开始', 'Started')} ${task.startedAt}`);
			if (task.finishedAt) summary.push(`${ui('完成', 'Finished')} ${task.finishedAt}`);
			summary.push(`${ui('读取', 'Reads')} ${task.memoryReads.length}`);
			summary.push(`${ui('写入', 'Writes')} ${task.memoryWrites.length}`);
			summary.push(`${ui('捕获', 'Captures')} ${task.sourceCaptures.length}`);
			summary.push(`${ui('提案', 'Proposals')} ${task.proposals.length}`);
			item.createEl('div', { text: summary.join(' • ') });
		}
		item.createEl('small', { text: `${ui('文件', 'File')}: ${task.path}` });
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
	private activeFilter: MemoryProposalStatus | 'all' = 'pending';

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
		return ui('审核队列', 'Review queue');
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

		const header = contentEl.createDiv({ cls: 'obs-wiki-shell-header' });
		const heading = header.createDiv();
		heading.createEl('h2', { text: ui('审核队列', 'Review queue'), cls: 'obs-wiki-view__title' });
		heading.createEl('p', {
			text: `${ui('最后刷新', 'Last refreshed')}: ${this.plugin.formatDisplayTime(Date.parse(snapshot.updatedAt))}`,
			cls: 'obs-wiki-view__description',
		});

		const actions = header.createDiv({ cls: 'obs-wiki-action-row' });
		const refreshButton = actions.createEl('button', {
			text: ui('刷新', 'Refresh'),
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			await this.refresh();
		});

		if (snapshot.missingReviewQueueFolder) {
			contentEl.createEl('p', {
				text: ui(
					'未找到审核队列文件夹 01_inbox/review_queue。Agent/runtime 初始化应创建该记忆结构。',
					'No review queue folder found at 01_inbox/review_queue. Agent/runtime setup should create the memory structure.'
				),
				cls: 'obs-wiki-view__description',
			});
			return;
		}

		if (snapshot.proposals.length === 0) {
			this.renderEmptyState(
				contentEl,
				ui('审核队列中还没有记忆提案。', 'No memory proposals in the review queue yet.'),
				ui('长期记忆、用户偏好和重要决策必须先由 Agent 创建 proposal，再由你在这里审核。', 'Long-term memory, preferences, and important decisions must be proposed by an Agent first, then reviewed here.')
			);
			return;
		}

		const counts = this.countByStatus(snapshot.proposals);
		const tabs = contentEl.createDiv({ cls: 'obs-wiki-filter-tabs' });
		for (const filter of REVIEW_QUEUE_FILTERS) {
			const label = filter === 'all' ? ui('全部', 'All') : memoryProposalStatusLabel(filter);
			const count = filter === 'all' ? snapshot.proposals.length : counts[filter] || 0;
			const button = tabs.createEl('button', {
				text: `${label} (${count})`,
				cls: this.activeFilter === filter ? 'is-active' : '',
			});
			button.addEventListener('click', async () => {
				this.activeFilter = filter;
				await this.render(snapshot);
			});
		}

		const visibleProposals = snapshot.proposals.filter((proposal) =>
			this.activeFilter === 'all' ? true : proposal.approvalStatus === this.activeFilter
		);
		const grid = contentEl.createDiv({ cls: 'obs-wiki-proposal-grid' });
		if (visibleProposals.length === 0) {
			this.renderEmptyState(
				grid,
				ui('当前筛选下没有提案。', 'No proposals for the current filter.'),
				ui('切换筛选或等待 Agent 生成新的 Review Queue proposal。', 'Switch filters or wait for an Agent to create new Review Queue proposals.')
			);
			return;
		}

		for (const proposal of visibleProposals) {
			this.renderProposalCard(grid, proposal);
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

	private countByStatus(proposals: MemoryProposalRecord[]): Record<MemoryProposalStatus, number> {
		const counts: Record<MemoryProposalStatus, number> = {
			pending: 0,
			approved: 0,
			rejected: 0,
			deferred: 0,
			revision_requested: 0,
			applied: 0,
		};
		for (const proposal of proposals) {
			counts[proposal.approvalStatus] += 1;
		}
		return counts;
	}

	private renderProposalCard(container: HTMLElement, proposal: MemoryProposalRecord): void {
		const card = container.createDiv({ cls: 'obs-wiki-card obs-wiki-proposal-card' });
		const header = card.createDiv({ cls: 'obs-wiki-card__header' });
		header.createEl('strong', { text: proposal.proposalId || ui('未命名提案', 'Untitled proposal') });
		const badges = header.createDiv({ cls: 'obs-wiki-badge-row' });
		badges.createEl('span', { text: proposal.proposalKind, cls: 'obs-wiki-badge' });
		badges.createEl('span', { text: proposal.riskLevel, cls: `obs-wiki-badge obs-wiki-badge--risk-${proposal.riskLevel.toLowerCase()}` });
		badges.createEl('span', { text: memoryProposalStatusLabel(proposal.approvalStatus), cls: 'obs-wiki-badge' });

		const facts = card.createDiv({ cls: 'obs-wiki-detail-grid' });
		this.renderDetail(facts, ui('目标笔记', 'Target note'), proposal.targetNote || ui('未指定', 'Not specified'));
		this.renderDetail(facts, ui('证据数量', 'Evidence count'), String(proposal.evidence.length));
		this.renderDetail(facts, ui('任务', 'Task'), proposal.taskId || ui('无', 'None'));
		this.renderDetail(facts, ui('创建时间', 'Created'), proposal.created || ui('未知', 'Unknown'));
		this.renderDetail(facts, ui('提议者', 'Proposed by'), proposal.proposedBy || 'unknown');
		if (proposal.snippet) {
			card.createEl('p', { text: this.plugin.trimText(proposal.snippet, 180), cls: 'obs-wiki-view__description' });
		}
		card.createEl('small', { text: `${ui('文件', 'File')}: ${proposal.path}` });

		if (proposal.evidence.length > 0) {
			const detailPanel = card.createDiv({ cls: 'obs-wiki-detail-panel' });
			detailPanel.createEl('strong', { text: ui('证据引用', 'Evidence refs') });
			detailPanel.createEl('div', { text: proposal.evidence.join(', ') });
		}

		this.renderProposalActions(card, proposal);
	}

	private renderDetail(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'obs-wiki-detail' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderProposalActions(card: HTMLElement, proposal: MemoryProposalRecord): void {
		if (proposal.approvalStatus === 'pending') {
			const actionRow = card.createDiv({ cls: 'obs-wiki-action-row' });
			const approve = actionRow.createEl('button', {
				text: ui('批准', 'Approve'),
				cls: 'mod-cta',
			});
			const reject = actionRow.createEl('button', {
				text: ui('拒绝', 'Reject'),
				cls: 'mod-warning',
			});
			const defer = actionRow.createEl('button', {
				text: ui('暂缓', 'Defer'),
			});
			const requestRevision = actionRow.createEl('button', {
				text: ui('要求修订', 'Request revision'),
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
			const actionRow = card.createDiv({ cls: 'obs-wiki-action-row' });
			const apply = actionRow.createEl('button', {
				text: ui('应用已批准写回', 'Apply approved writeback'),
				cls: 'mod-cta',
			});
			apply.addEventListener('click', () => {
				new Notice(ui(
					'已批准写回由 Runtime 通过 obs_wiki.apply_approved_writeback 执行，插件不会直接写入受保护记忆。',
					'Approved writeback is applied by Runtime through obs_wiki.apply_approved_writeback. The plugin does not write protected memory directly.'
				));
			});
		}
	}

	private renderEmptyState(container: HTMLElement, title: string, detail: string): void {
		const empty = container.createDiv({ cls: 'obs-wiki-empty-state' });
		empty.createEl('strong', { text: title });
		empty.createEl('p', { text: detail });
	}
}

class ObsWikiAgentConnectionsView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ObsWikiPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_AGENT_CONNECTIONS_VIEW;
	}

	getDisplayText() {
		return ui('Agent 连接中心', 'Agent connections');
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

	async refresh(): Promise<void> {
		const snapshot = await this.plugin.loadAgentConnectionsSnapshot();
		await this.render(snapshot);
	}

	private async render(snapshot: AgentConnectionsSnapshot): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		const header = contentEl.createDiv({ cls: 'obs-wiki-shell-header' });
		const heading = header.createDiv();
		heading.createEl('h2', { text: ui('Agent 连接中心', 'Agent Connection Center'), cls: 'obs-wiki-view__title' });
		heading.createEl('p', {
			text: ui(
				'生成 MCP 配置、查看已连接 Agent，并追踪最近工具调用。',
				'Generate MCP config, inspect recently seen agents, and track recent tool calls.'
			),
			cls: 'obs-wiki-view__description',
		});
		const actions = header.createDiv({ cls: 'obs-wiki-action-row' });
		const refreshButton = actions.createEl('button', { text: ui('刷新', 'Refresh'), cls: 'mod-cta' });
		refreshButton.addEventListener('click', async () => this.refresh());

		const statusBar = contentEl.createDiv({ cls: 'obs-wiki-status-bar' });
		this.renderStatusItem(statusBar, ui('运行模式', 'Runtime mode'), ui('stdio MCP', 'stdio MCP'));
		this.renderStatusItem(statusBar, ui('当前仓库', 'Current vault'), snapshot.vaultRoot);
		this.renderStatusItem(statusBar, ui('最近 Agent', 'Recent agents'), String(snapshot.recentAgents.length));
		this.renderStatusItem(statusBar, ui('工具调用', 'Tool calls'), String(snapshot.recentToolCalls.length));

		const runtime = contentEl.createDiv({ cls: 'obs-wiki-card' });
		runtime.createEl('h3', { text: ui('MCP Server 命令', 'MCP server command') });
		runtime.createEl('code', { text: snapshot.mcpCommand, cls: 'obs-wiki-code-block' });
		const commandAction = runtime.createDiv({ cls: 'obs-wiki-action-row' });
		const copyCommand = commandAction.createEl('button', { text: ui('复制命令', 'Copy command') });
		copyCommand.addEventListener('click', () => {
			void this.plugin.copyToClipboard(snapshot.mcpCommand, ui('已复制 MCP 命令。', 'MCP command copied.'));
		});

		const configGrid = contentEl.createDiv({ cls: 'obs-wiki-config-grid' });
		this.renderConfigCard(configGrid, 'Codex', snapshot.codexConfig);
		this.renderConfigCard(configGrid, 'Claude', snapshot.claudeConfig);
		this.renderConfigCard(configGrid, 'Cursor', snapshot.cursorConfig);
		this.renderConfigCard(configGrid, ui('自定义', 'Custom'), snapshot.customConfig);

		const agents = contentEl.createDiv({ cls: 'obs-wiki-card' });
		agents.createEl('h3', { text: ui('最近出现的 Agent', 'Recently seen agents') });
		if (snapshot.recentAgents.length === 0) {
			this.renderEmptyState(
				agents,
				ui('还没有 Agent 连接记录。', 'No Agent connection records yet.'),
				snapshot.missingAuditSources
					? ui('未找到审计日志。Agent 连接 MCP 后，Runtime 会在 00_control/audit_log.md 写入连接事件。', 'No audit log found. Runtime writes connection events to 00_control/audit_log.md after an Agent connects.')
					: ui('复制上方配置到 Codex、Claude、Cursor 或自定义 Agent，然后让它连接 obs-wiki MCP。', 'Copy a config above into Codex, Claude, Cursor, or a custom Agent, then connect it to obs-wiki MCP.')
			);
		} else {
			const list = agents.createDiv({ cls: 'obs-wiki-table-list' });
			for (const agent of snapshot.recentAgents) {
				const row = list.createDiv({ cls: 'obs-wiki-table-row' });
				row.createEl('strong', { text: agent.clientName || agent.agentId });
				row.createEl('span', { text: agent.status });
				row.createEl('span', { text: `${ui('最后出现', 'Last seen')}: ${this.plugin.formatDisplayTime(agent.sortTimestamp)}` });
				row.createEl('span', { text: `${ui('最近工具', 'Last tool')}: ${agent.lastToolCall || ui('无', 'None')}` });
				row.createEl('small', { text: `${agent.transport} • ${agent.permissionProfile}` });
			}
		}

		const calls = contentEl.createDiv({ cls: 'obs-wiki-card' });
		calls.createEl('h3', { text: ui('最近工具调用', 'Recent tool calls') });
		if (snapshot.recentToolCalls.length === 0) {
			this.renderEmptyState(
				calls,
				ui('还没有工具调用记录。', 'No tool calls recorded yet.'),
				ui('Agent 调用 obs_wiki.* 工具后，这里会显示工具名、结果、风险等级和目标路径。', 'After an Agent calls obs_wiki.* tools, this panel shows tool name, result, risk level, and target paths.')
			);
		} else {
			const timeline = calls.createDiv({ cls: 'obs-wiki-timeline' });
			for (const call of snapshot.recentToolCalls) {
				const row = timeline.createDiv({ cls: 'obs-wiki-timeline__item' });
				row.createEl('div', { text: call.resultStatus, cls: 'obs-wiki-badge' });
				const body = row.createDiv({ cls: 'obs-wiki-timeline__body' });
				body.createEl('strong', { text: `${call.toolName} • ${this.plugin.formatDisplayTime(call.sortTimestamp)}` });
				body.createEl('div', {
					text: `${call.clientName || call.agentId} • ${ui('风险', 'Risk')}: ${call.riskLevel} • ${call.durationMs || '0'}ms`,
					cls: 'obs-wiki-view__description',
				});
				if (call.targetPaths.length > 0) {
					body.createEl('small', { text: call.targetPaths.join(', ') });
				}
				if (call.argsSummary) {
					body.createEl('div', { text: this.plugin.trimText(call.argsSummary, 180) });
				}
			}
		}

		const policy = contentEl.createDiv({ cls: 'obs-wiki-card' });
		policy.createEl('h3', { text: ui('权限矩阵摘要', 'Permission matrix summary') });
		const matrix = policy.createDiv({ cls: 'obs-wiki-detail-grid' });
		this.renderDetail(matrix, ui('默认', 'Default'), ui('只读', 'Read-only'));
		this.renderDetail(matrix, ui('工作记录', 'Working records'), ui('受控写入', 'Controlled write'));
		this.renderDetail(matrix, ui('长期记忆', 'Long-term memory'), ui('审核门控写回', 'Review-gated apply'));
		this.renderDetail(matrix, ui('禁止', 'Forbidden'), ui('shell、vault 外路径、.obsidian、删除/批量重写', 'shell, vault-outside paths, .obsidian, delete/bulk rewrite'));
	}

	private renderConfigCard(container: HTMLElement, title: string, config: string): void {
		const card = container.createDiv({ cls: 'obs-wiki-card obs-wiki-config-card' });
		const header = card.createDiv({ cls: 'obs-wiki-card__header' });
		header.createEl('strong', { text: title });
		const copy = header.createEl('button', { text: ui('复制配置', 'Copy config') });
		copy.addEventListener('click', () => {
			void this.plugin.copyToClipboard(config, ui('已复制 MCP 配置。', 'MCP config copied.'));
		});
		card.createEl('pre', { text: config, cls: 'obs-wiki-code-block' });
	}

	private renderStatusItem(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'obs-wiki-status-pill' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderDetail(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'obs-wiki-detail' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderEmptyState(container: HTMLElement, title: string, detail: string): void {
		const empty = container.createDiv({ cls: 'obs-wiki-empty-state' });
		empty.createEl('strong', { text: title });
		empty.createEl('p', { text: detail });
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
		return ui('记忆检查器', 'Memory inspector');
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

		contentEl.createEl('h2', { text: ui('记忆检查器', 'Memory inspector'), cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'脚手架占位：后续会加入笔记来源、claim、证据和 Agent 使用情况检查。',
				'Scaffold placeholder: note source, claim, evidence, and agent usage inspection will be added later.'
			),
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
		return ui('审计日志', 'Audit log');
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

		contentEl.createEl('h2', { text: ui('审计日志', 'Audit log'), cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'脚手架占位：后续会加入 Agent、Runtime、插件和用户的详细审计时间线。最近审计事件已在 Agent 活动中展示。',
				'Scaffold placeholder: detailed agent, runtime, plugin, and user audit timeline will be added later. Recent audit events are visible in Agent Activity.'
			),
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
		return ui('运行状态', 'Runtime status');
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

		contentEl.createEl('h2', { text: ui('运行状态', 'Runtime status'), cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'脚手架占位：后续会加入 MCP Server、Runtime 索引、context pack、lint 和来源分析状态。',
				'Scaffold placeholder: MCP server, runtime index, context pack, lint, and source-analysis status will be added later.'
			),
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
		return ui('权限策略', 'Permission policy');
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

		contentEl.createEl('h2', { text: ui('权限策略', 'Permission policy'), cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'Runtime 策略默认只读；工作记录使用受控写入，受保护记忆写回必须经过审核批准。',
				'Runtime policy is read-only by default, with controlled writes for working records and review-gated apply for protected memory writeback.'
			),
			cls: 'obs-wiki-view__description',
		});

		const sections = [
			{
				title: ui('只读工具', 'Read-only tools'),
				items: [
					'obs_wiki.status',
					'obs_wiki.start_task',
					'obs_wiki.recall',
					'obs_wiki.read_note',
					'obs_wiki.list_review_queue',
					'obs_wiki.list_source_requests',
					'obs_wiki.list_approved_writebacks',
					'obs_wiki.audit_recent',
					'obs_wiki.build_context_pack (write=false)',
					'obs_wiki.lint',
				],
			},
			{
				title: ui('低风险写入工具', 'Low-risk write tools'),
				items: [
					'obs_wiki.write_context_pack -> 06_outputs/context_packs/',
					'obs_wiki.build_context_pack (write=true) -> 06_outputs/context_packs/',
					'obs_wiki.write_session_note -> 02_timeline/sessions/',
					'obs_wiki.finish_task -> 02_timeline/sessions/',
					'obs_wiki.distill_session -> 02_timeline/sessions/ + 01_inbox/review_queue/',
					'obs_wiki.capture_source -> 03_sources/',
					'obs_wiki.propose_memory -> 01_inbox/review_queue/',
					'obs_wiki.analyze_source_request -> source, analysis, proposal, request status, audit',
				],
			},
			{
				title: ui('审核门控应用', 'Review-gated apply'),
				items: [
					ui(
						'obs_wiki.apply_approved_writeback 要求 approval_status=approved',
						'obs_wiki.apply_approved_writeback requires approval_status=approved'
					),
					ui(
						'Runtime 会向现有目标笔记追加明确的 ## Writeback content 内容',
						'Runtime appends explicit ## Writeback content to an existing target note'
					),
					ui(
						'提案状态会变为 applied，并写入审计事件',
						'Proposal status becomes applied and an audit event is written'
					),
				],
			},
			{
				title: ui('禁止动作', 'Forbidden actions'),
				items: [
					ui(
						'禁止通过 MCP 执行 shell 或安装包',
						'No shell execution or package installation through MCP'
					),
					ui(
						'禁止访问 vault 外部或 .obsidian',
						'No vault-outside or .obsidian access'
					),
					ui(
						'禁止删除、重命名、移动或批量重写工具',
						'No delete, rename, move, or bulk rewrite tools'
					),
					ui(
						'未通过审核队列批准时，禁止直接写入受保护记忆',
						'No direct protected memory write without Review Queue approval'
					),
					ui(
						'Obsidian 插件不提供来源提交或维护动作入口',
						'No Obsidian plugin entry for source submission or maintenance actions'
					),
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
		source.createEl('h3', { text: ui('策略来源', 'Policy source') });
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
		containerEl.createEl('h2', { text: pluginDisplayName() });

		new Setting(containerEl)
			.setName(ui('显示欢迎信息', 'Show welcome message'))
			.setDesc(ui(
				'在 Agent Activity 视图中显示欢迎或状态文本。',
				'Display a welcome/status line in the Agent Activity view.'
			))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showWelcomeMessage)
					.onChange(async (value) => {
						this.plugin.settings.showWelcomeMessage = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(ui('状态文本', 'Status message'))
			.setDesc(ui(
				'启用欢迎信息时，在 Agent Activity 中显示的文本。',
				'Text shown in Agent Activity when welcome messages are enabled.'
			))
			.addText((text) =>
				text
					.setPlaceholder(defaultStatusMessage())
					.setValue(this.plugin.settings.statusMessage)
					.onChange(async (value) => {
						this.plugin.settings.statusMessage = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(ui('MCP Server 路径', 'MCP server path'))
			.setDesc(ui(
				'Agent 连接中心生成配置时使用的 server.js 路径。',
				'Path to server.js used by Agent Connection Center generated configs.'
			))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_MCP_SERVER_PATH)
					.setValue(this.plugin.settings.mcpServerPath)
					.onChange(async (value) => {
						this.plugin.settings.mcpServerPath = value.trim() || DEFAULT_MCP_SERVER_PATH;
						await this.plugin.saveSettings();
						await this.plugin.refreshGovernanceViews();
					})
			);

		new Setting(containerEl)
			.setName(ui('默认 Agent 范围', 'Default agent scope'))
			.setDesc(ui(
				'预留给后续权限控制接入使用。',
				'Reserved for later use while wiring permission controls.'
			))
			.setDisabled(true)
			.addText((text) => {
				text.setValue(this.plugin.settings.defaultAgentScope);
			});
	}
}
