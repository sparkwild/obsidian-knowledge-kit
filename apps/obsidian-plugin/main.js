"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObsWikiPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var OBS_WIKI_ACTIVITY_VIEW = "obs-wiki-activity";
var OBS_WIKI_SOURCE_STATUS_VIEW = "obs-wiki-source-status";
var OBS_WIKI_REVIEW_QUEUE_VIEW = "obs-wiki-review-queue";
var OBS_WIKI_MEMORY_INSPECTOR_VIEW = "obs-wiki-memory-inspector";
var OBS_WIKI_AUDIT_LOG_VIEW = "obs-wiki-audit-log";
var OBS_WIKI_RUNTIME_STATUS_VIEW = "obs-wiki-runtime-status";
var OBS_WIKI_PERMISSION_POLICY_VIEW = "obs-wiki-permission-policy";
var CONTROL_FILES = [
  {
    path: "00_control/system.md",
    content: "# System Control\n\nObsidian-native memory system control defaults for obs-wiki.\n"
  },
  {
    path: "00_control/memory_policy.md",
    content: "# Memory Policy\n\n- Writing is permissioned.\n- Vault scope: vault-root only.\n"
  },
  {
    path: "00_control/permissions.md",
    content: "# Permissions\n\n- Default: read-only for automation.\n- User confirmation required for memory writes.\n"
  }
];
var CONTROL_PATHS = {
  root: "00_control",
  auditLog: "00_control/audit_log.md",
  auditDir: "00_control/audit",
  dashboards: "00_control/dashboards"
};
var SOURCE_REQUESTS_PATH = "01_inbox/agent_requests";
var REVIEW_QUEUE_PATH = "01_inbox/review_queue";
var AGENT_TASKS_PATH = "02_timeline/agent_tasks";
var MAX_TASK_SNIPPET_LENGTH = 160;
var MAX_TASK_ROWS = 6;
var MAX_AUDIT_ROWS = 12;
var MAX_SOURCE_STATUS_ROWS = 20;
var MAX_REVIEW_QUEUE_ROWS = 20;
var MEMORY_STRUCTURE = [
  "01_inbox/agent_requests",
  "01_inbox/review_queue",
  "02_timeline/sessions",
  "02_timeline/agent_tasks",
  "03_sources/web",
  "03_sources/files",
  "03_sources/transcripts",
  "03_sources/attachments",
  "04_memory/concepts",
  "04_memory/claims",
  "04_memory/procedures",
  "04_memory/preferences",
  "04_memory/reflections",
  "05_projects",
  "06_outputs/context_packs",
  "06_outputs/reports",
  "06_outputs/source_analysis",
  "06_outputs/summaries",
  "07_archive"
];
var DEFAULT_SETTINGS = {
  showWelcomeMessage: true,
  defaultAgentScope: "vault",
  statusMessage: "Welcome to obs-wiki Agent Activity."
};
var ObsWikiPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
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
    this.addRibbonIcon("layout-dashboard", "Open obs-wiki Activity", () => {
      this.openPluginView(OBS_WIKI_ACTIVITY_VIEW);
    });
    this.addCommand({
      id: "open-agent-activity",
      name: "Open Agent Activity",
      callback: () => this.openPluginView(OBS_WIKI_ACTIVITY_VIEW)
    });
    this.addCommand({
      id: "open-review-queue",
      name: "Open Review Queue",
      callback: () => this.openPluginView(OBS_WIKI_REVIEW_QUEUE_VIEW)
    });
    this.addCommand({
      id: "open-memory-inspector",
      name: "Open Memory Inspector",
      callback: () => this.openPluginView(OBS_WIKI_MEMORY_INSPECTOR_VIEW)
    });
    this.addCommand({
      id: "open-audit-log",
      name: "Open Audit Log",
      callback: () => this.openPluginView(OBS_WIKI_AUDIT_LOG_VIEW)
    });
    this.addCommand({
      id: "open-runtime-status",
      name: "Open Runtime Status",
      callback: () => this.openPluginView(OBS_WIKI_RUNTIME_STATUS_VIEW)
    });
    this.addCommand({
      id: "open-permission-policy",
      name: "Open Permission Policy",
      callback: () => this.openPluginView(OBS_WIKI_PERMISSION_POLICY_VIEW)
    });
    this.addCommand({
      id: "refresh-views",
      name: "Refresh Views",
      callback: () => {
        void this.refreshGovernanceViews();
      }
    });
    this.addSettingTab(new ObsWikiSettingTab(this.app, this));
  }
  async promptInitializeMemoryStructure() {
    const plan = this.buildInitializationPlan();
    new InitializeMemoryStructureModal(this.app, {
      plan,
      onConfirm: async () => {
        await this.initializeMemoryStructure(plan);
      }
    }).open();
  }
  buildInitializationPlan() {
    const foldersToCreate = this.getNormalizedFolderPlan();
    const missingFolders = foldersToCreate.filter(
      (path) => this.app.vault.getAbstractFileByPath(path) === null
    );
    const missingAuditLog = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;
    const filesToCreate = [];
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
      missingAuditLog
    };
  }
  getNormalizedFolderPlan() {
    const foldersToCreate = [];
    const seen = /* @__PURE__ */ new Set();
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
  expandFolderHierarchy(path) {
    const normalized = this.normalizeVaultPath(path);
    if (!normalized) {
      return [];
    }
    const parts = normalized.split("/").filter(Boolean);
    const folders = [];
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      folders.push(current);
    }
    return folders;
  }
  normalizeVaultPath(path) {
    return path.trim().replace(/\\+/g, "/").replace(/\/+$/g, "");
  }
  async ensureFolderExists(folderPath) {
    const normalized = this.normalizeVaultPath(folderPath);
    if (!normalized) return;
    let current = "";
    for (const segment of normalized.split("/").filter(Boolean)) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
        continue;
      }
      if (!(existing instanceof import_obsidian.TFolder)) {
        throw new Error(`Cannot create folder: ${current} already exists as a file.`);
      }
    }
  }
  async ensureFileDoesNotExist(path, content) {
    const existing = this.app.vault.getAbstractFileByPath(this.normalizeVaultPath(path));
    if (existing) {
      if (!(existing instanceof import_obsidian.TFile)) {
        throw new Error(`Cannot create file: ${path} already exists as a folder.`);
      }
      return;
    }
    await this.app.vault.create(this.normalizeVaultPath(path), content);
  }
  buildAuditLogPath() {
    return this.normalizeVaultPath(CONTROL_PATHS.auditLog);
  }
  async initializeMemoryStructure(plan) {
    try {
      for (const folder of plan.foldersToCreate) {
        await this.ensureFolderExists(folder);
      }
      for (const controlFile of CONTROL_FILES.filter(
        (file) => plan.filesToCreate.includes(file.path)
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
      new import_obsidian.Notice("obs-wiki memory structure initialized.");
    } catch (error) {
      console.error("obs-wiki failed to initialize memory structure", error);
      new import_obsidian.Notice("obs-wiki failed to initialize memory structure.");
    }
  }
  buildAuditLogHeader() {
    return "# Audit Log\n\n";
  }
  async appendAuditEvent(plan) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const event = this.renderAuditEvent(now, plan.foldersToCreate.length, plan.filesToCreate.length);
    await this.appendToAuditLog(event);
  }
  renderAuditEvent(timestamp, folderCount, fileCount) {
    return `## ${timestamp}
action: memory.initialize
actor: user
folders_created: ${folderCount}
files_created: ${fileCount}
result: success

`;
  }
  async appendProposalStatusAuditEvent(proposal, nextStatus) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const event = this.renderProposalStatusAuditEvent(
      now,
      proposal.path,
      proposal.proposalId,
      nextStatus,
      proposal.taskId
    );
    await this.appendToAuditLog(event);
  }
  renderProposalStatusAuditEvent(timestamp, target, proposalId, nextStatus, taskId) {
    return `## ${timestamp}
action: memory.proposal.${nextStatus}
actor: user
target: ${target}
reason: proposal ${proposalId} marked ${nextStatus}
task_id: ${taskId || ""}
timestamp: ${timestamp}

`;
  }
  async appendToAuditLog(rawEvent) {
    const auditPath = this.buildAuditLogPath();
    const auditFile = this.app.vault.getAbstractFileByPath(auditPath);
    if (!auditFile) {
      await this.ensureFileDoesNotExist(auditPath, this.buildAuditLogHeader());
    }
    const finalAuditFile = this.app.vault.getAbstractFileByPath(auditPath);
    if (!(finalAuditFile instanceof import_obsidian.TFile)) {
      throw new Error(`Cannot append audit log: ${auditPath} is not a file.`);
    }
    const current = await this.app.vault.read(finalAuditFile);
    const normalizedCurrent = current.endsWith("\n") ? current : `${current}
`;
    const separator = normalizedCurrent.length > 0 ? "\n" : "";
    await this.app.vault.modify(
      finalAuditFile,
      `${normalizedCurrent}${separator}${rawEvent}`
    );
  }
  async refreshActivityViews() {
    const activityLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_ACTIVITY_VIEW);
    for (const leaf of activityLeaves) {
      const view = leaf.view;
      if (view instanceof ObsWikiActivityView) {
        await view.refresh();
      }
    }
  }
  async refreshReviewQueueViews() {
    const reviewQueueLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_REVIEW_QUEUE_VIEW);
    for (const leaf of reviewQueueLeaves) {
      const view = leaf.view;
      if (view instanceof ObsWikiReviewQueueView) {
        await view.refresh();
      }
    }
  }
  async refreshSourceStatusViews() {
    const sourceStatusLeaves = this.app.workspace.getLeavesOfType(OBS_WIKI_SOURCE_STATUS_VIEW);
    for (const leaf of sourceStatusLeaves) {
      const view = leaf.view;
      if (view instanceof ObsWikiSourceStatusView) {
        await view.refresh();
      }
    }
  }
  quoteYamlString(value) {
    const trimmed = (value || "").trim().replace(/\r/g, "");
    if (!trimmed) {
      return '""';
    }
    const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  async refreshGovernanceViews() {
    await this.refreshActivityViews();
    await this.refreshReviewQueueViews();
    await this.refreshSourceStatusViews();
  }
  async loadSourceStatusSnapshot() {
    const folder = this.app.vault.getAbstractFileByPath(SOURCE_REQUESTS_PATH);
    if (!(folder instanceof import_obsidian.TFolder)) {
      return {
        requests: [],
        missingRequestFolder: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const files = this.collectMarkdownFiles(folder);
    const records = await Promise.all(files.map((file) => this.readSourceRequestFile(file)));
    const requests = records.filter((record) => Boolean(record)).sort((a, b) => b.sortTimestamp - a.sortTimestamp).slice(0, MAX_SOURCE_STATUS_ROWS);
    return {
      requests,
      missingRequestFolder: false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async readSourceRequestFile(file) {
    var _a;
    let content = "";
    try {
      content = await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error(`obs-wiki failed to read source request: ${file.path}`, error);
      content = "";
    }
    const parsed = this.readFrontmatter(content);
    const data = parsed.fields;
    const type = this.firstString(data, ["type"]);
    if (!type.toLowerCase().includes("agent-request")) {
      return null;
    }
    const source = this.firstString(data, ["source"]);
    const status = this.firstString(data, ["status"]);
    if (!source || status.toLowerCase() !== "pending") {
      return null;
    }
    const created = this.firstString(data, ["created"]);
    const sortTimestamp = this.parseTimestamp(created, (_a = file.stat) == null ? void 0 : _a.mtime);
    return {
      path: file.path,
      type,
      source,
      sourceKind: this.firstString(data, ["source_kind", "sourceKind"]) || "unknown",
      purpose: this.firstString(data, ["purpose"]) || "",
      relatedProject: this.firstString(data, ["related_project", "relatedProject"]) || "",
      analysisMode: this.firstString(data, ["analysis_mode", "analysisMode"]) || "default",
      status,
      created,
      summary: this.snippetFromText(parsed.body, source),
      sortTimestamp
    };
  }
  async loadAgentActivitySnapshot() {
    const recentTasks = await this.readRecentAgentTasks(MAX_TASK_ROWS);
    const currentTask = this.pickCurrentTask(recentTasks);
    const recentAuditEvents = await this.readRecentAuditEvents(MAX_AUDIT_ROWS);
    const taskFolderMissing = this.app.vault.getAbstractFileByPath(AGENT_TASKS_PATH) === null;
    const auditLogMissing = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog) === null;
    const auditDirMissing = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir) === null;
    return {
      currentTask,
      recentTasks,
      recentAuditEvents,
      missingTaskFolder: taskFolderMissing,
      missingAuditSources: auditLogMissing && auditDirMissing,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async loadMemoryReviewQueueSnapshot() {
    const folder = this.app.vault.getAbstractFileByPath(REVIEW_QUEUE_PATH);
    if (!(folder instanceof import_obsidian.TFolder)) {
      return {
        proposals: [],
        missingReviewQueueFolder: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const files = this.collectMarkdownFiles(folder);
    const records = await Promise.all(files.map((file) => this.readMemoryProposalFile(file)));
    const proposals = records.filter((record) => Boolean(record)).sort((a, b) => this.compareProposalRecords(a, b)).slice(0, MAX_REVIEW_QUEUE_ROWS);
    return {
      proposals,
      missingReviewQueueFolder: false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async readMemoryProposalFile(file) {
    var _a;
    let content = "";
    try {
      content = await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error(`obs-wiki failed to read memory proposal: ${file.path}`, error);
      content = "";
    }
    const parsed = this.readFrontmatter(content);
    const data = parsed.fields;
    const proposalType = this.firstString(data, ["type"]);
    if (proposalType && !proposalType.toLowerCase().includes("memory-proposal")) {
      return null;
    }
    const created = this.firstString(data, ["created"]);
    const proposalId = this.firstString(data, ["proposal_id", "proposalId"]) || file.basename;
    const approvalStatus = this.normalizeProposalStatus(
      this.firstString(data, ["approval_status", "approvalStatus"])
    );
    const sortTimestamp = this.parseTimestamp(
      created,
      (_a = file.stat) == null ? void 0 : _a.mtime
    );
    return {
      path: file.path,
      proposalId,
      proposalKind: this.firstString(data, ["proposal_kind", "proposalKind"]) || "unknown",
      proposedBy: this.firstString(data, ["proposed_by", "proposedBy"]) || "unknown",
      taskId: this.firstString(data, ["task_id", "taskId"]) || "",
      targetNote: this.firstString(data, ["target_note", "targetNote"]) || "",
      evidence: this.readStringList(data, ["evidence"]),
      riskLevel: this.firstString(data, ["risk_level", "riskLevel"]) || "unknown",
      approvalStatus,
      created,
      snippet: this.snippetFromText(parsed.body, proposalId),
      sortTimestamp
    };
  }
  async updateMemoryProposalStatus(proposal, nextStatus) {
    const file = this.app.vault.getAbstractFileByPath(proposal.path);
    if (!(file instanceof import_obsidian.TFile)) {
      throw new Error(`Cannot update proposal status: ${proposal.path} is not available.`);
    }
    let content = "";
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
        approvalStatus: normalizedStatus
      },
      normalizedStatus
    );
  }
  normalizeProposalStatus(rawStatus) {
    const status = (rawStatus || "pending").toLowerCase().trim();
    if (status === "approved" || status === "rejected" || status === "deferred" || status === "revision_requested" || status === "applied") {
      return status;
    }
    if (status === "pending_review") {
      return "pending";
    }
    return "pending";
  }
  compareProposalRecords(a, b) {
    var _a, _b;
    const statusRank = {
      pending: 0,
      revision_requested: 1,
      approved: 2,
      applied: 3,
      deferred: 4,
      rejected: 5
    };
    const rankA = (_a = statusRank[a.approvalStatus]) != null ? _a : 1;
    const rankB = (_b = statusRank[b.approvalStatus]) != null ? _b : 1;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return b.sortTimestamp - a.sortTimestamp;
  }
  async readRecentAgentTasks(limit) {
    const folder = this.app.vault.getAbstractFileByPath(AGENT_TASKS_PATH);
    if (!(folder instanceof import_obsidian.TFolder)) {
      return [];
    }
    const files = this.collectMarkdownFiles(folder);
    const records = await Promise.all(
      files.map((file) => this.readAgentTaskFile(file))
    );
    return records.filter((record) => Boolean(record)).sort((a, b) => b.sortTimestamp - a.sortTimestamp).slice(0, limit);
  }
  async readRecentAuditEvents(limit) {
    const auditLogRecords = await this.readAuditLogFile();
    const folderRecords = await this.readAuditFolderEvents();
    return [...auditLogRecords, ...folderRecords].sort((a, b) => b.sortTimestamp - a.sortTimestamp).slice(0, limit);
  }
  collectMarkdownFiles(folder) {
    const files = [];
    for (const child of folder.children) {
      if (child instanceof import_obsidian.TFile && child.extension === "md") {
        files.push(child);
      } else if (child instanceof import_obsidian.TFolder) {
        files.push(...this.collectMarkdownFiles(child));
      }
    }
    return files;
  }
  async readAgentTaskFile(file) {
    var _a;
    let content = "";
    try {
      content = await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error(`obs-wiki failed to read agent task: ${file.path}`, error);
      content = "";
    }
    const parsed = this.readFrontmatter(content);
    const data = parsed.fields;
    const objective = this.firstString(data, ["objective"]);
    const path = file.path;
    const startedAt = this.firstString(data, ["started_at", "startedAt"]);
    const finishedAt = this.firstString(data, ["finished_at", "finishedAt"]);
    const sortTimestamp = this.parseTimestamp(
      startedAt || finishedAt,
      (_a = file.stat) == null ? void 0 : _a.mtime
    );
    return {
      path,
      type: this.firstString(data, ["type"]) || "agent-task",
      taskId: this.firstString(data, ["task_id", "taskId"]) || file.basename,
      agent: this.firstString(data, ["agent"]) || "unknown",
      objective: objective || this.snippetFromText(parsed.body, file.basename),
      status: this.firstString(data, ["status"]) || "unknown",
      startedAt,
      finishedAt,
      contextPack: this.firstString(data, ["context_pack", "contextPack"]),
      relatedProject: this.firstString(data, ["related_project", "relatedProject"]),
      memoryReads: this.readStringList(data, ["memory_reads", "memoryReads"]),
      memoryWrites: this.readStringList(data, ["memory_writes", "memoryWrites"]),
      sourceCaptures: this.readStringList(data, ["source_captures", "sourceCaptures"]),
      proposals: this.readStringList(data, ["proposals"]),
      snippet: this.snippetFromText(parsed.body, objective || file.basename),
      sortTimestamp
    };
  }
  pickCurrentTask(tasks) {
    var _a;
    const active = tasks.find(
      (task) => {
        var _a2;
        return ((_a2 = task.status) == null ? void 0 : _a2.toLowerCase()) === "active";
      }
    );
    return (_a = active != null ? active : tasks[0]) != null ? _a : null;
  }
  async readAuditLogFile() {
    const file = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditLog);
    if (!(file instanceof import_obsidian.TFile)) {
      return [];
    }
    let content = "";
    try {
      content = await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error("obs-wiki failed to read audit log", error);
      return [];
    }
    return this.parseAuditLogSections(content, file.path);
  }
  async readAuditFolderEvents() {
    const folder = this.app.vault.getAbstractFileByPath(CONTROL_PATHS.auditDir);
    if (!(folder instanceof import_obsidian.TFolder)) {
      return [];
    }
    const files = this.collectMarkdownFiles(folder);
    const events = [];
    for (const file of files) {
      const fileEvents = await this.readAuditMarkdownFile(file);
      events.push(...fileEvents);
    }
    return events;
  }
  async readAuditMarkdownFile(file) {
    var _a, _b;
    let content = "";
    try {
      content = await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error(`obs-wiki failed to read audit file: ${file.path}`, error);
      return [];
    }
    const parsed = this.readFrontmatter(content);
    const data = parsed.fields;
    const timestamp = this.firstString(data, ["timestamp"]) || this.timestampFromFilename(file.basename);
    const fallbackTs = this.parseTimestamp(timestamp, ((_a = file.stat) == null ? void 0 : _a.mtime) || Date.now()) || ((_b = file.stat) == null ? void 0 : _b.mtime) || Date.now();
    if (Object.keys(data).length > 0) {
      return [
        {
          path: file.path,
          auditId: this.firstString(data, ["audit_id", "auditId", "id"]),
          actor: this.firstString(data, ["actor"]) || "unknown",
          action: this.firstString(data, ["action"]) || "unknown",
          target: this.firstString(data, ["target"]) || "",
          reason: this.firstString(data, ["reason"]) || "",
          taskId: this.firstString(data, ["task_id", "taskId"]),
          timestamp: timestamp || "",
          sortTimestamp: fallbackTs,
          snippet: this.snippetFromText(parsed.body, this.trimText(file.basename))
        }
      ];
    }
    const sectionRecords = this.parseAuditLogSections(content, file.path);
    return sectionRecords.length > 0 ? sectionRecords : [];
  }
  parseAuditLogSections(content, sourcePath) {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const events = [];
    let cursor = 0;
    while (cursor < lines.length) {
      const header = lines[cursor].trim();
      if (!header.startsWith("## ")) {
        cursor += 1;
        continue;
      }
      const timestampHeader = header.replace(/^##\s+/, "").trim();
      cursor += 1;
      const bodyLines = [];
      while (cursor < lines.length && !lines[cursor].trim().startsWith("## ")) {
        bodyLines.push(lines[cursor]);
        cursor += 1;
      }
      const row = this.readKeyValueRows(bodyLines);
      const fallbackTimestamp = this.firstString(row, ["timestamp"]) || timestampHeader;
      events.push({
        path: sourcePath,
        auditId: this.firstString(row, ["audit_id", "auditId", "id"]),
        actor: this.firstString(row, ["actor"]) || "unknown",
        action: this.firstString(row, ["action"]) || "unknown",
        target: this.firstString(row, ["target"]) || "",
        reason: this.firstString(row, ["reason"]) || "",
        taskId: this.firstString(row, ["task_id", "taskId"]),
        timestamp: fallbackTimestamp,
        sortTimestamp: this.parseTimestamp(
          fallbackTimestamp,
          Date.now()
        ),
        snippet: this.snippetFromText(bodyLines.join("\n"))
      });
    }
    return events;
  }
  updateApprovalStatusInFrontmatter(content, nextStatus) {
    const normalized = content.replace(/\r\n/g, "\n");
    const fmStatusLine = `approval_status: ${nextStatus}`;
    const fmPrefix = "---";
    if (normalized.trim() === "") {
      return `${fmPrefix}
${fmStatusLine}
${fmPrefix}
`;
    }
    const lines = normalized.split("\n");
    if (lines.length === 0 || lines[0].trim() !== fmPrefix) {
      return `${fmPrefix}
${fmStatusLine}
${fmPrefix}
${normalized}`;
    }
    let end = -1;
    for (let index = 1; index < lines.length; index++) {
      if (lines[index].trim() === fmPrefix) {
        end = index;
        break;
      }
    }
    if (end < 0) {
      return `${fmPrefix}
${fmStatusLine}
${fmPrefix}
${normalized}`;
    }
    const frontmatterLines = lines.slice(1, end);
    let found = false;
    const updatedFrontmatter = frontmatterLines.map((line) => {
      var _a;
      if (/^\s*approval_status\s*:/i.test(line)) {
        found = true;
        const indent = ((_a = line.match(/^(\s*)/)) == null ? void 0 : _a[0]) || "";
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
      ...lines.slice(end + 1)
    ].join("\n");
  }
  readFrontmatter(content) {
    const normalized = content.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    if (lines.length === 0 || lines[0].trim() !== "---") {
      return { fields: {}, body: normalized };
    }
    const fields = {};
    let cursor = 1;
    for (; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      if (line.trim() === "---") {
        cursor += 1;
        break;
      }
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const pair = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (!pair) {
        continue;
      }
      const key = pair[1].trim();
      const rawValue = pair[2].trim();
      if (rawValue === "") {
        const values = [];
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
    return { fields, body: lines.slice(cursor).join("\n") };
  }
  parseScalarOrArray(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) {
        return [];
      }
      return inner.split(",").map((item) => this.trimText(item.replace(/^['"]|['"]$/g, ""))).filter(Boolean);
    }
    return trimmed;
  }
  readKeyValueRows(lines) {
    const rows = {};
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
  firstString(values, keys) {
    for (const key of keys) {
      const value = values[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (Array.isArray(value)) {
        const first = value.find((entry) => Boolean(entry && entry.trim()));
        if (first) {
          return first;
        }
      }
    }
    return "";
  }
  readStringList(values, keys) {
    const items = [];
    for (const key of keys) {
      const value = values[key];
      if (!value) continue;
      if (Array.isArray(value)) {
        items.push(...value.filter(Boolean));
        continue;
      }
      items.push(
        ...value.split(",").map((entry) => entry.trim()).filter(Boolean)
      );
    }
    return [...new Set(items)];
  }
  parseTimestamp(timestamp, fallbackMs) {
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
  timestampFromFilename(name) {
    const match = name.match(/\d{4}[-_]?\d{2}[-_]?\d{2}([T_]\d{2}[-_]?\d{2}[-_]?\d{2})?/);
    if (!match) return "";
    return match[0].replace(/_/g, "T").replace(/-/g, "-");
  }
  snippetFromText(text, fallback = "") {
    const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).filter((line) => !line.startsWith("#")).filter((line) => !line.startsWith("---"));
    const raw = lines.length > 0 ? lines[0] : this.trimText(fallback, MAX_TASK_SNIPPET_LENGTH);
    return this.trimText(raw, MAX_TASK_SNIPPET_LENGTH);
  }
  trimText(value, maxLength = MAX_TASK_SNIPPET_LENGTH) {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    return `${trimmed.slice(0, maxLength - 1)}\u2026`;
  }
  formatDisplayTime(value) {
    if (!value) {
      return "unknown time";
    }
    return new Date(value).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
  }
  async openPluginView(viewType) {
    const existingLeaves = this.app.workspace.getLeavesOfType(viewType);
    if (existingLeaves.length > 0) {
      this.app.workspace.setActiveLeaf(existingLeaves[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: viewType,
      state: {},
      active: true
    });
    this.app.workspace.revealLeaf(leaf);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var InitializeMemoryStructureModal = class extends import_obsidian.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    super.onOpen();
    this.titleEl.setText("Initialize Memory Structure");
    const { contentEl } = this;
    contentEl.empty();
    const { foldersToCreate, filesToCreate } = this.options.plan;
    contentEl.createEl("p", {
      text: "The following obs-wiki structure will be created if missing in this vault."
    });
    if (foldersToCreate.length === 0 && filesToCreate.length === 0) {
      contentEl.createEl("p", {
        text: "Nothing is missing. No files or folders will be created."
      });
    } else {
      const section = contentEl.createDiv();
      section.createEl("h3", { text: "Folders" });
      const folderList = section.createEl("ul");
      for (const folder of foldersToCreate) {
        folderList.createEl("li", { text: folder });
      }
      section.createEl("h3", { text: "Files" });
      const fileList = section.createEl("ul");
      for (const file of filesToCreate) {
        fileList.createEl("li", { text: file });
      }
    }
    const actions = contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = actions.createEl("button", { text: "Cancel", cls: "mod-warning" });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { text: "Initialize", cls: "mod-cta" });
    confirm.addEventListener("click", async () => {
      await this.options.onConfirm();
      this.close();
    });
  }
  onClose() {
    super.onClose();
  }
};
var ObsWikiSourceStatusView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return OBS_WIKI_SOURCE_STATUS_VIEW;
  }
  getDisplayText() {
    return "Source Status";
  }
  getViewData() {
    return "";
  }
  setViewData(_data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    await this.refresh();
  }
  async render(snapshot) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Source Status", cls: "obs-wiki-view__title" });
    const header = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    header.createEl("div", {
      text: `Last refreshed: ${this.plugin.formatDisplayTime(
        Date.parse(snapshot.updatedAt)
      )}`,
      cls: "obs-wiki-view__description"
    });
    const actions = header.createDiv();
    const refreshButton = actions.createEl("button", {
      text: "Refresh",
      cls: "mod-cta"
    });
    refreshButton.addEventListener("click", async () => {
      await this.refresh();
    });
    if (snapshot.missingRequestFolder) {
      contentEl.createEl("p", {
        text: "No agent source request folder found at 01_inbox/agent_requests. Agent-created requests will appear here after the memory structure exists.",
        cls: "obs-wiki-view__description"
      });
      return;
    }
    if (snapshot.requests.length === 0) {
      contentEl.createEl("p", {
        text: "No pending agent-created source requests yet.",
        cls: "obs-wiki-view__description"
      });
      return;
    }
    const list = contentEl.createEl("ul", { cls: "obs-wiki-view__list" });
    for (const request of snapshot.requests) {
      const item = list.createEl("li", { cls: "obs-wiki-view__item" });
      item.createEl("div", {
        text: `${this.plugin.formatDisplayTime(request.sortTimestamp)} \u2022 ${request.sourceKind} \u2022 ${request.status}`
      });
      if (request.source) {
        item.createEl("div", { text: `Source: ${this.plugin.trimText(request.source, 120)}` });
      }
      if (request.purpose) {
        item.createEl("div", { text: `Purpose: ${request.purpose}` });
      }
      if (request.analysisMode) {
        item.createEl("div", { text: `Analysis mode: ${request.analysisMode}` });
      }
      if (request.relatedProject) {
        item.createEl("div", { text: `Related project: ${request.relatedProject}` });
      }
      if (request.summary) {
        item.createEl("div", { text: this.plugin.trimText(request.summary, 140) });
      }
      item.createEl("small", { text: `file: ${request.path}` });
    }
  }
  async refresh() {
    const snapshot = await this.plugin.loadSourceStatusSnapshot();
    await this.render(snapshot);
  }
};
var ObsWikiActivityView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return OBS_WIKI_ACTIVITY_VIEW;
  }
  getDisplayText() {
    return "obs-wiki Activity";
  }
  getViewData() {
    return "";
  }
  setViewData(data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    await this.refresh();
  }
  async render(snapshot) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    const header = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    header.createEl("h2", { text: "Agent Activity", cls: "obs-wiki-view__title" });
    const actions = header.createDiv();
    const refreshButton = actions.createEl("button", {
      text: "Refresh",
      cls: "mod-cta"
    });
    refreshButton.addEventListener("click", async () => {
      await this.refresh();
    });
    contentEl.createEl("p", {
      text: this.plugin.settings.showWelcomeMessage ? this.plugin.settings.statusMessage : "Welcome message is disabled. Activity data is shown in read-only mode.",
      cls: "obs-wiki-view__description"
    });
    contentEl.createEl("p", {
      text: `Last refreshed: ${this.plugin.formatDisplayTime(
        Date.parse(snapshot.updatedAt)
      )}`,
      cls: "obs-wiki-view__description"
    });
    const currentSection = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    currentSection.createEl("h3", { text: "Current Task" });
    if (!snapshot.currentTask) {
      currentSection.createEl("p", {
        text: snapshot.missingTaskFolder ? "No agent task folder found at 02_timeline/agent_tasks. Agent/runtime setup should create the memory structure." : "No active or recent agent task found.",
        cls: "obs-wiki-view__description"
      });
    } else {
      this.renderTaskEntry(currentSection, snapshot.currentTask, true);
    }
    const recentTaskSection = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    recentTaskSection.createEl("h3", { text: "Recent Agent Tasks" });
    if (snapshot.recentTasks.length === 0) {
      recentTaskSection.createEl("p", {
        text: "No agent task notes found yet.",
        cls: "obs-wiki-view__description"
      });
    } else {
      const list = recentTaskSection.createEl("ul", {
        cls: "obs-wiki-view__list"
      });
      for (const task of snapshot.recentTasks) {
        const item = list.createEl("li", { cls: "obs-wiki-view__item" });
        this.renderTaskSummary(item, task);
      }
    }
    const auditSection = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    auditSection.createEl("h3", { text: "Recent Audit Events" });
    if (snapshot.recentAuditEvents.length === 0) {
      auditSection.createEl("p", {
        text: snapshot.missingAuditSources ? "No audit source found. Create 00_control/audit_log.md or 00_control/audit/*.md." : "No audit events found yet.",
        cls: "obs-wiki-view__description"
      });
    } else {
      const list = auditSection.createEl("ul", { cls: "obs-wiki-view__list" });
      for (const event of snapshot.recentAuditEvents) {
        const item = list.createEl("li", { cls: "obs-wiki-view__item" });
        item.createEl("div", {
          text: `${this.plugin.formatDisplayTime(event.sortTimestamp)} \u2022 ${event.action} \u2022 ${event.actor}`
        });
        if (event.reason) {
          item.createEl("div", { text: `Reason: ${event.reason}` });
        }
        if (event.target || event.taskId) {
          const extras = [];
          if (event.target) extras.push(`target: ${event.target}`);
          if (event.taskId) extras.push(`task: ${event.taskId}`);
          item.createEl("div", { text: extras.join(" \u2022 ") });
        }
        item.createEl("small", { text: `file: ${event.path}` });
        if (event.snippet) {
          item.createEl("div", {
            text: this.plugin.trimText(event.snippet, 140)
          });
        }
      }
    }
  }
  renderTaskEntry(container, task, expanded) {
    const item = container.createDiv({ cls: "obs-wiki-view__item" });
    item.createEl("div", {
      text: `${this.plugin.formatDisplayTime(task.sortTimestamp)} \u2022 ${task.taskId} \u2022 ${task.agent} \u2022 ${task.status}`
    });
    if (task.objective) {
      item.createEl("div", { text: `Objective: ${task.objective}` });
    }
    if (task.contextPack || task.relatedProject) {
      const extra = [];
      if (task.contextPack) extra.push(`context: ${task.contextPack}`);
      if (task.relatedProject) extra.push(`project: ${task.relatedProject}`);
      item.createEl("div", { text: extra.join(" \u2022 ") });
    }
    if (expanded) {
      const summary = [];
      if (task.startedAt) summary.push(`started ${task.startedAt}`);
      if (task.finishedAt) summary.push(`finished ${task.finishedAt}`);
      summary.push(`reads ${task.memoryReads.length}`);
      summary.push(`writes ${task.memoryWrites.length}`);
      summary.push(`captures ${task.sourceCaptures.length}`);
      summary.push(`proposals ${task.proposals.length}`);
      item.createEl("div", { text: summary.join(" \u2022 ") });
    }
    item.createEl("small", { text: `file: ${task.path}` });
    if (task.snippet) {
      item.createEl("div", {
        text: this.plugin.trimText(task.snippet, 140)
      });
    }
  }
  renderTaskSummary(container, task) {
    const compact = container.createEl("div", {
      text: `${task.taskId} \u2022 ${this.plugin.formatDisplayTime(task.sortTimestamp)} \u2022 ${task.status}`,
      cls: "obs-wiki-view__item"
    });
    if (task.objective) {
      compact.createEl("div", { text: task.objective });
    }
  }
  async refresh() {
    const snapshot = await this.plugin.loadAgentActivitySnapshot();
    await this.render(snapshot);
  }
};
var ObsWikiReviewQueueView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return OBS_WIKI_REVIEW_QUEUE_VIEW;
  }
  getDisplayText() {
    return "Review Queue";
  }
  getViewData() {
    return "";
  }
  setViewData(_data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    await this.refresh();
  }
  async render(snapshot) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Review Queue", cls: "obs-wiki-view__title" });
    const header = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    header.createEl("div", {
      text: `Last refreshed: ${this.plugin.formatDisplayTime(
        Date.parse(snapshot.updatedAt)
      )}`,
      cls: "obs-wiki-view__description"
    });
    const actions = header.createDiv();
    const refreshButton = actions.createEl("button", {
      text: "Refresh",
      cls: "mod-cta"
    });
    refreshButton.addEventListener("click", async () => {
      await this.refresh();
    });
    if (snapshot.missingReviewQueueFolder) {
      contentEl.createEl("p", {
        text: "No review queue folder found at 01_inbox/review_queue. Agent/runtime setup should create the memory structure.",
        cls: "obs-wiki-view__description"
      });
      return;
    }
    if (snapshot.proposals.length === 0) {
      contentEl.createEl("p", {
        text: "No memory proposals in the review queue yet.",
        cls: "obs-wiki-view__description"
      });
      return;
    }
    const sections = this.groupByStatus(snapshot.proposals);
    const orderedStatuses = [
      "pending",
      "revision_requested",
      "approved",
      "applied",
      "deferred",
      "rejected"
    ];
    const unknown = sections["unknown"] || [];
    for (const status of orderedStatuses) {
      const proposals = sections[status] || [];
      if (proposals.length === 0) {
        continue;
      }
      const section = contentEl.createDiv({ cls: "obs-wiki-view__section" });
      section.createEl("h3", { text: `${status.toUpperCase()} (${proposals.length})` });
      for (const proposal of proposals) {
        const card = section.createDiv({ cls: "obs-wiki-view__item" });
        card.createEl("div", {
          text: `${proposal.proposalId} \u2022 ${proposal.proposalKind} \u2022 ${proposal.riskLevel}`
        });
        if (proposal.taskId) {
          card.createEl("div", { text: `Task: ${proposal.taskId}` });
        }
        if (proposal.targetNote) {
          card.createEl("div", { text: `Target: ${proposal.targetNote}` });
        }
        if (proposal.evidence.length > 0) {
          card.createEl("div", { text: `Evidence refs: ${proposal.evidence.join(", ")}` });
        }
        card.createEl("div", {
          text: `Created: ${proposal.created || "unknown"} \u2022 Proposed by: ${proposal.proposedBy}`
        });
        if (proposal.snippet) {
          card.createEl("div", {
            text: this.plugin.trimText(proposal.snippet, 140)
          });
        }
        card.createEl("small", { text: `file: ${proposal.path}` });
        if (proposal.approvalStatus === "pending") {
          const actionRow = card.createDiv({ cls: "obs-wiki-view__actions" });
          const approve = actionRow.createEl("button", {
            text: "Approve",
            cls: "mod-cta"
          });
          const reject = actionRow.createEl("button", {
            text: "Reject",
            cls: "mod-warning"
          });
          const defer = actionRow.createEl("button", {
            text: "Defer"
          });
          const requestRevision = actionRow.createEl("button", {
            text: "Request Revision"
          });
          const actionButtons = [approve, reject, defer, requestRevision];
          const updateStatus = async (status2) => {
            for (const button of actionButtons) {
              button.setAttribute("disabled", "true");
            }
            try {
              await this.plugin.updateMemoryProposalStatus(proposal, status2);
              await this.refresh();
            } finally {
              for (const button of actionButtons) {
                button.removeAttribute("disabled");
              }
            }
          };
          approve.addEventListener("click", () => void updateStatus("approved"));
          reject.addEventListener("click", () => void updateStatus("rejected"));
          defer.addEventListener("click", () => void updateStatus("deferred"));
          requestRevision.addEventListener("click", () => void updateStatus("revision_requested"));
        } else if (proposal.approvalStatus === "approved") {
          const actionRow = card.createDiv({ cls: "obs-wiki-view__actions" });
          const apply = actionRow.createEl("button", {
            text: "Apply Approved Writeback",
            cls: "mod-cta"
          });
          apply.addEventListener("click", () => {
            new import_obsidian.Notice("Approved writeback must be applied by the Runtime. Runtime trigger wiring is planned for the next batch.");
          });
        }
      }
    }
    if (unknown.length > 0) {
      const section = contentEl.createDiv({ cls: "obs-wiki-view__section" });
      section.createEl("h3", {
        text: `UNKNOWN (${unknown.length})`
      });
      for (const proposal of unknown) {
        const card = section.createDiv({ cls: "obs-wiki-view__item" });
        card.createEl("div", {
          text: `${proposal.proposalId} \u2022 status: ${proposal.approvalStatus}`
        });
      }
    }
  }
  async refresh() {
    const snapshot = await this.plugin.loadMemoryReviewQueueSnapshot();
    await this.render(snapshot);
  }
  groupByStatus(proposals) {
    const grouped = {};
    for (const proposal of proposals) {
      const status = proposal.approvalStatus || "pending";
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(proposal);
    }
    return grouped;
  }
};
var ObsWikiMemoryInspectorView = class extends import_obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return OBS_WIKI_MEMORY_INSPECTOR_VIEW;
  }
  getDisplayText() {
    return "Memory Inspector";
  }
  getViewData() {
    return "";
  }
  setViewData(_data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Memory Inspector", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: "Scaffold placeholder: note source, claim, evidence, and agent usage inspection will be added later.",
      cls: "obs-wiki-view__description"
    });
  }
};
var ObsWikiAuditLogView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return OBS_WIKI_AUDIT_LOG_VIEW;
  }
  getDisplayText() {
    return "Audit Log";
  }
  getViewData() {
    return "";
  }
  setViewData(_data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Audit Log", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: "Scaffold placeholder: detailed agent, runtime, plugin, and user audit timeline will be added later. Recent audit events are visible in Agent Activity.",
      cls: "obs-wiki-view__description"
    });
  }
};
var ObsWikiRuntimeStatusView = class extends import_obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return OBS_WIKI_RUNTIME_STATUS_VIEW;
  }
  getDisplayText() {
    return "Runtime Status";
  }
  getViewData() {
    return "";
  }
  setViewData(_data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Runtime Status", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: "Scaffold placeholder: MCP server, runtime index, context pack, lint, and source-analysis status will be added later.",
      cls: "obs-wiki-view__description"
    });
  }
};
var ObsWikiPermissionPolicyView = class extends import_obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return OBS_WIKI_PERMISSION_POLICY_VIEW;
  }
  getDisplayText() {
    return "Permission Policy";
  }
  getViewData() {
    return "";
  }
  setViewData(_data, _clear) {
    return;
  }
  clear() {
    this.contentEl.empty();
  }
  async onOpen() {
    await super.onOpen();
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Permission Policy", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: "Scaffold placeholder: policy display for Agent write allowlist, protected folders, and review requirements will be added later.",
      cls: "obs-wiki-view__description"
    });
    const section = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    section.createEl("h3", { text: "Planned controls" });
    const list = section.createEl("ul", { cls: "obs-wiki-view__list" });
    list.createEl("li", { text: "Agent read scope", cls: "obs-wiki-view__item" });
    list.createEl("li", { text: "Agent write scope", cls: "obs-wiki-view__item" });
    list.createEl("li", { text: "Source capture policy", cls: "obs-wiki-view__item" });
    list.createEl("li", { text: "Protected folders", cls: "obs-wiki-view__item" });
  }
};
var ObsWikiSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "obs-wiki" });
    new import_obsidian.Setting(containerEl).setName("Show welcome message").setDesc("Display a welcome/status line in the Activity view.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showWelcomeMessage).onChange(async (value) => {
        this.plugin.settings.showWelcomeMessage = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Status message").setDesc("Text shown in Activity when welcome messages are enabled.").addText(
      (text) => text.setPlaceholder(this.plugin.settings.statusMessage).setValue(this.plugin.settings.statusMessage).onChange(async (value) => {
        this.plugin.settings.statusMessage = value || "Welcome to obs-wiki Agent Activity.";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default agent scope").setDesc("Reserved for later use while wiring permission controls.").setDisabled(true).addText((text) => {
      text.setValue(this.plugin.settings.defaultAgentScope);
    });
  }
};
//# sourceMappingURL=main.js.map
