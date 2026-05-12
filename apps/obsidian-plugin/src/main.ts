import { App, ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

const OBS_WIKI_ACTIVITY_VIEW = 'obs-wiki-activity';
const OBS_WIKI_REVIEW_QUEUE_VIEW = 'obs-wiki-review-queue';
const OBS_WIKI_PERMISSION_CENTER_VIEW = 'obs-wiki-permission-center';

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
			id: 'open-permission-center',
			name: 'Open Permission Center',
			callback: () => this.openPluginView(OBS_WIKI_PERMISSION_CENTER_VIEW),
		});

		this.addSettingTab(new ObsWikiSettingTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Agent Activity', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: this.plugin.settings.showWelcomeMessage
				? this.plugin.settings.statusMessage
				: 'Welcome message is disabled. Activity view is in scaffold mode.',
			cls: 'obs-wiki-view__description',
		});

		const overview = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		overview.createEl('h3', { text: 'Current Activity' });
		const list = overview.createEl('ul', { cls: 'obs-wiki-view__list' });
		list.createEl('li', { text: 'Current Agent task: not connected yet', cls: 'obs-wiki-view__item' });
		list.createEl('li', { text: 'Recent context pack reads: not connected yet', cls: 'obs-wiki-view__item' });
		list.createEl('li', { text: 'Recent proposals: not connected yet', cls: 'obs-wiki-view__item' });
		list.createEl('li', { text: 'Recent audit events: not connected yet', cls: 'obs-wiki-view__item' });
	}
}

class ObsWikiReviewQueueView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
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
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obs-wiki-view-root');

		contentEl.createEl('h2', { text: 'Review Queue', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: 'Scaffold placeholder: Review Queue is a static view for future approval actions.',
			cls: 'obs-wiki-view__description',
		});

		const section = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		section.createEl('h3', { text: 'Queued items (placeholder)' });
		const list = section.createEl('ul', { cls: 'obs-wiki-view__list' });
		list.createEl('li', {
			text: 'memory-proposal note: pending approval (placeholder)',
			cls: 'obs-wiki-view__item',
		});
		list.createEl('li', {
			text: 'source analysis request: pending verification (placeholder)',
			cls: 'obs-wiki-view__item',
		});
		list.createEl('li', {
			text: 'knowledge claim review: not connected yet (placeholder)',
			cls: 'obs-wiki-view__item',
		});
	}
}

class ObsWikiPermissionCenterView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return OBS_WIKI_PERMISSION_CENTER_VIEW;
	}

	getDisplayText() {
		return 'Permission Center';
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

		contentEl.createEl('h2', { text: 'Permission Center', cls: 'obs-wiki-view__title' });
		contentEl.createEl('p', {
			text: 'Scaffold placeholder: permission configuration UI will be added later.',
			cls: 'obs-wiki-view__description',
		});

		const section = contentEl.createDiv({ cls: 'obs-wiki-view__section' });
		section.createEl('h3', { text: 'Planned controls' });
		const list = section.createEl('ul', { cls: 'obs-wiki-view__list' });
		list.createEl('li', { text: 'Agent read scope', cls: 'obs-wiki-view__item' });
		list.createEl('li', { text: 'Agent write scope', cls: 'obs-wiki-view__item' });
		list.createEl('li', { text: 'Source capture policy', cls: 'obs-wiki-view__item' });
		list.createEl('li', { text: 'Protected folders', cls: 'obs-wiki-view__item' });
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
						this.plugin.settings.statusMessage = value || 'Welcome to obs-wiki Agent Activity.';
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
