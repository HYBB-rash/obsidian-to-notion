import * as yamlFrontMatter from "yaml-front-matter";
import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	Setting,
	PluginSettingTab,
} from "obsidian";

import { addIcons } from "icon";
import { Upload2Notion } from "Upload2Notion";
import { NoticeMConfig } from "Message";
import { slient } from "utils";
import { PluginSettings, yamlObj } from "types";

// Remember to rename these classes and interfaces!

const langConfig = NoticeMConfig(
	window.localStorage.getItem("language") || "en"
);

const DEFAULT_SETTINGS: PluginSettings = {
	notionAPI: "",
	databaseID: "",
	bannerUrl: "",
	notionID: "",
	proxy: "",
	allowTags: false,
};

export default class ObsidianSyncNotionPlugin extends Plugin {
	settings: PluginSettings;
	async onload() {
		try {
			await this.loadSettings();
			addIcons();
			// This creates an icon in the left ribbon.
			this.addRibbonIcon(
				"notion-logo",
				"Share to notion",
				async (evt: MouseEvent) => {
					// Called when the user clicks the icon.
					this.upload();
				}
			);

			// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
			this.addStatusBarItem();
			// statusBarItemEl.setText("share to notion");

			this.addCommand({
				id: "share-to-notion",
				name: "share to notion",
				editorCallback: async (editor: Editor, view: MarkdownView) => {
					this.upload();
				},
			});

			// This adds a settings tab so the user can configure various aspects of the plugin
			this.addSettingTab(new SampleSettingTab(this.app, this));
		} catch (error) {
			console.error("Error loading plugin settings:", error);
			new Notice(error.message || "Failed to load plugin settings");
		}
	}

	onunload() {}

	async upload() {
		slient(this.uploadPicture.bind(this));
		const { notionAPI, databaseID, allowTags } = this.settings;
		if (notionAPI === "" || databaseID === "") {
			new Notice(
				"Please set up the notion API and database ID in the settings tab."
			);
			return;
		}
		const { markDownData, nowFile, tags } =
			await this.getNowFileMarkdownContent(this.app);

		if (markDownData) {
			const { basename } = nowFile;
			const upload = new Upload2Notion(this);
			const yamlObj: yamlObj=
				yamlFrontMatter.loadFront(markDownData);
			yamlObj.databaseId = this.getDatabaseID(yamlObj);
			console.log(yamlObj.databaseId);
			try {
				await upload.syncMarkdownToNotion(
					basename,
					allowTags,
					tags,
					yamlObj,
					yamlObj.__content,
					nowFile,
					this.app,
					this.settings
				);
				new Notice(`${langConfig["sync-success"]}${basename}`);
			} catch (error) {
				new Notice(`${langConfig["sync-fail"]}${basename}`, 5000);
			}
		}
	}

	/**
	 * 
	 * @param yamlObj yamlObj markdonw yaml front matter object
	 * @description 读取yamlObj中的 database 的 notion url，抽取出 databaseID 到 settings 中
	 * @return {string | undefined} 返回抽取出的 databaseID
	 */
	private getDatabaseID(yamlObj: yamlObj) : string | undefined {
		if (yamlObj.NotionDatabaseUrl) {
			const notionUrl = yamlObj.NotionDatabaseUrl as string;
			const pathName = new URL(notionUrl).pathname;
			const databaseID = pathName.split("/").pop();
			if (databaseID) {
				return databaseID;
			}
		}
	}

	private async uploadPicture() {
		try {
			const toolkit = this.app.plugins.getPlugin("image-upload-toolkit");
			if (!toolkit) {
				new Notice(
					"Please install the image upload toolkit plugin first."
				);
				return;
			}
			toolkit.publish();
		} catch (error) {
			console.error("Error uploading picture:", error);
			new Notice("Failed to upload picture. Please try again.");
		}
	}

	async getNowFileMarkdownContent(app: App) {
		const nowFile = app.workspace.getActiveFile();
		const { allowTags } = this.settings;
		let tags = [];
		try {
			if (allowTags) {
				tags = app.metadataCache.getFileCache(nowFile).frontmatter.tags;
			}
		} catch (error) {
			new Notice(langConfig["set-tags-fail"]);
		}
		if (nowFile) {
			const markDownData = await nowFile.vault.read(nowFile);
			return {
				markDownData,
				nowFile,
				tags,
			};
		} else {
			new Notice(langConfig["open-file"]);
			return;
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ObsidianSyncNotionPlugin;

	constructor(app: App, plugin: ObsidianSyncNotionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Settings for obsidian to notion plugin.",
		});

		new Setting(containerEl)
			.setName("Proxy Setting")
			.setDesc("Proxy Settings Agent")
			.addText((text) => {
				let t = text
					.setPlaceholder(
						"Enter your http proxy agent, like: http://127.0.0.1:8899"
					)
					.setValue(this.plugin.settings.proxy)
					.onChange(async (value) => {
						this.plugin.settings.proxy = value;
						await this.plugin.saveSettings();
					});
				return t;
			});

		new Setting(containerEl)
			.setName("Notion API Token")
			.setDesc("It's a secret")
			.addText((text) => {
				let t = text
					.setPlaceholder("Enter your Notion API Token")
					.setValue(this.plugin.settings.notionAPI)
					.onChange(async (value) => {
						this.plugin.settings.notionAPI = value;
						await this.plugin.saveSettings();
					});
				// t.inputEl.type = 'password'
				return t;
			});

		// notionDatabaseID.controlEl.querySelector('input').type='password'

		new Setting(containerEl)
			.setName("Banner url(optional)")
			.setDesc(
				"page banner url(optional), default is empty, if you want to show a banner, please enter the url(like:https://raw.githubusercontent.com/EasyChris/obsidian-to-notion/ae7a9ac6cf427f3ca338a409ce6967ced9506f12/doc/2.png)"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter banner pic url: ")
					.setValue(this.plugin.settings.bannerUrl)
					.onChange(async (value) => {
						this.plugin.settings.bannerUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Notion ID(optional)")
			.setDesc(
				"Your notion ID(optional),share link likes:https://username.notion.site/,your notion id is [username]"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter notion ID(options) ")
					.setValue(this.plugin.settings.notionID)
					.onChange(async (value) => {
						this.plugin.settings.notionID = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Convert tags(optional)")
			.setDesc(
				"Transfer the Obsidian tags to the Notion table. It requires the column with the name 'Tags'"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.allowTags)
					.onChange(async (value) => {
						this.plugin.settings.allowTags = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
