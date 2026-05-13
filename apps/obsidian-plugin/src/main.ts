import {
	App,
	ItemView,
	Modal,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	WorkspaceLeaf,
	getLanguage,
	setIcon,
} from 'obsidian';
import { randomBytes } from 'node:crypto';
import {
	StreamableHttpMcpRuntime,
	type StreamableHttpRuntimeStatus,
	type RuntimeState,
} from '../../mcp-server/src/http-runtime';

const WIKI_WEAVER_ACTIVITY_VIEW = 'wiki-weaver-activity';
const WIKI_WEAVER_SOURCE_STATUS_VIEW = 'wiki-weaver-source-status';
const WIKI_WEAVER_REVIEW_QUEUE_VIEW = 'wiki-weaver-review-queue';
const WIKI_WEAVER_MEMORY_INSPECTOR_VIEW = 'wiki-weaver-memory-inspector';
const WIKI_WEAVER_AUDIT_LOG_VIEW = 'wiki-weaver-audit-log';
const WIKI_WEAVER_RUNTIME_STATUS_VIEW = 'wiki-weaver-runtime-status';
const WIKI_WEAVER_PERMISSION_POLICY_VIEW = 'wiki-weaver-permission-policy';
const WIKI_WEAVER_AGENT_CONNECTIONS_VIEW = 'wiki-weaver-agent-connections';
const CONTROL_FILES: Array<{ path: string; content: string }> = [
	{
		path: '00_control/system.md',
		content: '# System Control\n\nObsidian-native memory system control defaults for Wiki Weaver.\n',
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
const PLUGIN_DISPLAY_NAME_ZH = '知识库';
const PLUGIN_DISPLAY_NAME_EN = 'Wiki Weaver';
const DEFAULT_MCP_PORT = 58437;
const DEFAULT_MCP_HOST = '127.0.0.1';
const DEFAULT_MCP_PATH = '/mcp';
const DEFAULT_MCP_HTTP_ENDPOINT = `http://${DEFAULT_MCP_HOST}:${DEFAULT_MCP_PORT}${DEFAULT_MCP_PATH}`;
const LEGACY_DEFAULT_MCP_HTTP_ENDPOINTS = ['http://127.0.0.1:37241/mcp'];
const DEFAULT_STATUS_MESSAGE_ZH = '欢迎使用知识库。';
const DEFAULT_STATUS_MESSAGE_EN = 'Welcome to Wiki Weaver.';
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

type StructureState = 'initialized' | 'partial' | 'missing';

interface WikiWeaverStructureStatus {
	state: StructureState;
	label: string;
	detail: string;
	missingFolders: string[];
	missingFiles: string[];
	missingCount: number;
	totalCount: number;
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
	taskId: string;
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
	'deferred',
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
	sessionId: string;
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
	runtimeStatus: RuntimeViewStatus;
	structureStatus: WikiWeaverStructureStatus;
	currentTask: AgentTaskRecord | null;
	recentTasks: AgentTaskRecord[];
	recentContextPacks: ContextPackRecord[];
	recentSourceCaptures: SourceCaptureRecord[];
	recentSourceRequests: SourceRequestRecord[];
	recentProposals: MemoryProposalRecord[];
	recentAuditEvents: AuditEventRecord[];
	missingTaskFolder: boolean;
	missingAuditSources: boolean;
	updatedAt: string;
}

interface AgentConnectionRecord {
	agentId: string;
	sessionId: string;
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
	sessionId: string;
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

type ConnectionTransport = 'streamable-http';
type ClientConfigState = 'configured' | 'needs_update' | 'not_configured' | 'unavailable';

interface RuntimeViewStatus {
	state: RuntimeState;
	label: string;
	detail: string;
	endpoint: string;
	host: string;
	port: number;
	startedAt: string;
	activeSessions: number;
	lastError: string;
}

interface ClientProfile {
	id: string;
	displayName: string;
	description: string;
	preferredTransport: ConnectionTransport;
	supportsAutoConfigure: boolean;
	restartRequired: boolean;
	configFormat: 'codex-toml' | 'mcp-json' | 'command' | 'copy-only';
	targetPath?: string;
}

interface GeneratedClientConfig {
	clientId: string;
	displayName: string;
	description: string;
	transport: ConnectionTransport;
	configText: string;
	supportsAutoConfigure: boolean;
	restartRequired: boolean;
	configFormat: ClientProfile['configFormat'];
	targetPath?: string;
	configState: ClientConfigState;
	configStatusLabel: string;
	configStatusDetail: string;
}

interface ApprovedWritebackPreview {
	proposal_id: string;
	proposal_path: string;
	target_note: string;
	writeback_preview: string;
	touched_notes: string[];
}

interface DesktopNodeApi {
	fs: {
		existsSync(path: string): boolean;
		readFileSync(path: string, encoding: 'utf8'): string;
		writeFileSync(path: string, content: string, encoding: 'utf8'): void;
		mkdirSync(path: string, options: { recursive: boolean }): void;
		renameSync(oldPath: string, newPath: string): void;
	};
	path: {
		dirname(path: string): string;
		join(...parts: string[]): string;
	};
	os: {
		homedir(): string;
	};
	shell?: {
		openPath(path: string): Promise<string>;
	};
}

interface AgentConnectionsSnapshot {
	vaultRoot: string;
	httpEndpoint: string;
	connectionUrl: string;
	runtimeStatus: RuntimeViewStatus;
	clientConfigs: GeneratedClientConfig[];
	recentAgents: AgentConnectionRecord[];
	recentToolCalls: AgentToolCallRecord[];
	missingAuditSources: boolean;
	updatedAt: string;
}

interface WikiWeaverSettings {
	showWelcomeMessage: boolean;
	defaultAgentScope: string;
	statusMessage: string;
	mcpPort: number;
	runtimeToken: string;
}

const DEFAULT_SETTINGS: WikiWeaverSettings = {
	showWelcomeMessage: true,
	defaultAgentScope: 'vault',
	statusMessage: '',
	mcpPort: DEFAULT_MCP_PORT,
	runtimeToken: '',
};

export default class WikiWeaverPlugin extends Plugin {
	settings: WikiWeaverSettings = DEFAULT_SETTINGS;
	private mcpRuntime: StreamableHttpMcpRuntime | null = null;
	private uiMcpSessionId = '';
	private uiMcpRequestId = 1;
	private runtimeStatus: StreamableHttpRuntimeStatus = {
		state: 'stopped',
		host: DEFAULT_MCP_HOST,
		port: DEFAULT_MCP_PORT,
		path: DEFAULT_MCP_PATH,
		endpoint: DEFAULT_MCP_HTTP_ENDPOINT,
		startedAt: '',
		activeSessions: 0,
		lastError: '',
	};

	async onload() {
		this.settings = this.normalizeSettings(await this.loadData());
		if (typeof this.settings.statusMessage !== 'string') {
			this.settings.statusMessage = '';
		}
		const savedStatusMessage = this.settings.statusMessage.trim();
		const isSavedDefaultMessage =
			savedStatusMessage === DEFAULT_STATUS_MESSAGE_ZH ||
			savedStatusMessage === DEFAULT_STATUS_MESSAGE_EN ||
			['wiki-weaver', 'Agent', 'Activity'].every((part) => savedStatusMessage.includes(part));
		if (isSavedDefaultMessage) {
			this.settings.statusMessage = '';
			await this.saveSettings();
		}
		await this.saveSettings();
		await this.startMcpRuntime();

		this.registerView(
			WIKI_WEAVER_SOURCE_STATUS_VIEW,
			(leaf) => new WikiWeaverSourceStatusView(leaf, this)
		);
		this.registerView(
			WIKI_WEAVER_ACTIVITY_VIEW,
			(leaf) => new WikiWeaverActivityView(leaf, this)
		);
		this.registerView(
			WIKI_WEAVER_REVIEW_QUEUE_VIEW,
			(leaf) => new WikiWeaverReviewQueueView(leaf, this)
		);
		this.registerView(
			WIKI_WEAVER_MEMORY_INSPECTOR_VIEW,
			(leaf) => new WikiWeaverMemoryInspectorView(leaf)
		);
		this.registerView(
			WIKI_WEAVER_AUDIT_LOG_VIEW,
			(leaf) => new WikiWeaverAuditLogView(leaf, this)
		);
		this.registerView(
			WIKI_WEAVER_RUNTIME_STATUS_VIEW,
			(leaf) => new WikiWeaverRuntimeStatusView(leaf, this)
		);
		this.registerView(
			WIKI_WEAVER_PERMISSION_POLICY_VIEW,
			(leaf) => new WikiWeaverPermissionPolicyView(leaf)
		);
		this.registerView(
			WIKI_WEAVER_AGENT_CONNECTIONS_VIEW,
			(leaf) => new WikiWeaverAgentConnectionsView(leaf, this)
		);

		this.addRibbonIcon('brain-circuit', ui(`打开${PLUGIN_DISPLAY_NAME_ZH}面板`, `Open ${PLUGIN_DISPLAY_NAME_EN} panel`), () => {
			this.openPluginView(WIKI_WEAVER_ACTIVITY_VIEW);
		});

		this.addCommand({
			id: 'open-agent-activity',
			name: ui('打开 AI 助手活动', 'Open AI assistant activity'),
			callback: () => this.openPluginView(WIKI_WEAVER_ACTIVITY_VIEW),
		});

		this.addCommand({
			id: 'open-review-queue',
			name: ui('打开审核队列', 'Open review queue'),
			callback: () => this.openPluginView(WIKI_WEAVER_REVIEW_QUEUE_VIEW),
		});

		this.addCommand({
			id: 'open-memory-inspector',
			name: ui('打开记忆查看', 'Open memory view'),
			callback: () => this.openPluginView(WIKI_WEAVER_MEMORY_INSPECTOR_VIEW),
		});

		this.addCommand({
			id: 'open-audit-log',
			name: ui('打开操作记录', 'Open activity log'),
			callback: () => this.openPluginView(WIKI_WEAVER_AUDIT_LOG_VIEW),
		});

		this.addCommand({
			id: 'open-runtime-status',
			name: ui('打开连接状态', 'Open connection status'),
			callback: () => this.openPluginView(WIKI_WEAVER_RUNTIME_STATUS_VIEW),
		});

		this.addCommand({
			id: 'open-permission-policy',
			name: ui('打开权限说明', 'Open permission guide'),
			callback: () => this.openPluginView(WIKI_WEAVER_PERMISSION_POLICY_VIEW),
		});

		this.addCommand({
			id: 'open-agent-connections',
			name: ui('打开 AI 助手连接', 'Open AI assistant connections'),
			callback: () => this.openPluginView(WIKI_WEAVER_AGENT_CONNECTIONS_VIEW),
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
				void this.openInitializeMemoryStructureModal();
			},
		});

		this.addSettingTab(new WikiWeaverSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		await this.stopMcpRuntime();
	}

	private normalizeSettings(raw: unknown): WikiWeaverSettings {
		const saved = raw && typeof raw === 'object' ? raw as Partial<WikiWeaverSettings> & Record<string, unknown> : {};
		const next: WikiWeaverSettings = Object.assign({}, DEFAULT_SETTINGS, saved);
		const legacyEndpoint = typeof saved.mcpHttpEndpoint === 'string' ? saved.mcpHttpEndpoint.trim() : '';
		if (legacyEndpoint && !LEGACY_DEFAULT_MCP_HTTP_ENDPOINTS.includes(legacyEndpoint)) {
			const legacyPort = this.portFromEndpoint(legacyEndpoint);
			if (legacyPort) {
				next.mcpPort = legacyPort;
			}
		}
		next.mcpPort = this.normalizePort(next.mcpPort);
		next.runtimeToken = typeof saved.runtimeToken === 'string' && saved.runtimeToken.trim()
			? saved.runtimeToken.trim()
			: this.generateRuntimeToken();
		return next;
	}

	private normalizePort(value: unknown): number {
		const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
		if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
			return DEFAULT_MCP_PORT;
		}
		return parsed;
	}

	private portFromEndpoint(endpoint: string): number | null {
		try {
			const parsed = new URL(endpoint);
			const port = Number.parseInt(parsed.port || String(DEFAULT_MCP_PORT), 10);
			return this.normalizePort(port);
		} catch (_error) {
			return null;
		}
	}

	private generateRuntimeToken(): string {
		return randomBytes(24).toString('hex');
	}

	async restartMcpRuntime(): Promise<void> {
		await this.stopMcpRuntime();
		await this.startMcpRuntime();
		await this.refreshGovernanceViews();
	}

	async regenerateRuntimeToken(): Promise<void> {
		this.settings.runtimeToken = this.generateRuntimeToken();
		await this.saveSettings();
		new Notice(ui('本地连接令牌已重新生成，请更新已配置的 AI 工具。', 'Local connection token regenerated. Update configured AI tools.'));
		await this.restartMcpRuntime();
	}

	private async startMcpRuntime(): Promise<void> {
		this.uiMcpSessionId = '';
		const vaultRoot = this.getVaultRoot();
		const runtime = new StreamableHttpMcpRuntime({
			host: DEFAULT_MCP_HOST,
			port: this.settings.mcpPort,
			path: DEFAULT_MCP_PATH,
			token: this.settings.runtimeToken,
			defaultVaultRoot: vaultRoot,
		});
		this.mcpRuntime = runtime;
		try {
			this.runtimeStatus = await runtime.start();
		} catch (error) {
			this.runtimeStatus = runtime.getStatus();
			const message = error instanceof Error ? error.message : 'Unknown MCP Runtime error.';
			console.error('wiki-weaver failed to start MCP Runtime', error);
			new Notice(ui(`MCP Runtime 启动失败：${message}`, `MCP Runtime failed to start: ${message}`));
		}
	}

	private async stopMcpRuntime(): Promise<void> {
		this.uiMcpSessionId = '';
		const runtime = this.mcpRuntime;
		this.mcpRuntime = null;
		if (runtime) {
			await runtime.stop();
		}
		this.runtimeStatus = {
			state: 'stopped',
			host: DEFAULT_MCP_HOST,
			port: this.settings.mcpPort,
			path: DEFAULT_MCP_PATH,
			endpoint: this.getMcpHttpEndpoint(),
			startedAt: '',
			activeSessions: 0,
			lastError: '',
		};
	}

	async openInitializeMemoryStructureModal(): Promise<void> {
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

	getStructureStatus(): WikiWeaverStructureStatus {
		const plan = this.buildInitializationPlan();
		const totalFolders = this.getNormalizedFolderPlan().length;
		const expectedFiles = new Set(CONTROL_FILES.map((file) => file.path));
		expectedFiles.add(CONTROL_PATHS.auditLog);
		const missingCount = plan.foldersToCreate.length + plan.filesToCreate.length;
		const totalCount = totalFolders + expectedFiles.size;
		const rootExists = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.root) !== null;
		const state: StructureState = missingCount === 0
			? 'initialized'
			: rootExists
				? 'partial'
				: 'missing';

		if (state === 'initialized') {
			return {
				state,
				label: ui('已初始化', 'Initialized'),
				detail: ui('Wiki Weaver 管理结构完整。', 'The Wiki Weaver management structure is complete.'),
				missingFolders: [],
				missingFiles: [],
				missingCount,
				totalCount,
			};
		}

		return {
			state,
			label: state === 'partial' ? ui('部分缺失', 'Partially missing') : ui('未初始化', 'Not initialized'),
			detail: ui(
				`缺少 ${missingCount} 个管理结构项，需要显式初始化后才能形成完整业务闭环。`,
				`${missingCount} management structure items are missing. Initialize explicitly to complete the workflow.`
			),
			missingFolders: plan.foldersToCreate,
			missingFiles: plan.filesToCreate,
			missingCount,
			totalCount,
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
			new Notice(ui('知识库结构已初始化。', 'Wiki Weaver memory structure initialized.'));
			await this.refreshGovernanceViews();
		} catch (error) {
			console.error('wiki-weaver failed to initialize memory structure', error);
			new Notice(ui('知识库结构初始化失败。', 'Wiki Weaver failed to initialize memory structure.'));
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
		const activityLeaves = this.app.workspace.getLeavesOfType(WIKI_WEAVER_ACTIVITY_VIEW);
		for (const leaf of activityLeaves) {
			const view = leaf.view;
			if (view instanceof WikiWeaverActivityView) {
				await view.refresh();
			}
		}
	}

	private async refreshReviewQueueViews(): Promise<void> {
		const reviewQueueLeaves = this.app.workspace.getLeavesOfType(WIKI_WEAVER_REVIEW_QUEUE_VIEW);
		for (const leaf of reviewQueueLeaves) {
			const view = leaf.view;
			if (view instanceof WikiWeaverReviewQueueView) {
				await view.refresh();
			}
		}
	}

	private async refreshSourceStatusViews(): Promise<void> {
		const sourceStatusLeaves = this.app.workspace.getLeavesOfType(WIKI_WEAVER_SOURCE_STATUS_VIEW);
		for (const leaf of sourceStatusLeaves) {
			const view = leaf.view;
			if (view instanceof WikiWeaverSourceStatusView) {
				await view.refresh();
			}
		}
	}

	private async refreshAgentConnectionViews(): Promise<void> {
		const connectionLeaves = this.app.workspace.getLeavesOfType(WIKI_WEAVER_AGENT_CONNECTIONS_VIEW);
		for (const leaf of connectionLeaves) {
			const view = leaf.view;
			if (view instanceof WikiWeaverAgentConnectionsView) {
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

		return {
			requests: await this.readRecentSourceRequests(MAX_SOURCE_STATUS_ROWS),
			missingRequestFolder: false,
			updatedAt: new Date().toISOString(),
		};
	}

	private async readRecentSourceRequests(limit: number): Promise<SourceRequestRecord[]> {
		const folder = this.app.vault.getAbstractFileByPath(SOURCE_REQUESTS_PATH);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const files = this.collectMarkdownFiles(folder);
		const records = await Promise.all(files.map((file) => this.readSourceRequestFile(file)));
		return records
			.filter((record): record is SourceRequestRecord => Boolean(record))
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp)
			.slice(0, limit);
	}

	private async readSourceRequestFile(file: TFile): Promise<SourceRequestRecord | null> {
		let content = '';
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`wiki-weaver failed to read source request: ${file.path}`, error);
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
		if (!source) {
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
			status: status || 'pending',
			taskId: this.firstString(data, ['task_id', 'taskId']),
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
			recentSourceRequests,
			recentProposals,
			recentAuditEvents,
		] = await Promise.all([
			this.readRecentAgentTasks(MAX_TASK_ROWS),
			this.readRecentContextPacks(MAX_ACTIVITY_CONTEXT_PACK_ROWS),
			this.readRecentSourceCaptures(MAX_ACTIVITY_SOURCE_CAPTURE_ROWS),
			this.readRecentSourceRequests(MAX_SOURCE_STATUS_ROWS),
			this.readRecentMemoryProposals(MAX_ACTIVITY_PROPOSAL_ROWS),
			this.readRecentAuditEvents(MAX_AUDIT_ROWS),
		]);
		const currentTask = this.pickCurrentTask(recentTasks);
		const structureStatus = this.getStructureStatus();
		const taskFolderMissing =
			this.app.vault.getAbstractFileByPath(AGENT_TASKS_PATH) === null;
		const auditLogMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;
		const auditDirMissing =
			this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir) === null;

		return {
			runtimeStatus: this.getRuntimeViewStatus(),
			structureStatus,
			currentTask,
			recentTasks,
			recentContextPacks,
			recentSourceCaptures,
			recentSourceRequests,
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
		const httpEndpoint = this.getMcpHttpEndpoint();
		const connectionUrl = this.getMcpConnectionUrl();
		const runtimeStatus = this.getRuntimeViewStatus();

		return {
			vaultRoot,
			httpEndpoint,
			connectionUrl,
			runtimeStatus,
			clientConfigs: this.buildClientConfigs(),
			recentAgents,
			recentToolCalls: toolCalls,
			missingAuditSources: auditLogMissing && auditDirMissing,
			updatedAt: new Date().toISOString(),
		};
	}

	private getVaultRoot(): string {
		const adapter = this.app.vault.adapter as unknown as { basePath?: string };
		return adapter.basePath || ui('当前知识库路径不可用', 'Current knowledge base path unavailable');
	}

	private buildClientConfigs(): GeneratedClientConfig[] {
		return this.getClientProfiles().map((profile) => {
			const status = this.readClientConfigStatus(profile);
			return {
				clientId: profile.id,
				displayName: profile.displayName,
				description: profile.description,
				transport: profile.preferredTransport,
				configText: this.buildClientConfigText(profile),
				supportsAutoConfigure: profile.supportsAutoConfigure,
				restartRequired: profile.restartRequired,
				configFormat: profile.configFormat,
				targetPath: profile.targetPath,
				configState: status.state,
				configStatusLabel: status.label,
				configStatusDetail: status.detail,
			};
		});
	}

	private readClientConfigStatus(profile: ClientProfile): { state: ClientConfigState; label: string; detail: string } {
		if (!profile.supportsAutoConfigure || !profile.targetPath) {
			return {
				state: 'not_configured',
				label: ui('未配置', 'Not configured'),
				detail: ui('需要复制配置到对应 AI 工具。', 'Copy this config into the AI tool.'),
			};
		}

		const api = this.getDesktopNodeApi();
		if (!api) {
			return {
				state: 'unavailable',
				label: ui('未配置', 'Not configured'),
				detail: ui('当前环境不支持自动读取配置文件。', 'This environment cannot read the config file automatically.'),
			};
		}

		if (!api.fs.existsSync(profile.targetPath)) {
			return {
				state: 'not_configured',
				label: ui('未配置', 'Not configured'),
				detail: ui('尚未写入 Wiki Weaver 连接。', 'The Wiki Weaver connection has not been written yet.'),
			};
		}

		try {
			const content = api.fs.readFileSync(profile.targetPath, 'utf8');
			return this.detectClientConfigStatus(profile, content);
		} catch (error) {
			console.error('wiki-weaver failed to read client config status', error);
			return {
				state: 'unavailable',
				label: ui('未配置', 'Not configured'),
				detail: ui('无法读取配置文件，请检查文件权限。', 'Cannot read the config file. Check file permissions.'),
			};
		}
	}

	private getClientProfiles(): ClientProfile[] {
		const desktopApi = this.getDesktopNodeApi();
		const homeDir = desktopApi?.os.homedir();
		return [
			{
				id: 'codex',
				displayName: 'Codex',
				description: ui('将下面内容加入 Codex 配置文件，然后重启 Codex。', 'Add this to your Codex config file, then restart Codex.'),
				preferredTransport: 'streamable-http',
				supportsAutoConfigure: Boolean(homeDir),
				restartRequired: true,
				configFormat: 'codex-toml',
				targetPath: homeDir ? desktopApi?.path.join(homeDir, '.codex', 'config.toml') : undefined,
			},
			{
				id: 'claude-code',
				displayName: 'Claude Code',
				description: ui('在终端执行下面命令，为 Claude Code 添加知识库连接。', 'Run this command in a terminal to add the Wiki Weaver connection to Claude Code.'),
				preferredTransport: 'streamable-http',
				supportsAutoConfigure: false,
				restartRequired: false,
				configFormat: 'command',
			},
			{
				id: 'claude-desktop',
				displayName: 'Claude Desktop',
				description: ui('将下面内容加入 Claude Desktop 连接配置，然后重启 Claude Desktop。', 'Add this to Claude Desktop connection settings, then restart Claude Desktop.'),
				preferredTransport: 'streamable-http',
				supportsAutoConfigure: Boolean(homeDir),
				restartRequired: true,
				configFormat: 'mcp-json',
				targetPath: homeDir ? desktopApi?.path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') : undefined,
			},
			{
				id: 'cursor',
				displayName: 'Cursor',
				description: ui('将下面内容加入 Cursor 的连接配置，然后重启 Cursor。', 'Add this to Cursor connection settings, then restart Cursor.'),
				preferredTransport: 'streamable-http',
				supportsAutoConfigure: false,
				restartRequired: true,
				configFormat: 'copy-only',
			},
			{
				id: 'custom',
				displayName: ui('自定义 MCP 工具', 'Custom MCP tool'),
				description: ui('当你的 AI 工具不在上方列表，但支持填写 MCP 地址时使用。', 'Use this when your AI tool is not listed above but supports an MCP URL.'),
				preferredTransport: 'streamable-http',
				supportsAutoConfigure: false,
				restartRequired: true,
				configFormat: 'copy-only',
			},
		];
	}

	private buildClientConfigText(profile: ClientProfile): string {
		const connectionUrl = this.getMcpConnectionUrl();
		if (profile.id === 'codex') {
			return [
				'[mcp_servers.wiki-weaver]',
				`url = ${JSON.stringify(connectionUrl)}`,
			].join('\n');
		}

		if (profile.id === 'claude-code') {
			return `claude mcp add --transport http wiki-weaver ${connectionUrl} --scope user`;
		}

		const config = {
			mcpServers: {
				'wiki-weaver': {
					url: connectionUrl,
				},
			},
			client: profile.id,
		};
		return JSON.stringify(config, null, 2);
	}

	private detectClientConfigStatus(profile: ClientProfile, content: string): { state: ClientConfigState; label: string; detail: string } {
		if (profile.configFormat === 'codex-toml') {
			const block = this.extractCodexTomlWikiWeaverBlock(content);
			if (block.length === 0) {
				return {
					state: 'not_configured',
					label: ui('未配置', 'Not configured'),
					detail: ui('配置文件中还没有 Wiki Weaver 连接。', 'The config file does not include the Wiki Weaver connection yet.'),
				};
			}
			const configuredUrl = this.readTomlStringValue(block.join('\n'), 'url');
			const configuredCommand = this.readTomlStringValue(block.join('\n'), 'command');
			if (configuredCommand) {
				return {
					state: 'needs_update',
					label: ui('需更新', 'Needs update'),
					detail: ui('检测到旧版命令启动配置，需要更新为本机 MCP 地址。', 'Old command startup config detected. Update it to the local MCP URL.'),
				};
			}
			if (!configuredUrl) {
				return {
					state: 'needs_update',
					label: ui('需更新', 'Needs update'),
					detail: ui('已存在 Wiki Weaver 配置，但缺少连接地址。', 'Wiki Weaver config exists but has no connection URL.'),
				};
			}
			if (configuredUrl !== this.getMcpConnectionUrl()) {
				return {
					state: 'needs_update',
					label: ui('需更新', 'Needs update'),
					detail: ui('已配置，但连接地址或本地令牌与当前设置不同。', 'Configured, but the URL or local token differs from the current setting.'),
				};
			}
			return {
				state: 'configured',
				label: ui('已配置', 'Configured'),
				detail: ui('连接配置已写入，保持 Obsidian 开启后即可使用。', 'Connection config is written. Keep Obsidian open to use it.'),
			};
		}

		if (profile.configFormat === 'mcp-json') {
			try {
				const parsed = this.parseMcpJsonConfig(content);
				const server = parsed.mcpServers['wiki-weaver'];
				if (!server || typeof server !== 'object' || Array.isArray(server)) {
					return {
						state: 'not_configured',
						label: ui('未配置', 'Not configured'),
						detail: ui('配置文件中还没有 Wiki Weaver 连接。', 'The config file does not include the Wiki Weaver connection yet.'),
					};
				}
				const url = (server as { url?: unknown }).url;
				const command = (server as { command?: unknown }).command;
				if (typeof command === 'string' && command.trim()) {
					return {
						state: 'needs_update',
						label: ui('需更新', 'Needs update'),
						detail: ui('检测到旧版命令启动配置，需要更新为本机 MCP 地址。', 'Old command startup config detected. Update it to the local MCP URL.'),
					};
				}
				if (typeof url !== 'string' || !url.trim()) {
					return {
						state: 'needs_update',
						label: ui('需更新', 'Needs update'),
						detail: ui('已存在 Wiki Weaver 配置，但缺少连接地址。', 'Wiki Weaver config exists but has no connection URL.'),
					};
				}
				if (url.trim() !== this.getMcpConnectionUrl()) {
					return {
						state: 'needs_update',
						label: ui('需更新', 'Needs update'),
						detail: ui('已配置，但连接地址或本地令牌与当前设置不同。', 'Configured, but the URL or local token differs from the current setting.'),
					};
				}
				return {
					state: 'configured',
					label: ui('已配置', 'Configured'),
					detail: ui('连接配置已写入，保持 Obsidian 开启后即可使用。', 'Connection config is written. Keep Obsidian open to use it.'),
				};
			} catch (error) {
				console.error('wiki-weaver failed to parse client config status', error);
				return {
					state: 'not_configured',
					label: ui('未配置', 'Not configured'),
					detail: ui('配置文件无法解析，可以自动配置覆盖 Wiki Weaver 连接。', 'The config file could not be parsed. Auto setup can rewrite the Wiki Weaver connection.'),
				};
			}
		}

		return {
			state: 'not_configured',
			label: ui('未配置', 'Not configured'),
			detail: ui('需要复制配置到对应 AI 工具。', 'Copy this config into the AI tool.'),
		};
	}

	private extractCodexTomlWikiWeaverBlock(content: string): string[] {
		const lines = content.split(/\r?\n/);
		const block: string[] = [];
		let collecting = false;
		for (const line of lines) {
			if (this.isWikiWeaverCodexTomlHeader(line)) {
				collecting = true;
				block.push(line);
				continue;
			}
			if (collecting && this.isTomlHeader(line)) {
				break;
			}
			if (collecting) {
				block.push(line);
			}
		}
		return block;
	}

	private readTomlStringValue(content: string, key: string): string | null {
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const match = content.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*(.+?)\\s*$`, 'm'));
		if (!match) {
			return null;
		}
		const rawValue = match[1].trim();
		if (rawValue.startsWith('"')) {
			try {
				return JSON.parse(rawValue) as string;
			} catch (_error) {
				return rawValue.replace(/^"|"$/g, '');
			}
		}
		return rawValue.replace(/^['"]|['"]$/g, '');
	}

	getMcpHttpEndpoint(): string {
		return `http://${DEFAULT_MCP_HOST}:${this.settings.mcpPort || DEFAULT_MCP_PORT}${DEFAULT_MCP_PATH}`;
	}

	getMcpConnectionUrl(): string {
		const token = this.settings.runtimeToken || '';
		const endpoint = this.getMcpHttpEndpoint();
		return token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint;
	}

	getRuntimeViewStatus(): RuntimeViewStatus {
		const status = this.mcpRuntime?.getStatus() || this.runtimeStatus;
		const label = this.runtimeStateLabel(status.state);
		return {
			state: status.state,
			label,
			detail: this.runtimeStateDetail(status),
			endpoint: this.getMcpHttpEndpoint(),
			host: DEFAULT_MCP_HOST,
			port: this.settings.mcpPort || DEFAULT_MCP_PORT,
			startedAt: status.startedAt,
			activeSessions: status.activeSessions,
			lastError: status.lastError,
		};
	}

	private runtimeStateLabel(state: RuntimeState): string {
		switch (state) {
			case 'running':
				return ui('运行中', 'Running');
			case 'starting':
				return ui('启动中', 'Starting');
			case 'port_conflict':
				return ui('端口被占用', 'Port in use');
			case 'failed':
				return ui('启动失败', 'Failed');
			case 'stopped':
			default:
				return ui('未运行', 'Not running');
		}
	}

	private runtimeStateDetail(status: StreamableHttpRuntimeStatus): string {
		switch (status.state) {
			case 'running':
				return ui('Obsidian 已托管本机 MCP Runtime，AI 工具可在 Obsidian 开启时连接。', 'Obsidian is hosting the local MCP Runtime. AI tools can connect while Obsidian is open.');
			case 'starting':
				return ui('MCP Runtime 正在启动。', 'The MCP Runtime is starting.');
			case 'port_conflict':
				return ui(`端口 ${this.settings.mcpPort} 已被占用，请修改端口或关闭占用程序。`, `Port ${this.settings.mcpPort} is already in use. Change the port or close the process using it.`);
			case 'failed':
				return status.lastError
					? ui(`MCP Runtime 启动失败：${status.lastError}`, `MCP Runtime failed to start: ${status.lastError}`)
					: ui('MCP Runtime 启动失败，请检查 Obsidian 控制台。', 'MCP Runtime failed to start. Check the Obsidian console.');
			case 'stopped':
			default:
				return ui('MCP Runtime 未运行。插件启用且 Obsidian 打开后会自动启动。', 'The MCP Runtime is not running. It starts automatically when the plugin is enabled and Obsidian is open.');
		}
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	private async ensureUiMcpSession(): Promise<void> {
		if (this.uiMcpSessionId) {
			return;
		}
		const result = await this.postLocalMcp('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: {
				name: 'wiki-weaver-plugin-ui',
				version: '0.1.0',
			},
		}, false);
		if (!this.isRecord(result)) {
			throw new Error('MCP initialize returned an invalid response.');
		}
	}

	private async postLocalMcp(method: string, params: Record<string, unknown>, includeSession = true): Promise<unknown> {
		const headers: Record<string, string> = {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
		};
		if (includeSession) {
			headers['mcp-session-id'] = this.uiMcpSessionId;
		}
		const response = await fetch(this.getMcpConnectionUrl(), {
			method: 'POST',
			headers,
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: this.uiMcpRequestId++,
				method,
				params,
			}),
		});
		const payload = await response.json().catch(() => null);
		if (method === 'initialize') {
			this.uiMcpSessionId = response.headers.get('mcp-session-id') || '';
		}
		const errorMessage = this.isRecord(payload) && this.isRecord(payload.error)
			? String(payload.error.message || '')
			: '';
		if (!response.ok) {
			throw new Error(errorMessage || `MCP request failed with HTTP ${response.status}.`);
		}
		if (errorMessage) {
			throw new Error(errorMessage);
		}
		if (!this.isRecord(payload)) {
			throw new Error('MCP request returned an invalid JSON-RPC response.');
		}
		return payload.result;
	}

	async callLocalMcpTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				await this.ensureUiMcpSession();
				const result = await this.postLocalMcp('tools/call', {
					name,
					arguments: args,
				});
				const structured = this.isRecord(result) && this.isRecord(result.structuredContent)
					? result.structuredContent
					: result;
				if (this.isRecord(result) && result.isError) {
					const message = this.isRecord(structured) ? String(structured.error || '') : '';
					throw new Error(message || `${name} failed.`);
				}
				if (!this.isRecord(structured)) {
					throw new Error(`${name} returned an invalid result.`);
				}
				if (structured.ok === false) {
					throw new Error(String(structured.error || `${name} failed.`));
				}
				return structured;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (attempt === 0 && /session|Mcp-Session-Id/i.test(message)) {
					this.uiMcpSessionId = '';
					continue;
				}
				throw error;
			}
		}
		throw new Error(`${name} failed.`);
	}

	async processSourceRequest(request: SourceRequestRecord): Promise<void> {
		const args: Record<string, unknown> = { request_path: request.path };
		if (request.taskId) {
			args.task_id = request.taskId;
		}
		await this.callLocalMcpTool('wiki_weaver.analyze_source_request', args);
		await this.refreshGovernanceViews();
	}

	async previewApprovedWriteback(proposal: MemoryProposalRecord): Promise<ApprovedWritebackPreview> {
		const args: Record<string, unknown> = {
			proposal_path: proposal.path,
			dry_run: true,
		};
		if (proposal.taskId) {
			args.task_id = proposal.taskId;
		}
		const result = await this.callLocalMcpTool('wiki_weaver.apply_approved_writeback', args);
		return result as unknown as ApprovedWritebackPreview;
	}

	async applyApprovedWriteback(proposal: MemoryProposalRecord): Promise<void> {
		const args: Record<string, unknown> = { proposal_path: proposal.path };
		if (proposal.taskId) {
			args.task_id = proposal.taskId;
		}
		await this.callLocalMcpTool('wiki_weaver.apply_approved_writeback', args);
		await this.refreshGovernanceViews();
	}

	async applyClientConfig(config: GeneratedClientConfig): Promise<void> {
		try {
			const result = this.writeClientConfig(config);
			this.queueClientConfigAuditEvent('client_config_applied', config, 'success', result.backupPath);
			new Notice(ui('已写入知识库连接配置，请重启对应 AI 工具。', 'Wiki Weaver connection config written. Restart the AI tool.'));
			this.queueAgentConnectionViewRefresh();
		} catch (error) {
			console.error('wiki-weaver failed to apply client config', error);
			this.queueClientConfigAuditEvent('client_config_failed', config, 'failed');
			new Notice(ui('写入连接配置失败。', 'Failed to write connection config.'));
			throw error;
		}
	}

	async removeClientConfig(config: GeneratedClientConfig): Promise<void> {
		try {
			const result = this.deleteClientConfig(config);
			this.queueClientConfigAuditEvent('client_config_removed', config, 'success', result.backupPath);
			new Notice(ui('已移除配置，请重启对应 AI 工具。', 'Config removed. Restart the AI tool.'));
			this.queueAgentConnectionViewRefresh();
		} catch (error) {
			console.error('wiki-weaver failed to remove client config', error);
			this.queueClientConfigAuditEvent('client_config_failed', config, 'failed');
			new Notice(ui('移除配置失败。', 'Failed to remove config.'));
			throw error;
		}
	}

	async openClientConfigFile(config: GeneratedClientConfig): Promise<void> {
		const api = this.getDesktopNodeApi();
		if (!api?.shell || !config.targetPath) {
			new Notice(ui('当前环境无法打开配置文件。', 'Cannot open the config file in this environment.'));
			return;
		}
		if (!api.fs.existsSync(config.targetPath)) {
			new Notice(ui('配置文件尚未创建，请先完成自动配置。', 'The config file does not exist yet. Run auto setup first.'));
			return;
		}
		const result = await api.shell.openPath(config.targetPath);
		if (result) {
			new Notice(ui('打开配置文件失败。', 'Failed to open config file.'));
			return;
		}
		new Notice(ui('已打开配置文件。', 'Config file opened.'));
	}

	private writeClientConfig(config: GeneratedClientConfig): { backupPath: string } {
		const { api, targetPath } = this.requireAutoConfigApi(config);
		const original = api.fs.existsSync(targetPath) ? api.fs.readFileSync(targetPath, 'utf8') : '';
		const nextContent = this.mergeClientConfigContent(config, original);
		return this.writeConfigFile(api, targetPath, original, nextContent);
	}

	private deleteClientConfig(config: GeneratedClientConfig): { backupPath: string } {
		const { api, targetPath } = this.requireAutoConfigApi(config);
		const original = api.fs.existsSync(targetPath) ? api.fs.readFileSync(targetPath, 'utf8') : '';
		const nextContent = this.removeClientConfigContent(config, original);
		return this.writeConfigFile(api, targetPath, original, nextContent);
	}

	private requireAutoConfigApi(config: GeneratedClientConfig): { api: DesktopNodeApi; targetPath: string } {
		const api = this.getDesktopNodeApi();
		if (!api || !config.targetPath || !config.supportsAutoConfigure) {
			throw new Error(`Client auto-configuration is not supported for ${config.clientId}.`);
		}
		return { api, targetPath: config.targetPath };
	}

	private writeConfigFile(api: DesktopNodeApi, targetPath: string, original: string, nextContent: string): { backupPath: string } {
		const directory = api.path.dirname(targetPath);
		api.fs.mkdirSync(directory, { recursive: true });
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = `${targetPath}.wiki-weaver-backup-${stamp}`;
		const tmpPath = `${targetPath}.wiki-weaver-tmp-${stamp}`;
		api.fs.writeFileSync(backupPath, original, 'utf8');
		api.fs.writeFileSync(tmpPath, nextContent, 'utf8');
		api.fs.renameSync(tmpPath, targetPath);
		return { backupPath };
	}

	private mergeClientConfigContent(config: GeneratedClientConfig, original: string): string {
		if (config.configFormat === 'codex-toml') {
			return this.trimLeadingWhitespace(`${this.trimTrailingWhitespace(this.removeCodexTomlWikiWeaverBlock(original))}\n\n${config.configText}\n`);
		}
		if (config.configFormat === 'mcp-json') {
			const parsed = this.parseMcpJsonConfig(original);
			parsed.mcpServers['wiki-weaver'] = {
				url: this.getMcpConnectionUrl(),
			};
			return `${JSON.stringify(parsed, null, 2)}\n`;
		}
		throw new Error(`Unsupported config format: ${config.configFormat}`);
	}

	private removeClientConfigContent(config: GeneratedClientConfig, original: string): string {
		if (config.configFormat === 'codex-toml') {
			return `${this.trimTrailingWhitespace(this.removeCodexTomlWikiWeaverBlock(original))}\n`;
		}
		if (config.configFormat === 'mcp-json') {
			const parsed = this.parseMcpJsonConfig(original);
			delete parsed.mcpServers['wiki-weaver'];
			return `${JSON.stringify(parsed, null, 2)}\n`;
		}
		throw new Error(`Unsupported config format: ${config.configFormat}`);
	}

	private trimTrailingWhitespace(value: string): string {
		return value.replace(/\s+$/, '');
	}

	private trimLeadingWhitespace(value: string): string {
		return value.replace(/^\s+/, '');
	}

	private parseMcpJsonConfig(content: string): { mcpServers: Record<string, unknown>; [key: string]: unknown } {
		const trimmed = content.trim();
		const parsed = trimmed ? JSON.parse(trimmed) : {};
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Client config must be a JSON object.');
		}
		const result = parsed as { mcpServers?: unknown; [key: string]: unknown };
		if (!result.mcpServers || typeof result.mcpServers !== 'object' || Array.isArray(result.mcpServers)) {
			result.mcpServers = {};
		}
		return result as { mcpServers: Record<string, unknown>; [key: string]: unknown };
	}

	private removeCodexTomlWikiWeaverBlock(content: string): string {
		const lines = content.split(/\r?\n/);
		const nextLines: string[] = [];
		let skipping = false;
		for (const line of lines) {
			if (this.isWikiWeaverCodexTomlHeader(line)) {
				skipping = true;
				continue;
			}
			if (skipping && this.isTomlHeader(line)) {
				skipping = false;
			}
			if (!skipping) {
				nextLines.push(line);
			}
		}
		return nextLines.join('\n');
	}

	private isWikiWeaverCodexTomlHeader(line: string): boolean {
		return /^\s*\[mcp_servers\.(?:"wiki-weaver"|'wiki-weaver'|wiki-weaver)\]\s*$/.test(line);
	}

	private isTomlHeader(line: string): boolean {
		return /^\s*\[[^\]]+\]\s*$/.test(line);
	}

	private async appendClientConfigAuditEvent(
		action: string,
		config: GeneratedClientConfig,
		result: string,
		backupPath?: string
	): Promise<void> {
		const now = new Date().toISOString();
		const event = (
			`## ${now}\n` +
			`action: ${action}\n` +
			'actor: user\n' +
			`client: ${config.clientId}\n` +
			`transport: ${config.transport}\n` +
			`target: ${config.targetPath || ''}\n` +
			`backup_path: ${backupPath || ''}\n` +
			`result: ${result}\n` +
			`timestamp: ${now}\n\n`
		);
		await this.appendToAuditLog(event);
	}

	private queueClientConfigAuditEvent(
		action: string,
		config: GeneratedClientConfig,
		result: string,
		backupPath?: string
	): void {
		void this.appendClientConfigAuditEvent(action, config, result, backupPath).catch((error) => {
			console.error('wiki-weaver failed to record client config audit event', error);
		});
	}

	private queueAgentConnectionViewRefresh(): void {
		void this.refreshAgentConnectionViews().catch((error) => {
			console.error('wiki-weaver failed to refresh agent connection views', error);
		});
	}

	private getDesktopNodeApi(): DesktopNodeApi | null {
		if (!Platform.isDesktopApp) {
			return null;
		}
		const maybeWindow = window as unknown as { require?: (moduleName: string) => unknown };
		if (!maybeWindow.require) {
			return null;
		}
		const fs = maybeWindow.require('fs') as DesktopNodeApi['fs'];
		const path = maybeWindow.require('path') as DesktopNodeApi['path'];
		const os = maybeWindow.require('os') as DesktopNodeApi['os'];
		const electron = maybeWindow.require('electron') as { shell?: DesktopNodeApi['shell'] };
		return {
			fs,
			path,
			os,
			shell: electron.shell,
		};
	}

	private isToolCallAuditEvent(event: AuditEventRecord): boolean {
		return event.eventType === 'tool-call'
			|| event.eventType === 'agent-tool-call'
			|| (Boolean(event.toolName) && !this.isConnectionAuditEvent(event));
	}

	private isConnectionAuditEvent(event: AuditEventRecord): boolean {
		return event.eventType === 'connection' || event.eventType === 'agent-connection-event' || event.action === 'connection' || event.action === 'mcp.initialize';
	}

	private normalizeAuditToolName(eventType: string, action: string, toolName: string): string {
		const normalizedTool = toolName.trim();
		const isConnection =
			eventType === 'connection' ||
			eventType === 'agent-connection-event' ||
			action === 'connection' ||
			action === 'mcp.initialize';
		if (isConnection && normalizedTool.toLowerCase() === 'unknown') {
			return '';
		}
		return normalizedTool;
	}

	private toAgentToolCallRecord(event: AuditEventRecord): AgentToolCallRecord {
		return {
			agentId: event.agentId || 'unknown',
			sessionId: event.sessionId || event.agentId || 'unknown',
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
		const upsertAgent = (agentId: string, sessionId: string, clientName: string, timestamp: string, sortTimestamp: number) => {
			const key = `${clientName || 'unknown'}::${sessionId || agentId || 'unknown'}`;
			const existing = agents.get(key);
			if (existing && existing.sortTimestamp >= sortTimestamp) {
				return existing;
			}
			const next = existing || {
				agentId: agentId || 'unknown',
				sessionId: sessionId || agentId || 'unknown',
				clientName: clientName || 'unknown',
				transport: 'streamable-http',
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
			const agent = upsertAgent(event.agentId, event.sessionId, event.clientName, event.timestamp, event.sortTimestamp);
			agent.transport = event.transport || agent.transport;
			agent.runtimeVersion = event.runtimeVersion || agent.runtimeVersion;
			agent.status = event.resultStatus || 'connected';
		}

		for (const call of toolCalls) {
			const agent = upsertAgent(call.agentId, call.sessionId, call.clientName, call.timestamp, call.sortTimestamp);
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
			console.error(`wiki-weaver failed to read memory proposal: ${file.path}`, error);
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
			console.error(`wiki-weaver failed to read context pack: ${file.path}`, error);
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
			console.error(`wiki-weaver failed to read source capture: ${file.path}`, error);
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
			console.error(`wiki-weaver failed to read agent task: ${file.path}`, error);
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
			console.error('wiki-weaver failed to read audit log', error);
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
			console.error(`wiki-weaver failed to read audit file: ${file.path}`, error);
			return [];
		}

		const parsed = this.readFrontmatter(content);
		const data = parsed.fields;
		const timestamp = this.firstString(data, ['timestamp']) || this.timestampFromFilename(file.basename);
		const fallbackTs =
			this.parseTimestamp(timestamp, file.stat?.mtime || Date.now()) || file.stat?.mtime || Date.now();

		if (Object.keys(data).length > 0) {
			const eventType = this.firstString(data, ['type']);
			const action = this.firstString(data, ['action']) || 'unknown';
			const toolName = this.normalizeAuditToolName(
				eventType,
				action,
				this.firstString(data, ['tool_name', 'toolName', 'tool'])
			);
			return [
				{
					path: file.path,
					auditId: this.firstString(data, ['audit_id', 'auditId', 'id']),
					actor: this.firstString(data, ['actor']) || 'unknown',
					action,
					target: this.firstString(data, ['target']) || '',
					reason: this.firstString(data, ['reason']) || '',
					taskId: this.firstString(data, ['task_id', 'taskId']),
					timestamp: timestamp || '',
					sortTimestamp: fallbackTs,
					snippet: this.snippetFromText(parsed.body, this.trimText(file.basename)),
					eventType,
					agentId: this.firstString(data, ['agent_id', 'agentId', 'session_id', 'sessionId']),
					sessionId: this.firstString(data, ['session_id', 'sessionId']),
					clientName: this.firstString(data, ['client_name', 'clientName', 'client']),
					toolName,
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
			const eventType = this.firstString(row, ['type']);
			const action = this.firstString(row, ['action']) || 'unknown';
			const toolName = this.normalizeAuditToolName(
				eventType,
				action,
				this.firstString(row, ['tool_name', 'toolName', 'tool'])
			);
			events.push({
				path: sourcePath,
				auditId: this.firstString(row, ['audit_id', 'auditId', 'id']),
				actor: this.firstString(row, ['actor']) || 'unknown',
				action,
				target: this.firstString(row, ['target']) || '',
				reason: this.firstString(row, ['reason']) || '',
				taskId: this.firstString(row, ['task_id', 'taskId']),
				timestamp: fallbackTimestamp,
				sortTimestamp: this.parseTimestamp(
					fallbackTimestamp,
					Date.now()
				),
				snippet: this.snippetFromText(bodyLines.join('\n')),
				eventType,
				agentId: this.firstString(row, ['agent_id', 'agentId', 'session_id', 'sessionId']),
				sessionId: this.firstString(row, ['session_id', 'sessionId']),
				clientName: this.firstString(row, ['client_name', 'clientName', 'client']),
				toolName,
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
		const date = new Date(value);
		if (!Number.isFinite(value) || Number.isNaN(date.getTime())) {
			return ui('未知时间', 'Unknown time');
		}
		const pad = (input: number) => String(input).padStart(2, '0');
		return [
			`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
			`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
		].join(' ');
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

	formatToolDisplayName(toolName: string): string {
		const normalized = toolName.replace(/^wiki_weaver[._]/, '').trim();
		const labels: Record<string, string> = {
			status: ui('查看状态', 'Check status'),
			start_task: ui('开始任务记录', 'Start task record'),
			recall: ui('查找相关笔记', 'Find related notes'),
			read_note: ui('读取笔记', 'Read note'),
			list_review_queue: ui('查看待审核内容', 'Review pending items'),
			list_source_requests: ui('查看资料请求', 'Review material requests'),
			list_approved_writebacks: ui('查看已批准写回', 'Review approved writebacks'),
			audit_recent: ui('查看最近记录', 'Review recent activity'),
			build_context_pack: ui('整理上下文材料', 'Prepare context material'),
			lint: ui('检查笔记结构', 'Check note structure'),
			finish_task: ui('记录任务结果', 'Record task results'),
			distill_session: ui('沉淀会话摘要', 'Summarize a session'),
			capture_source: ui('保存来源资料', 'Save source material'),
			propose_memory: ui('提出记忆更新', 'Propose memory updates'),
			analyze_source_request: ui('处理资料请求', 'Process material request'),
			apply_approved_writeback: ui('应用已批准写回', 'Apply approved writeback'),
		};
		return labels[normalized] || normalized.replace(/_/g, ' ') || ui('未知操作', 'Unknown action');
	}

	formatAgentDisplayName(clientName: string, agentId = ''): string {
		const raw = (clientName || agentId || '').trim();
		const normalized = raw.toLowerCase();
		if (!normalized) {
			return ui('AI 工具', 'AI tool');
		}
		if (normalized.includes('codex')) {
			return 'Codex';
		}
		if (normalized.includes('claude')) {
			return 'Claude';
		}
		if (normalized.includes('cursor')) {
			return 'Cursor';
		}
		if (normalized.includes('wiki-weaver')) {
			return 'Wiki Weaver';
		}
		if (raw.length <= 28) {
			return raw;
		}
		return this.trimText(raw, 28);
	}

	formatResultLabel(status: string): string {
		switch (status) {
			case 'success':
			case 'written':
			case 'applied':
				return ui('成功', 'Succeeded');
			case 'failed':
			case 'error':
				return ui('失败', 'Failed');
			case 'skipped':
				return ui('已跳过', 'Skipped');
			case 'connected':
			case 'active':
				return ui('已连接', 'Connected');
			case 'warning':
				return ui('需检查', 'Needs attention');
			default:
				return status ? this.trimText(status, 40) : ui('未知', 'Unknown');
		}
	}

	formatRiskLabel(riskLevel: string): string {
		switch (riskLevel) {
			case 'read-only':
				return ui('只读', 'Read-only');
			case 'low-risk write':
				return ui('保存工作记录', 'Saves work records');
			case 'review-gated apply':
				return ui('先审核再写入', 'Review before writing');
			default:
				return riskLevel ? this.trimText(riskLevel, 40) : ui('未标记', 'Unmarked');
		}
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
				'将为当前知识库创建以下缺失的文件结构。',
				'The following Wiki Weaver structure will be created if missing in this vault.'
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

class WikiWeaverSourceStatusView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WikiWeaverPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_SOURCE_STATUS_VIEW;
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
		contentEl.addClass('wiki-weaver-view-root');

		contentEl.createEl('h2', { text: ui('来源状态', 'Source status'), cls: 'wiki-weaver-view__title' });

		const header = contentEl.createDiv({ cls: 'wiki-weaver-view__section' });
		header.createEl('div', {
			text: `${ui('最后刷新', 'Last refreshed')}: ${this.plugin.formatDisplayTime(
				Date.parse(snapshot.updatedAt)
			)}`,
			cls: 'wiki-weaver-view__description',
		});
		const actions = header.createDiv();
		const refreshButton = actions.createEl('button', {
			text: ui('刷新', 'Refresh'),
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			refreshButton.disabled = true;
			refreshButton.setText(ui('刷新中...', 'Refreshing...'));
			try {
				await this.refresh();
				new Notice(ui('来源状态已刷新。', 'Source status refreshed.'));
			} catch (error) {
				console.error('wiki-weaver failed to refresh source status view', error);
				refreshButton.disabled = false;
				refreshButton.setText(ui('刷新', 'Refresh'));
				new Notice(ui('刷新来源状态失败。', 'Failed to refresh source status.'));
			}
		});

		if (snapshot.missingRequestFolder) {
			contentEl.createEl('p', {
				text: ui(
					'还没有来源请求记录。初始化知识库后，AI 助手提交的资料处理请求会显示在这里。',
					'No source request records yet. After Wiki Weaver is initialized, material processing requests from your AI assistant will appear here.'
				),
				cls: 'wiki-weaver-view__description',
			});
			return;
		}

		if (snapshot.requests.length === 0) {
			contentEl.createEl('p', {
				text: ui(
					'当前没有资料请求。',
					'No material requests yet.'
				),
				cls: 'wiki-weaver-view__description',
			});
			return;
		}

		const list = contentEl.createEl('ul', { cls: 'wiki-weaver-view__list' });
		for (const request of snapshot.requests) {
			const item = list.createEl('li', { cls: 'wiki-weaver-view__item' });
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
			if (this.isPendingRequest(request.status)) {
				const actionRow = item.createDiv({ cls: 'wiki-weaver-action-row' });
				const processButton = actionRow.createEl('button', {
					text: ui('处理资料请求', 'Process request'),
					cls: 'mod-cta',
				});
				processButton.addEventListener('click', async () => {
					processButton.disabled = true;
					processButton.setText(ui('处理中...', 'Processing...'));
					try {
						await this.plugin.processSourceRequest(request);
						new Notice(ui('资料请求已处理。', 'Source request processed.'));
						await this.refresh();
					} catch (error) {
						console.error('wiki-weaver failed to process source request', error);
						new Notice(ui('处理资料请求失败。', 'Failed to process source request.'));
					} finally {
						processButton.disabled = false;
						processButton.setText(ui('处理资料请求', 'Process request'));
					}
				});
			}
		}
	}

	private isPendingRequest(status: string): boolean {
		const normalized = status.toLowerCase().trim();
		return !normalized || normalized === 'pending' || normalized === 'queued' || normalized === 'todo';
	}

	async refresh(): Promise<void> {
		const snapshot = await this.plugin.loadSourceStatusSnapshot();
		await this.render(snapshot);
	}
}

class WikiWeaverActivityView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WikiWeaverPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_ACTIVITY_VIEW;
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
		contentEl.addClass('wiki-weaver-view-root');

		const header = contentEl.createDiv({ cls: 'wiki-weaver-shell-header' });
		const heading = header.createDiv();
		heading.createEl('h2', { text: ui('AI 助手活动', 'AI assistant activity'), cls: 'wiki-weaver-view__title' });
		heading.createEl('p', {
			text: this.plugin.settings.showWelcomeMessage
				? this.plugin.getStatusMessage()
				: ui(
					'欢迎信息已关闭。活动数据以只读模式显示。',
					'Welcome message is disabled. Activity data is shown in read-only mode.'
				),
			cls: 'wiki-weaver-view__description',
		});
		const actions = header.createDiv({ cls: 'wiki-weaver-action-row' });
		const refreshButton = actions.createEl('button', {
			text: ui('刷新', 'Refresh'),
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			refreshButton.disabled = true;
			refreshButton.setText(ui('刷新中...', 'Refreshing...'));
			try {
				await this.refresh();
				new Notice(ui('活动记录已刷新。', 'Activity refreshed.'));
			} catch (error) {
				console.error('wiki-weaver failed to refresh activity view', error);
				refreshButton.disabled = false;
				refreshButton.setText(ui('刷新', 'Refresh'));
				new Notice(ui('刷新活动记录失败。', 'Failed to refresh activity.'));
			}
		});
		if (snapshot.structureStatus.state !== 'initialized') {
			const initializeButton = actions.createEl('button', {
				text: ui('初始化知识库结构', 'Initialize structure'),
			});
			initializeButton.addEventListener('click', () => {
				void this.plugin.openInitializeMemoryStructureModal();
			});
		}
		const reviewButton = actions.createEl('button', {
			text: ui('打开审核列表', 'Open review list'),
		});
		reviewButton.addEventListener('click', () => {
			void this.plugin.openPluginView(WIKI_WEAVER_REVIEW_QUEUE_VIEW);
		});
		const connectionsButton = actions.createEl('button', {
			text: ui('打开 AI 助手连接', 'Open AI assistant connections'),
		});
		connectionsButton.addEventListener('click', () => {
			void this.plugin.openPluginView(WIKI_WEAVER_AGENT_CONNECTIONS_VIEW);
		});

		const statusBar = contentEl.createDiv({ cls: 'wiki-weaver-status-bar' });
		this.renderStatusItem(statusBar, 'MCP Runtime', snapshot.runtimeStatus.label);
		this.renderStatusItem(statusBar, ui('记录', 'Records'), snapshot.structureStatus.state === 'initialized' ? ui('可读取', 'Readable') : snapshot.structureStatus.label);
		this.renderStatusItem(statusBar, ui('知识库', 'Knowledge base'), snapshot.structureStatus.label);
		this.renderStatusItem(statusBar, ui('权限', 'Permission'), ui('先审核再写入', 'Review before writing'));
		this.renderStatusItem(statusBar, ui('刷新', 'Refresh'), this.plugin.formatDisplayTime(Date.parse(snapshot.updatedAt)));

		const metrics = contentEl.createDiv({ cls: 'wiki-weaver-metric-grid' });
		this.renderMetricCard(metrics, ui('当前任务', 'Active task'), snapshot.currentTask ? snapshot.currentTask.status : ui('无', 'None'), snapshot.currentTask?.taskId || ui('等待 AI 助手开始记录任务', 'Waiting for the AI assistant to start a task'));
		this.renderMetricCard(metrics, ui('待审核', 'Pending review'), String(snapshot.recentProposals.filter((proposal) => proposal.approvalStatus === 'pending').length), ui('需要你确认的记忆更新', 'Memory updates waiting for your review'));
		this.renderMetricCard(metrics, ui('来源请求', 'Source requests'), String(snapshot.recentSourceRequests.filter((request) => this.isSourceRequestPending(request.status)).length), ui('待处理资料请求', 'Pending material requests'));
		this.renderMetricCard(metrics, ui('工具使用', 'Tool usage'), String(snapshot.recentAuditEvents.filter((event) => event.toolName).length), ui('最近连接操作记录', 'Recent connection activity'));

		if (snapshot.structureStatus.state !== 'initialized') {
			const structurePanel = contentEl.createDiv({ cls: 'wiki-weaver-card' });
			structurePanel.createEl('h3', { text: ui('知识库结构', 'Wiki Weaver structure') });
			structurePanel.createEl('p', { text: snapshot.structureStatus.detail, cls: 'wiki-weaver-view__description' });
			if (snapshot.structureStatus.missingCount > 0) {
				structurePanel.createEl('small', {
					text: ui(
						`缺少文件夹 ${snapshot.structureStatus.missingFolders.length} 个，文件 ${snapshot.structureStatus.missingFiles.length} 个。`,
						`Missing ${snapshot.structureStatus.missingFolders.length} folders and ${snapshot.structureStatus.missingFiles.length} files.`
					),
				});
			}
		}

		const currentSection = contentEl.createDiv({ cls: 'wiki-weaver-card' });
		currentSection.createEl('h3', { text: ui('当前任务', 'Current task') });
		if (!snapshot.currentTask) {
			this.renderEmptyState(
				currentSection,
				snapshot.structureStatus.state !== 'initialized'
					? ui('还没有任务记录。', 'No task records yet.')
					: ui('还没有 AI 助手活动。', 'No AI assistant activity yet.'),
				snapshot.structureStatus.state !== 'initialized'
					? ui('请先初始化知识库文件结构，之后 AI 助手的任务记录会显示在这里。', 'Initialize the Wiki Weaver file structure first; task records will appear here afterward.')
					: ui('从 AI 助手开始一次任务后，这里会显示目标、来源和最近动作。', 'Start a task from your AI assistant to show goals, sources, and recent actions here.')
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
			...snapshot.recentSourceRequests.map((request) => ({
				time: request.sortTimestamp,
				type: ui('来源请求', 'Source request'),
				title: request.sourceKind,
				meta: request.status,
				body: request.source || request.summary,
				path: request.path,
			})),
			...snapshot.recentProposals.map((proposal) => ({
				time: proposal.sortTimestamp,
				type: ui('提案', 'Proposal'),
				title: proposal.proposalId,
				meta: `${memoryProposalStatusLabel(proposal.approvalStatus)} • ${proposal.proposalKind}`,
				body: proposal.snippet,
				path: proposal.path,
			})),
			...snapshot.recentAuditEvents.map((event) => {
				const isConnection =
					event.eventType === 'connection' ||
					event.eventType === 'agent-connection-event' ||
					event.action === 'connection' ||
					event.action === 'mcp.initialize';
				const agentLabel = this.plugin.formatAgentDisplayName(event.clientName, event.agentId);
				return {
					time: event.sortTimestamp,
					type: event.toolName
						? ui(`${agentLabel} 操作`, `${agentLabel} action`)
						: isConnection
							? ui(`${agentLabel} 连接`, `${agentLabel} connection`)
							: ui('记录', 'Record'),
					title: event.toolName
						? this.plugin.formatToolDisplayName(event.toolName)
						: isConnection
							? ui('建立连接', 'Connected')
							: event.action,
					meta: event.resultStatus ? this.plugin.formatResultLabel(event.resultStatus) : event.actor,
					body: event.reason || event.snippet,
					path: event.target || event.path,
				};
			}),
		].sort((a, b) => b.time - a.time).slice(0, 18);

		const timeline = contentEl.createDiv({ cls: 'wiki-weaver-card' });
		timeline.createEl('h3', { text: ui('活动时间线', 'Activity timeline') });
		if (timelineItems.length === 0) {
			this.renderEmptyState(
				timeline,
				ui('还没有可展示的活动。', 'No activity to display yet.'),
				ui('从 AI 助手开始一次任务后，这里会按时间显示任务、来源、审核和写回记录。', 'Start a task from your AI assistant to show task, source, review, and writeback records here over time.')
			);
		} else {
			const list = timeline.createDiv({ cls: 'wiki-weaver-timeline' });
			for (const item of timelineItems) {
				const row = list.createDiv({ cls: 'wiki-weaver-timeline__item' });
				row.createEl('div', { text: item.type, cls: 'wiki-weaver-badge' });
				const body = row.createDiv({ cls: 'wiki-weaver-timeline__body' });
				body.createEl('strong', { text: `${item.title || ui('未命名', 'Untitled')} • ${this.plugin.formatDisplayTime(item.time)}` });
				if (item.meta) {
					body.createEl('div', { text: item.meta, cls: 'wiki-weaver-view__description' });
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
		const item = container.createDiv({ cls: 'wiki-weaver-status-pill' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderMetricCard(container: HTMLElement, label: string, value: string, detail: string): void {
		const card = container.createDiv({ cls: 'wiki-weaver-metric-card' });
		card.createEl('div', { text: label, cls: 'wiki-weaver-metric-card__label' });
		card.createEl('strong', { text: value, cls: 'wiki-weaver-metric-card__value' });
		card.createEl('div', { text: detail, cls: 'wiki-weaver-view__description' });
	}

	private renderEmptyState(container: HTMLElement, title: string, detail: string): void {
		const empty = container.createDiv({ cls: 'wiki-weaver-empty-state' });
		empty.createEl('strong', { text: title });
		empty.createEl('p', { text: detail });
	}

	private renderTaskEntry(container: HTMLElement, task: AgentTaskRecord, expanded: boolean): void {
		const item = container.createDiv({ cls: 'wiki-weaver-view__item' });
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
			summary.push(`${ui('记忆更新', 'Memory updates')} ${task.proposals.length}`);
			item.createEl('div', { text: summary.join(' • ') });
		}
		item.createEl('small', { text: `${ui('文件', 'File')}: ${task.path}` });
		if (task.snippet) {
			item.createEl('div', {
				text: this.plugin.trimText(task.snippet, 140),
			});
		}
	}

	private isSourceRequestPending(status: string): boolean {
		const normalized = status.toLowerCase().trim();
		return !normalized || normalized === 'pending' || normalized === 'queued' || normalized === 'todo';
	}

	private renderTaskSummary(container: HTMLElement, task: AgentTaskRecord): void {
		const compact = container.createEl('div', {
			text: `${task.taskId} • ${this.plugin.formatDisplayTime(task.sortTimestamp)} • ${task.status}`,
			cls: 'wiki-weaver-view__item',
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

class WikiWeaverReviewQueueView extends ItemView {
	private activeFilter: MemoryProposalStatus | 'all' = 'pending';

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WikiWeaverPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_REVIEW_QUEUE_VIEW;
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
		contentEl.addClass('wiki-weaver-view-root');

		const header = contentEl.createDiv({ cls: 'wiki-weaver-shell-header' });
		const heading = header.createDiv();
		heading.createEl('h2', { text: ui('审核队列', 'Review queue'), cls: 'wiki-weaver-view__title' });
		heading.createEl('p', {
			text: `${ui('最后刷新', 'Last refreshed')}: ${this.plugin.formatDisplayTime(Date.parse(snapshot.updatedAt))}`,
			cls: 'wiki-weaver-view__description',
		});

		const actions = header.createDiv({ cls: 'wiki-weaver-action-row' });
		const refreshButton = actions.createEl('button', {
			text: ui('刷新', 'Refresh'),
			cls: 'mod-cta',
		});
		refreshButton.addEventListener('click', async () => {
			refreshButton.disabled = true;
			refreshButton.setText(ui('刷新中...', 'Refreshing...'));
			try {
				await this.refresh();
				new Notice(ui('审核队列已刷新。', 'Review queue refreshed.'));
			} catch (error) {
				console.error('wiki-weaver failed to refresh review queue view', error);
				refreshButton.disabled = false;
				refreshButton.setText(ui('刷新', 'Refresh'));
				new Notice(ui('刷新审核队列失败。', 'Failed to refresh review queue.'));
			}
		});

		if (snapshot.missingReviewQueueFolder) {
			contentEl.createEl('p', {
				text: ui(
					'还没有审核队列。请先初始化知识库文件结构，之后 AI 助手提出的记忆更新会出现在这里。',
					'No review queue yet. Initialize the Wiki Weaver file structure first; proposed memory updates will appear here afterward.'
				),
				cls: 'wiki-weaver-view__description',
			});
			return;
		}

		if (snapshot.proposals.length === 0) {
			this.renderEmptyState(
				contentEl,
				ui('还没有待审核的记忆更新。', 'No memory updates waiting for review yet.'),
				ui('长期记忆、用户偏好和重要决定会先进入审核队列，由你确认后才会写入。', 'Long-term memory, preferences, and important decisions appear here for your review before they are saved.')
			);
			return;
		}

		const counts = this.countByStatus(snapshot.proposals);
		const tabs = contentEl.createDiv({ cls: 'wiki-weaver-filter-tabs' });
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
		const grid = contentEl.createDiv({ cls: 'wiki-weaver-proposal-grid' });
		if (visibleProposals.length === 0) {
			this.renderEmptyState(
				grid,
				ui('当前筛选下没有内容。', 'No items match this filter.'),
				ui('切换筛选，或等待 AI 助手提出新的记忆更新。', 'Switch filters or wait for your AI assistant to propose a new memory update.')
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
		const card = container.createDiv({ cls: 'wiki-weaver-card wiki-weaver-proposal-card' });
		const header = card.createDiv({ cls: 'wiki-weaver-card__header' });
		header.createEl('strong', { text: proposal.proposalId || ui('未命名记忆更新', 'Untitled memory update') });
		const badges = header.createDiv({ cls: 'wiki-weaver-badge-row' });
		badges.createEl('span', { text: proposal.proposalKind, cls: 'wiki-weaver-badge' });
		badges.createEl('span', { text: this.plugin.formatRiskLabel(proposal.riskLevel), cls: `wiki-weaver-badge wiki-weaver-badge--risk-${proposal.riskLevel.toLowerCase()}` });
		badges.createEl('span', { text: memoryProposalStatusLabel(proposal.approvalStatus), cls: 'wiki-weaver-badge' });

		const facts = card.createDiv({ cls: 'wiki-weaver-detail-grid' });
		this.renderDetail(facts, ui('目标笔记', 'Target note'), proposal.targetNote || ui('未指定', 'Not specified'));
		this.renderDetail(facts, ui('证据数量', 'Evidence count'), String(proposal.evidence.length));
		this.renderDetail(facts, ui('任务', 'Task'), proposal.taskId || ui('无', 'None'));
		this.renderDetail(facts, ui('创建时间', 'Created'), proposal.created || ui('未知', 'Unknown'));
		this.renderDetail(facts, ui('提出来源', 'Proposed by'), proposal.proposedBy || 'unknown');
		if (proposal.snippet) {
			card.createEl('p', { text: this.plugin.trimText(proposal.snippet, 180), cls: 'wiki-weaver-view__description' });
		}
		card.createEl('small', { text: `${ui('文件', 'File')}: ${proposal.path}` });

		if (proposal.evidence.length > 0) {
			const detailPanel = card.createDiv({ cls: 'wiki-weaver-detail-panel' });
			detailPanel.createEl('strong', { text: ui('证据引用', 'Evidence refs') });
			detailPanel.createEl('div', { text: proposal.evidence.join(', ') });
		}

		this.renderProposalActions(card, proposal);
	}

	private renderDetail(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'wiki-weaver-detail' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderProposalActions(card: HTMLElement, proposal: MemoryProposalRecord): void {
		if (proposal.approvalStatus === 'pending') {
			const actionRow = card.createDiv({ cls: 'wiki-weaver-action-row' });
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
					new Notice(ui(
						`已更新为：${memoryProposalStatusLabel(status)}。`,
						`Updated to ${memoryProposalStatusLabel(status)}.`
					));
					await this.refresh();
				} catch (error) {
					console.error('wiki-weaver failed to update proposal status', error);
					new Notice(ui('更新审核状态失败。', 'Failed to update review status.'));
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
			const actionRow = card.createDiv({ cls: 'wiki-weaver-action-row' });
			const apply = actionRow.createEl('button', {
				text: ui('应用已批准写回', 'Apply approved writeback'),
				cls: 'mod-cta',
			});
			apply.addEventListener('click', () => {
				new ApprovedWritebackApplyModal(this.app, this.plugin, proposal, () => {
					void this.refresh();
				}).open();
			});
		}
	}

	private renderEmptyState(container: HTMLElement, title: string, detail: string): void {
		const empty = container.createDiv({ cls: 'wiki-weaver-empty-state' });
		empty.createEl('strong', { text: title });
		empty.createEl('p', { text: detail });
	}
}

class ApprovedWritebackApplyModal extends Modal {
	constructor(
		app: App,
		private plugin: WikiWeaverPlugin,
		private proposal: MemoryProposalRecord,
		private onApplied: () => void
	) {
		super(app);
	}

	onOpen(): void {
		super.onOpen();
		this.titleEl.setText(ui('应用已批准写回', 'Apply approved writeback'));
		void this.renderPreview();
	}

	private async renderPreview(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('p', {
			text: ui('正在生成写回预览...', 'Generating writeback preview...'),
		});
		try {
			const preview = await this.plugin.previewApprovedWriteback(this.proposal);
			this.renderReady(preview);
		} catch (error) {
			console.error('wiki-weaver failed to preview approved writeback', error);
			contentEl.empty();
			contentEl.createEl('p', {
				text: ui('生成写回预览失败，请检查该提案是否仍处于已批准状态。', 'Failed to generate writeback preview. Check whether this proposal is still approved.'),
			});
			const actions = contentEl.createDiv({ cls: 'modal-button-container' });
			actions.createEl('button', { text: ui('关闭', 'Close') }).addEventListener('click', () => this.close());
		}
	}

	private renderReady(preview: ApprovedWritebackPreview): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('p', {
			text: ui('请确认以下内容将写入目标笔记。', 'Confirm the content that will be written to the target note.'),
		});
		const facts = contentEl.createDiv({ cls: 'wiki-weaver-detail-grid' });
		this.renderDetail(facts, ui('提案', 'Proposal'), preview.proposal_id || this.proposal.proposalId);
		this.renderDetail(facts, ui('目标笔记', 'Target note'), preview.target_note || this.proposal.targetNote);
		this.renderDetail(facts, ui('涉及文件', 'Touched notes'), (preview.touched_notes || []).join(', '));
		const previewBox = contentEl.createEl('pre');
		previewBox.setText(preview.writeback_preview || '');

		const actions = contentEl.createDiv({ cls: 'modal-button-container' });
		const cancel = actions.createEl('button', { text: ui('取消', 'Cancel'), cls: 'mod-warning' });
		cancel.addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', { text: ui('确认写回', 'Apply writeback'), cls: 'mod-cta' });
		confirm.addEventListener('click', async () => {
			confirm.disabled = true;
			confirm.setText(ui('写回中...', 'Applying...'));
			try {
				await this.plugin.applyApprovedWriteback(this.proposal);
				new Notice(ui('已应用写回。', 'Approved writeback applied.'));
				this.onApplied();
				this.close();
			} catch (error) {
				console.error('wiki-weaver failed to apply approved writeback', error);
				new Notice(ui('应用写回失败。', 'Failed to apply writeback.'));
				confirm.disabled = false;
				confirm.setText(ui('确认写回', 'Apply writeback'));
			}
		});
	}

	private renderDetail(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'wiki-weaver-detail' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value || ui('未指定', 'Not specified') });
	}
}

class WikiWeaverAgentConnectionsView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WikiWeaverPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_AGENT_CONNECTIONS_VIEW;
	}

	getDisplayText() {
		return ui('AI 助手连接', 'AI assistant connections');
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
		contentEl.addClass('wiki-weaver-view-root');

		const header = contentEl.createDiv({ cls: 'wiki-weaver-shell-header' });
		const heading = header.createDiv();
		heading.createEl('h2', { text: ui('AI 助手连接', 'AI Assistant Connections'), cls: 'wiki-weaver-view__title' });
		heading.createEl('p', {
			text: ui(
				'复制常用 AI 工具的连接信息，并查看最近的连接和使用记录。',
				'Copy connection details for common AI tools and review recent connection activity.'
			),
			cls: 'wiki-weaver-view__description',
		});
		const actions = header.createDiv({ cls: 'wiki-weaver-action-row' });
		const refreshButton = actions.createEl('button', { text: ui('刷新', 'Refresh'), cls: 'mod-cta' });
		refreshButton.addEventListener('click', () => {
			void this.handleRefreshClick(refreshButton);
		});

		const statusBar = contentEl.createDiv({ cls: 'wiki-weaver-status-bar' });
		this.renderStatusItem(statusBar, 'MCP Runtime', snapshot.runtimeStatus.label);
		this.renderStatusItem(statusBar, ui('绑定范围', 'Binding'), '127.0.0.1');
		this.renderStatusItem(statusBar, ui('当前知识库', 'Current knowledge base'), snapshot.vaultRoot);
		this.renderStatusItem(statusBar, ui('最近连接', 'Recent connections'), String(snapshot.recentAgents.length));
		this.renderStatusItem(statusBar, ui('使用记录', 'Usage records'), String(snapshot.recentToolCalls.length));

		const connectionPanel = contentEl.createDiv({ cls: 'wiki-weaver-card wiki-weaver-connection-panel' });
		connectionPanel.createEl('h3', { text: ui('AI 工具连接', 'AI tool connections') });

		const connectionCheck = connectionPanel.createDiv({ cls: 'wiki-weaver-connection-check' });
		connectionCheck.createEl('h4', { text: 'MCP Runtime' });
		connectionCheck.createEl('p', {
			text: ui(
				'MCP Runtime 随 Obsidian 启动和关闭；保持 Obsidian 开启时，AI 工具可以连接本机地址。',
				'The MCP Runtime starts and stops with Obsidian; AI tools can connect to the local URL while Obsidian is open.'
			),
			cls: 'wiki-weaver-view__description',
		});
		const endpointGrid = connectionCheck.createDiv({ cls: 'wiki-weaver-detail-grid wiki-weaver-connection-detail-grid' });
		this.renderDetail(endpointGrid, ui('运行状态', 'Runtime status'), snapshot.runtimeStatus.label);
		this.renderDetail(endpointGrid, ui('状态说明', 'Status detail'), snapshot.runtimeStatus.detail, 'description');
		this.renderCopyableDetail(
			endpointGrid,
			ui('连接地址', 'Connection URL'),
			snapshot.connectionUrl || ui('未配置', 'Not configured'),
			ui('复制连接地址', 'Copy URL'),
			ui('已复制 AI 工具连接地址。', 'AI tool URL copied.'),
			Boolean(snapshot.connectionUrl)
		);
		this.renderDetail(endpointGrid, ui('绑定范围', 'Binding'), ui('仅本机 127.0.0.1', 'Localhost only, 127.0.0.1'));
		this.renderDetail(endpointGrid, ui('生命周期', 'Lifecycle'), ui('随 Obsidian 启动和关闭', 'Starts and stops with Obsidian'));
		if (snapshot.runtimeStatus.startedAt) {
			this.renderDetail(
				endpointGrid,
				ui('启动时间', 'Started at'),
				this.plugin.formatDisplayTime(Date.parse(snapshot.runtimeStatus.startedAt))
			);
		}
		this.renderDetail(endpointGrid, ui('活跃会话', 'Active sessions'), String(snapshot.runtimeStatus.activeSessions));

		const coreClientIds = new Set(['codex', 'claude-code', 'claude-desktop', 'cursor']);
		const coreClientConfigs = snapshot.clientConfigs.filter((config) => coreClientIds.has(config.clientId));
		const advancedClientConfigs = snapshot.clientConfigs.filter((config) => !coreClientIds.has(config.clientId));

		const commonConnections = connectionPanel.createDiv({ cls: 'wiki-weaver-connection-section' });
		commonConnections.createEl('h4', { text: ui('客户端配置', 'Client configuration') });
		const configGrid = commonConnections.createDiv({ cls: 'wiki-weaver-config-grid' });
		for (const clientConfig of coreClientConfigs) {
			this.renderConfigCard(configGrid, clientConfig);
		}
		if (advancedClientConfigs.length > 0) {
			const advanced = connectionPanel.createDiv({ cls: 'wiki-weaver-connection-section wiki-weaver-advanced-config' });
			advanced.createEl('h4', { text: ui('更多连接方式', 'More connection methods') });
			advanced.createEl('p', {
				text: ui(
					'上方列表没有你的 AI 工具时再使用；当前只提供 Streamable HTTP 连接地址。',
					'Use this only when your AI tool is not listed above; Wiki Weaver now exposes only a Streamable HTTP URL.'
				),
				cls: 'wiki-weaver-view__description',
			});
			const advancedDetails = advanced.createEl('details', { cls: 'wiki-weaver-advanced-details' });
			const summary = advancedDetails.createEl('summary', { text: ui('查看手动方式', 'Show manual methods') });
			const advancedList = advancedDetails.createDiv({ cls: 'wiki-weaver-advanced-list' });
			for (const clientConfig of advancedClientConfigs) {
				this.renderAdvancedConfigRow(advancedList, clientConfig);
			}
			summary.addClass('wiki-weaver-advanced-summary');
		}

		const exposedTools = contentEl.createDiv({ cls: 'wiki-weaver-card' });
		exposedTools.createEl('h3', { text: ui('可用能力', 'Available capabilities') });
		exposedTools.createEl('p', {
			text: ui(
				'连接成功后，AI 助手可以使用这些能力。需要写入长期记忆的内容仍会先进入审核。',
				'After connecting, your AI assistant can use these capabilities. Anything that updates long-term memory still goes through review first.'
			),
			cls: 'wiki-weaver-view__description',
		});
		const toolGrid = exposedTools.createDiv({ cls: 'wiki-weaver-detail-grid' });
		this.renderToolset(toolGrid, ui('只读', 'Read-only'), [
			ui('查看连接和资料状态', 'Check connection and knowledge base status'),
			ui('查找相关笔记', 'Find related notes'),
			ui('读取指定笔记', 'Read a selected note'),
			ui('查看待审核内容', 'Review pending items'),
			ui('查看最近记录', 'Review recent activity'),
			ui('检查笔记结构', 'Check note structure'),
		]);
		this.renderToolset(toolGrid, ui('保存工作记录', 'Save work records'), [
			ui('整理上下文材料', 'Prepare context material'),
			ui('记录任务结果', 'Record task results'),
			ui('沉淀会话摘要', 'Summarize a session'),
			ui('保存来源资料', 'Save source material'),
			ui('提出记忆更新', 'Propose memory updates'),
		]);
		this.renderToolset(toolGrid, ui('需要审核', 'Needs review'), [
			ui('应用已批准的写回', 'Apply approved writebacks'),
		]);
		this.renderToolset(toolGrid, ui('不会执行', 'Never allowed'), [
			ui('运行系统命令', 'Run system commands'),
			ui('访问当前知识库以外的文件', 'Access files outside the current knowledge base'),
			ui('修改 Obsidian 配置目录', 'Modify Obsidian settings folders'),
			ui('批量删除或重写内容', 'Delete or rewrite content in bulk'),
		]);

		const agents = contentEl.createDiv({ cls: 'wiki-weaver-card' });
		agents.createEl('h3', { text: ui('最近连接的 AI 工具', 'Recently connected AI tools') });
		if (snapshot.recentAgents.length === 0) {
			this.renderEmptyState(
				agents,
				ui('还没有连接记录。', 'No connection records yet.'),
				snapshot.missingAuditSources
					? ui('还没有记录文件。初始化知识库后，连接和操作记录会显示在这里。', 'No activity file yet. After Wiki Weaver is initialized, connection and usage records will appear here.')
					: ui('启动知识库服务后，把上方配置复制到你的 AI 工具。', 'Start Wiki Weaver, then copy one of the configs above into your AI tool.')
			);
		} else {
			const list = agents.createDiv({ cls: 'wiki-weaver-table-list' });
			for (const agent of snapshot.recentAgents) {
				const row = list.createDiv({ cls: 'wiki-weaver-table-row' });
				row.createEl('strong', { text: agent.clientName || agent.agentId });
				row.createEl('span', { text: this.plugin.formatResultLabel(agent.status) });
				row.createEl('span', { text: `${ui('最后出现', 'Last seen')}: ${this.plugin.formatDisplayTime(agent.sortTimestamp)}` });
				row.createEl('span', { text: `${ui('最近使用', 'Last used')}: ${agent.lastToolCall ? this.plugin.formatToolDisplayName(agent.lastToolCall) : ui('无', 'None')}` });
				row.createEl('small', { text: ui('本机连接；重要写入需要先审核。', 'Local connection; important writes require review first.') });
			}
		}

		const calls = contentEl.createDiv({ cls: 'wiki-weaver-card' });
		calls.createEl('h3', { text: ui('最近使用记录', 'Recent usage') });
		if (snapshot.recentToolCalls.length === 0) {
			this.renderEmptyState(
				calls,
				ui('还没有使用记录。', 'No usage records yet.'),
				ui('AI 助手使用知识库后，这里会显示使用时间、结果和相关笔记。', 'After your AI assistant uses Wiki Weaver, this panel shows time, result, and related notes.')
			);
		} else {
			const timeline = calls.createDiv({ cls: 'wiki-weaver-timeline' });
			for (const call of snapshot.recentToolCalls) {
				const row = timeline.createDiv({ cls: 'wiki-weaver-timeline__item' });
				row.createEl('div', { text: this.plugin.formatResultLabel(call.resultStatus), cls: 'wiki-weaver-badge' });
				const body = row.createDiv({ cls: 'wiki-weaver-timeline__body' });
				body.createEl('strong', { text: `${this.plugin.formatToolDisplayName(call.toolName)} • ${this.plugin.formatDisplayTime(call.sortTimestamp)}` });
				body.createEl('div', {
					text: `${call.clientName || call.agentId} • ${ui('权限', 'Permission')}: ${this.plugin.formatRiskLabel(call.riskLevel)}`,
					cls: 'wiki-weaver-view__description',
				});
				if (call.targetPaths.length > 0) {
					body.createEl('small', { text: call.targetPaths.join(', ') });
				}
				if (call.argsSummary) {
					body.createEl('div', {
						text: ui('本次使用包含输入参数，详细内容已按安全规则记录。', 'This use included input details, recorded under the safety rules.'),
						cls: 'wiki-weaver-view__description',
					});
				}
			}
		}

		const policy = contentEl.createDiv({ cls: 'wiki-weaver-card' });
		policy.createEl('h3', { text: ui('权限说明', 'Permission guide') });
		const matrix = policy.createDiv({ cls: 'wiki-weaver-detail-grid' });
		this.renderDetail(matrix, ui('默认', 'Default'), ui('只读', 'Read-only'));
		this.renderDetail(matrix, ui('工作记录', 'Working records'), ui('保存前检查', 'Checked before saving'));
		this.renderDetail(matrix, ui('长期记忆', 'Long-term memory'), ui('先审核再写入', 'Review before writing'));
		this.renderDetail(matrix, ui('不会执行', 'Never allowed'), ui('系统命令、知识库外文件、Obsidian 配置目录、删除或批量重写', 'System commands, files outside the knowledge base, Obsidian settings folders, delete or bulk rewrite'));
	}

	private renderConfigCard(container: HTMLElement, config: GeneratedClientConfig): void {
		const row = container.createDiv({ cls: 'wiki-weaver-config-row' });
		const client = row.createDiv({ cls: 'wiki-weaver-config-row__client' });
		const title = client.createDiv({ cls: 'wiki-weaver-config-row__title' });
		title.createEl('strong', { text: config.displayName });
		title.createEl('span', {
			text: config.configStatusLabel,
			cls: `wiki-weaver-badge ${this.configStatusClass(config.configState)}`,
		});
		client.createEl('small', { text: config.configStatusDetail });
		const actions = row.createDiv({ cls: 'wiki-weaver-config-row__actions wiki-weaver-action-row' });

		if (config.configState !== 'configured') {
			const copy = actions.createEl('button', { text: ui('复制配置', 'Copy config') });
			copy.addEventListener('click', () => {
				void this.plugin.copyToClipboard(config.configText, ui('已复制连接配置。', 'Connection config copied.'));
			});
		}

		if (config.supportsAutoConfigure && config.targetPath && config.configState !== 'configured') {
			const autoConfigure = actions.createEl('button', {
				text: config.configState === 'needs_update' ? ui('更新配置', 'Update config') : ui('自动配置', 'Auto setup'),
				cls: 'mod-cta',
			});
			autoConfigure.addEventListener('click', () => {
				new ClientConfigPreviewModal(this.app, this.plugin, config, 'apply').open();
			});
		}

		if (
			config.supportsAutoConfigure
			&& config.targetPath
			&& (config.configState === 'configured' || config.configState === 'needs_update')
		) {
			const openFile = actions.createEl('button', { text: ui('打开配置文件', 'Open config file') });
			openFile.addEventListener('click', () => {
				void this.plugin.openClientConfigFile(config);
			});
		}

		if (
			config.supportsAutoConfigure
			&& config.targetPath
			&& (config.configState === 'configured' || config.configState === 'needs_update')
		) {
			const remove = actions.createEl('button', { text: ui('移除配置', 'Remove config') });
			remove.addEventListener('click', () => {
				new ClientConfigPreviewModal(this.app, this.plugin, config, 'remove').open();
			});
		}
	}

	private async handleRefreshClick(refreshButton: HTMLButtonElement): Promise<void> {
		refreshButton.disabled = true;
		refreshButton.setText(ui('刷新中...', 'Refreshing...'));
		try {
			await this.refresh();
			new Notice(ui('连接状态已刷新。', 'Connection status refreshed.'));
		} catch (error) {
			console.error('wiki-weaver failed to refresh agent connections view', error);
			refreshButton.disabled = false;
			refreshButton.setText(ui('刷新', 'Refresh'));
			new Notice(ui('刷新连接状态失败。', 'Failed to refresh connection status.'));
		}
	}

	private configStatusClass(state: ClientConfigState): string {
		switch (state) {
			case 'configured':
				return 'wiki-weaver-badge--success';
			case 'needs_update':
				return 'wiki-weaver-badge--warning';
			case 'not_configured':
			case 'unavailable':
			default:
				return 'wiki-weaver-badge--muted';
		}
	}

	private renderAdvancedConfigRow(container: HTMLElement, config: GeneratedClientConfig): void {
		const row = container.createDiv({ cls: 'wiki-weaver-advanced-config-row' });
		const info = row.createDiv({ cls: 'wiki-weaver-advanced-config-row__info' });
		info.createEl('strong', { text: config.displayName });
		info.createEl('small', { text: config.description });
		const actions = row.createDiv({ cls: 'wiki-weaver-action-row' });
		const copy = actions.createEl('button', {
			text: ui('复制地址配置', 'Copy URL config'),
		});
		copy.addEventListener('click', () => {
			void this.plugin.copyToClipboard(config.configText, ui('已复制连接配置。', 'Connection config copied.'));
		});
	}

	private transportLabel(transport: ConnectionTransport): string {
		switch (transport) {
			case 'streamable-http':
				return ui('连接地址', 'Connection URL');
			default:
				return transport;
		}
	}

	private renderStatusItem(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'wiki-weaver-status-pill' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderDetail(container: HTMLElement, label: string, value: string, variant?: 'description'): void {
		const item = container.createDiv({
			cls: variant === 'description' ? 'wiki-weaver-detail wiki-weaver-detail--description' : 'wiki-weaver-detail',
		});
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private renderCopyableDetail(container: HTMLElement, label: string, value: string, buttonLabel: string, notice: string, canCopy = true): void {
		const item = container.createDiv({ cls: 'wiki-weaver-detail wiki-weaver-detail--copyable' });
		item.createEl('span', { text: label });
		const row = item.createDiv({ cls: 'wiki-weaver-detail__value-row' });
		row.createEl('strong', { text: value });
		const copy = row.createEl('button', { cls: 'wiki-weaver-copy-icon-button' });
		copy.disabled = !canCopy;
		setIcon(copy, 'copy');
		copy.setAttr('aria-label', buttonLabel);
		copy.setAttr('title', buttonLabel);
		copy.addEventListener('click', () => {
			void this.plugin.copyToClipboard(value, notice);
		});
	}

	private renderToolset(container: HTMLElement, title: string, tools: string[]): void {
		const item = container.createDiv({ cls: 'wiki-weaver-detail-panel' });
		item.createEl('strong', { text: title });
		const list = item.createEl('ul');
		for (const tool of tools) {
			list.createEl('li', { text: tool });
		}
	}

	private renderEmptyState(container: HTMLElement, title: string, detail: string): void {
		const empty = container.createDiv({ cls: 'wiki-weaver-empty-state' });
		empty.createEl('strong', { text: title });
		empty.createEl('p', { text: detail });
	}
}

class ClientConfigPreviewModal extends Modal {
	constructor(
		app: App,
		private plugin: WikiWeaverPlugin,
		private config: GeneratedClientConfig,
		private mode: 'apply' | 'remove'
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', {
			text: this.mode === 'apply'
				? ui('确认自动配置', 'Confirm auto setup')
				: ui('确认移除配置', 'Confirm config removal'),
		});
		contentEl.createEl('p', {
			text: this.mode === 'apply'
				? ui('将只写入知识库连接配置，不会修改其他 MCP server。写入前会创建备份。', 'Only the Wiki Weaver connection will be written. Other MCP servers will not be changed. A backup will be created first.')
				: ui('将只移除知识库连接配置，不会删除其他 MCP server。移除前会创建备份。', 'Only the Wiki Weaver connection will be removed. Other MCP servers will not be deleted. A backup will be created first.'),
			cls: 'wiki-weaver-view__description',
		});
		const details = contentEl.createDiv({ cls: 'wiki-weaver-detail-grid' });
		this.renderDetail(details, ui('AI 工具', 'AI tool'), this.config.displayName);
		this.renderDetail(details, ui('配置文件', 'Config file'), this.config.targetPath || ui('不可用', 'Unavailable'));
		this.renderDetail(details, ui('连接方式', 'Connection'), this.transportLabel(this.config.transport));
		if (this.mode === 'apply') {
			contentEl.createEl('pre', { text: this.config.configText, cls: 'wiki-weaver-code-block' });
		}
		const actions = contentEl.createDiv({ cls: 'wiki-weaver-action-row' });
		const cancel = actions.createEl('button', { text: ui('取消', 'Cancel') });
		cancel.addEventListener('click', () => this.close());
		const confirmText = this.mode === 'apply' ? ui('确认写入', 'Write config') : ui('移除配置', 'Remove config');
		const confirm = actions.createEl('button', {
			text: confirmText,
			cls: 'mod-cta',
		});
		const status = actions.createEl('span', { cls: 'wiki-weaver-view__description' });
		confirm.addEventListener('click', async () => {
			confirm.disabled = true;
			cancel.disabled = true;
			confirm.setText(this.mode === 'apply' ? ui('写入中...', 'Writing...') : ui('移除中...', 'Removing...'));
			status.setText(this.mode === 'apply' ? ui('正在写入连接配置...', 'Writing connection config...') : ui('正在移除配置...', 'Removing config...'));
			try {
				if (this.mode === 'apply') {
					await this.plugin.applyClientConfig(this.config);
				} else {
					await this.plugin.removeClientConfig(this.config);
				}
				this.close();
			} catch (_error) {
				status.setText(this.mode === 'apply' ? ui('写入失败，请检查配置文件权限后重试。', 'Write failed. Check config file permissions and try again.') : ui('移除失败，请检查配置文件权限后重试。', 'Removal failed. Check config file permissions and try again.'));
				confirm.disabled = false;
				cancel.disabled = false;
				confirm.setText(confirmText);
			}
		});
	}

	private renderDetail(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'wiki-weaver-detail' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}

	private transportLabel(transport: ConnectionTransport): string {
		switch (transport) {
			case 'streamable-http':
				return ui('连接地址', 'Connection URL');
			default:
				return transport;
		}
	}
}

class WikiWeaverMemoryInspectorView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_MEMORY_INSPECTOR_VIEW;
	}

	getDisplayText() {
		return ui('记忆查看', 'Memory view');
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
		contentEl.addClass('wiki-weaver-view-root');

		contentEl.createEl('h2', { text: ui('记忆查看', 'Memory view'), cls: 'wiki-weaver-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'这里用于查看已保存的记忆、来源证据和最近使用情况。完成一次审核或记录后，相关内容会逐步出现在这里。',
				'Use this page to review saved memories, source evidence, and recent usage. Related details appear here after review or recording activity.'
			),
			cls: 'wiki-weaver-view__description',
		});
	}
}

class WikiWeaverAuditLogView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WikiWeaverPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_AUDIT_LOG_VIEW;
	}

	getDisplayText() {
		return ui('操作记录', 'Activity log');
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
		contentEl.addClass('wiki-weaver-view-root');

		contentEl.createEl('h2', { text: ui('操作记录', 'Activity log'), cls: 'wiki-weaver-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'连接、审核和写回操作会形成记录，便于你追溯谁在什么时候改了什么。最近活动也会显示在活动页中。',
				'Connection, review, and writeback actions are recorded so you can trace what changed and when. Recent activity is also shown on the activity page.'
			),
			cls: 'wiki-weaver-view__description',
		});
	}
}

class WikiWeaverRuntimeStatusView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WikiWeaverPlugin
	) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_RUNTIME_STATUS_VIEW;
	}

	getDisplayText() {
		return ui('连接状态', 'Connection status');
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
		contentEl.addClass('wiki-weaver-view-root');
		const status = this.plugin.getRuntimeViewStatus();

		contentEl.createEl('h2', { text: ui('连接状态', 'Connection status'), cls: 'wiki-weaver-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'MCP Runtime 由 Obsidian 桌面端托管，随 Obsidian 启动和关闭。',
				'The MCP Runtime is hosted by desktop Obsidian and starts and stops with Obsidian.'
			),
			cls: 'wiki-weaver-view__description',
		});

		const detailGrid = contentEl.createDiv({ cls: 'wiki-weaver-detail-grid' });
		this.renderDetail(detailGrid, 'MCP Runtime', status.label);
		this.renderDetail(detailGrid, ui('连接地址', 'Connection URL'), this.plugin.getMcpConnectionUrl());
		this.renderDetail(detailGrid, ui('绑定范围', 'Binding'), ui('仅本机 127.0.0.1', 'Localhost only, 127.0.0.1'));
		this.renderDetail(detailGrid, ui('生命周期', 'Lifecycle'), ui('随 Obsidian 启动和关闭', 'Starts and stops with Obsidian'));
		this.renderDetail(detailGrid, ui('活跃会话', 'Active sessions'), String(status.activeSessions));
		if (status.startedAt) {
			this.renderDetail(detailGrid, ui('启动时间', 'Started at'), this.plugin.formatDisplayTime(Date.parse(status.startedAt)));
		}
		if (status.lastError) {
			this.renderDetail(detailGrid, ui('最近错误', 'Last error'), status.lastError);
		}
	}

	private renderDetail(container: HTMLElement, label: string, value: string): void {
		const item = container.createDiv({ cls: 'wiki-weaver-detail' });
		item.createEl('span', { text: label });
		item.createEl('strong', { text: value });
	}
}

class WikiWeaverPermissionPolicyView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return WIKI_WEAVER_PERMISSION_POLICY_VIEW;
	}

	getDisplayText() {
		return ui('权限说明', 'Permission guide');
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
		contentEl.addClass('wiki-weaver-view-root');

		contentEl.createEl('h2', { text: ui('权限说明', 'Permission guide'), cls: 'wiki-weaver-view__title' });
		contentEl.createEl('p', {
			text: ui(
				'知识库默认先读取和整理资料；任何会影响长期记忆的重要写入，都必须先经过你审核。',
				'Wiki Weaver reads and organizes material by default; important writes that affect long-term memory must be reviewed by you first.'
			),
			cls: 'wiki-weaver-view__description',
		});

		const sections = [
			{
				title: ui('可直接读取', 'Read directly'),
				items: [
					ui('查看连接和资料状态', 'Check connection and knowledge base status'),
					ui('查找相关笔记', 'Find related notes'),
					ui('读取指定笔记', 'Read a selected note'),
					ui('查看审核队列和最近记录', 'Review queue and recent activity'),
					ui('检查笔记结构', 'Check note structure'),
				],
			},
			{
				title: ui('可保存工作记录', 'Save work records'),
				items: [
					ui('保存来源资料和分析结果', 'Save source material and analysis results'),
					ui('整理上下文材料', 'Prepare context material'),
					ui('记录任务结果和会话摘要', 'Record task results and session summaries'),
					ui('提出长期记忆更新，等待你审核', 'Propose long-term memory updates for your review'),
				],
			},
			{
				title: ui('必须先审核', 'Needs review first'),
				items: [
					ui('长期记忆写入前必须先批准', 'Long-term memory writes must be approved first'),
					ui('用户偏好和重要决定会先进入审核队列', 'Preferences and important decisions enter the review queue first'),
					ui('批准后的写入会留下记录，方便追溯', 'Approved writes leave records for traceability'),
				],
			},
			{
				title: ui('不会执行', 'Never allowed'),
				items: [
					ui(
						'不会替你运行系统命令或安装软件',
						'Will not run system commands or install software for you'
					),
					ui(
						'不会访问当前知识库之外的文件',
						'Will not access files outside the current knowledge base'
					),
					ui(
						'不会修改 Obsidian 配置目录',
						'Will not modify Obsidian settings folders'
					),
					ui(
						'不会删除、移动或批量重写你的笔记',
						'Will not delete, move, or bulk rewrite your notes'
					),
					ui(
						'未经审核不会直接写入受保护记忆',
						'Will not write protected memory without review'
					),
				],
			},
		];

		for (const policySection of sections) {
			const section = contentEl.createDiv({ cls: 'wiki-weaver-view__section' });
			section.createEl('h3', { text: policySection.title });
			const list = section.createEl('ul', { cls: 'wiki-weaver-view__list' });
			for (const item of policySection.items) {
				list.createEl('li', { text: item, cls: 'wiki-weaver-view__item' });
			}
		}

		const source = contentEl.createDiv({ cls: 'wiki-weaver-view__section' });
		source.createEl('h3', { text: ui('使用提示', 'Tip') });
		source.createEl('p', {
			text: ui(
				'如果不确定某条记忆是否应该保存，请选择“要求修订”或“暂缓”，不要直接批准。',
				'If you are unsure whether a memory should be saved, choose request revision or defer instead of approving it.'
			),
			cls: 'wiki-weaver-view__description',
		});
	}
}

class WikiWeaverSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: WikiWeaverPlugin
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
				'在活动页顶部显示一条说明文字。',
				'Show a short message at the top of the activity page.'
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
				'开启欢迎信息后显示在活动页顶部；留空则使用默认文案。',
				'Shown at the top of the activity page when welcome messages are enabled. Leave empty to use the default message.'
			))
			.addText((text) =>
				text
					.setPlaceholder(defaultStatusMessage())
					.setValue(this.plugin.settings.statusMessage)
					.onChange(async (value) => {
						this.plugin.settings.statusMessage = value;
						await this.plugin.saveSettings();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon('rotate-ccw')
					.setTooltip(ui('恢复默认', 'Restore default'))
					.onClick(async () => {
						this.plugin.settings.statusMessage = DEFAULT_SETTINGS.statusMessage;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(ui('MCP Runtime 端口', 'MCP Runtime port'))
			.setDesc(ui(
				`默认使用本机 ${DEFAULT_MCP_PORT} 端口；修改后 Runtime 会随 Obsidian 自动重启。`,
				`Uses local port ${DEFAULT_MCP_PORT} by default; the Runtime restarts with Obsidian after changes.`
			))
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_MCP_PORT))
					.setValue(String(this.plugin.settings.mcpPort))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value.trim(), 10);
						if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
							return;
						}
						this.plugin.settings.mcpPort = parsed;
						await this.plugin.saveSettings();
						await this.plugin.restartMcpRuntime();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon('rotate-ccw')
					.setTooltip(ui('恢复默认', 'Restore default'))
					.onClick(async () => {
						this.plugin.settings.mcpPort = DEFAULT_MCP_PORT;
						await this.plugin.saveSettings();
						await this.plugin.restartMcpRuntime();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(ui('本地连接令牌', 'Local connection token'))
			.setDesc(
				this.plugin.settings.runtimeToken
					? ui('已生成。令牌不会明文展示，只会写入 AI 工具配置。', 'Generated. The token is not displayed and is only written into AI tool configs.')
					: ui('尚未生成，保存设置后会自动生成。', 'Not generated yet. It will be generated after settings are saved.')
			)
			.addButton((button) =>
				button
					.setButtonText(ui('重新生成', 'Regenerate'))
					.onClick(async () => {
						await this.plugin.regenerateRuntimeToken();
						this.display();
					})
			);
	}
}
