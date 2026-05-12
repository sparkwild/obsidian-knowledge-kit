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
var OBS_WIKI_REVIEW_QUEUE_VIEW = "obs-wiki-review-queue";
var OBS_WIKI_PERMISSION_CENTER_VIEW = "obs-wiki-permission-center";
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
  dashboards: "00_control/dashboards"
};
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
      OBS_WIKI_ACTIVITY_VIEW,
      (leaf) => new ObsWikiActivityView(leaf, this)
    );
    this.registerView(
      OBS_WIKI_REVIEW_QUEUE_VIEW,
      (leaf) => new ObsWikiReviewQueueView(leaf)
    );
    this.registerView(
      OBS_WIKI_PERMISSION_CENTER_VIEW,
      (leaf) => new ObsWikiPermissionCenterView(leaf)
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
      id: "open-permission-center",
      name: "Open Permission Center",
      callback: () => this.openPluginView(OBS_WIKI_PERMISSION_CENTER_VIEW)
    });
    this.addCommand({
      id: "initialize-memory-structure",
      name: "Initialize Memory Structure",
      callback: () => this.promptInitializeMemoryStructure()
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
    const missingFolders = foldersToCreate.filter((path) => this.app.vault.getAbstractFileByPath(path) === null);
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
        await this.ensureFileDoesNotExist(CONTROL_PATHS.auditLog, this.buildAuditLogHeader());
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
    const auditPath = this.buildAuditLogPath();
    const auditFile = this.app.vault.getAbstractFileByPath(auditPath);
    if (!auditFile) {
      await this.ensureFileDoesNotExist(auditPath, this.buildAuditLogHeader() + event);
      return;
    }
    if (auditFile instanceof import_obsidian.TFile) {
      const current = await this.app.vault.read(auditFile);
      const normalized = current.endsWith("\n") ? current : `${current}
`;
      const separator = normalized.length > 0 ? "\n" : "";
      await this.app.vault.modify(auditFile, `${normalized}${separator}${event}`);
      return;
    }
    throw new Error(`Cannot append audit log: ${auditPath} already exists as a folder.`);
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
  async saveSettings() {
    await this.saveData(this.settings);
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
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Agent Activity", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: this.plugin.settings.showWelcomeMessage ? this.plugin.settings.statusMessage : "Welcome message is disabled. Activity view is in scaffold mode.",
      cls: "obs-wiki-view__description"
    });
    const overview = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    overview.createEl("h3", { text: "Current Activity" });
    const list = overview.createEl("ul", { cls: "obs-wiki-view__list" });
    list.createEl("li", { text: "Current Agent task: not connected yet", cls: "obs-wiki-view__item" });
    list.createEl("li", { text: "Recent context pack reads: not connected yet", cls: "obs-wiki-view__item" });
    list.createEl("li", { text: "Recent proposals: not connected yet", cls: "obs-wiki-view__item" });
    list.createEl("li", { text: "Recent audit events: not connected yet", cls: "obs-wiki-view__item" });
  }
};
var ObsWikiReviewQueueView = class extends import_obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
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
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obs-wiki-view-root");
    contentEl.createEl("h2", { text: "Review Queue", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: "Scaffold placeholder: Review Queue is a static view for future approval actions.",
      cls: "obs-wiki-view__description"
    });
    const section = contentEl.createDiv({ cls: "obs-wiki-view__section" });
    section.createEl("h3", { text: "Queued items (placeholder)" });
    const list = section.createEl("ul", { cls: "obs-wiki-view__list" });
    list.createEl("li", {
      text: "memory-proposal note: pending approval (placeholder)",
      cls: "obs-wiki-view__item"
    });
    list.createEl("li", {
      text: "source analysis request: pending verification (placeholder)",
      cls: "obs-wiki-view__item"
    });
    list.createEl("li", {
      text: "knowledge claim review: not connected yet (placeholder)",
      cls: "obs-wiki-view__item"
    });
  }
};
var ObsWikiPermissionCenterView = class extends import_obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return OBS_WIKI_PERMISSION_CENTER_VIEW;
  }
  getDisplayText() {
    return "Permission Center";
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
    contentEl.createEl("h2", { text: "Permission Center", cls: "obs-wiki-view__title" });
    contentEl.createEl("p", {
      text: "Scaffold placeholder: permission configuration UI will be added later.",
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
