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
    this.addSettingTab(new ObsWikiSettingTab(this.app, this));
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
