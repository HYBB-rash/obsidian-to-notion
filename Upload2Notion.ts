import * as yaml from "yaml";
import { TFile, App } from "obsidian";
import {
	BlockObjectRequest,
	Client,
	CreatePageResponse,
	PageObjectResponse,
} from "@notionhq/client";
import { markdownToBlocks } from "@tryfabric/martian";
import { HttpsProxyAgent } from "https-proxy-agent";
import { PluginSettings, yamlObj } from "types";
import { Block } from "@tryfabric/martian/build/src/notion";

import MyPlugin from "main";
import { obsidianFetch } from "utils";

export class Upload2Notion {
	app: App;
	plugin: MyPlugin;
	notion: Client;
	agent: HttpsProxyAgent;

	constructor(plugin: MyPlugin) {
		this.app = plugin.app;
		this.plugin = plugin;
		this.agent = new HttpsProxyAgent(this.plugin.settings.proxy);
		this.notion = new Client({
			auth: this.plugin.settings.notionAPI,
			fetch: obsidianFetch,
			agent: this.agent,
		});
	}

	async deletePage(notionID: string) {
		const response = this.notion.blocks.delete({
			block_id: notionID,
		});
		return response;
	}

	// 因为需要解析notion的block进行对比，非常的麻烦，
	// 暂时就直接删除，新建一个page
	async updatePage(
		databaseId: string,
		notionID: string,
		yamlObj: yamlObj,
		allowTags: boolean,
		tags: string[],
		childArr: Block[]
	): Promise<CreatePageResponse> {
		await this.deletePage(notionID);
		const res = await this.createPage(
			databaseId,
			yamlObj,
			allowTags,
			tags,
			childArr
		);
		return res;
	}

	async createPage(
		databaseId: string,
		yamlObj: yamlObj,
		allowTags: boolean,
		tags: string[],
		childArr: Block[]
	): Promise<CreatePageResponse> {
		try {
			const submitProperties = await this.buildNotionPropertiesByYaml(yamlObj);
			console.log("submitProperties", submitProperties);
			const response = await this.notion.pages.create({
				parent: {
					database_id: databaseId,
				},
				properties: submitProperties,
				children: childArr as BlockObjectRequest[],
			});
			return response;
		} catch (error) {
			throw new Error(`创建页面失败: ${error.message}`);
		}
	}
	async syncMarkdownToNotion(
		title: string,
		allowTags: boolean,
		tags: string[],
		yamlObj: yamlObj,
		markdown: string,
		nowFile: TFile,
		app: App,
		settings: PluginSettings
	): Promise<CreatePageResponse> {
		let res: CreatePageResponse;
		const file2Block = markdownToBlocks(markdown);
		const frontmasster = await app.metadataCache.getFileCache(nowFile)
			?.frontmatter;
		const notionID = frontmasster ? frontmasster.notionID : null;

		if (notionID) {
			res = await this.updatePage(
				yamlObj.databaseId,
				notionID,
				yamlObj,
				allowTags,
				tags,
				file2Block
			);
		} else {
			res = await this.createPage(
				yamlObj.databaseId,
				yamlObj,
				allowTags,
				tags,
				file2Block
			);
			console.log("create new page res", res);
		}
		await this.updateYamlInfo(
			yamlObj,
			markdown,
			nowFile,
			res,
			app,
			settings
		);

		return res;
	}
	async updateYamlInfo(
		yamlObj: yamlObj,
		yamlContent: string,
		nowFile: TFile,
		res: CreatePageResponse,
		app: App,
		settings: PluginSettings
	) {
		// eslint-disable-next-line prefer-const
		let { url, id } = res as PageObjectResponse;

		// replace www to notionID
		const { notionID } = settings;
		if (notionID !== "") {
			// replace url str "www" to notionID
			url = url.replace("www.notion.so", `${notionID}.notion.site`);
		}
		yamlObj.link = url;
		try {
			await navigator.clipboard.writeText(url);
		} catch (error) {
			throw new Error(`复制链接失败，请手动复制${error}`);
		}
		yamlObj.notionID = id;
		const __content = yamlObj.__content;
		delete yamlObj.__content;
		const yamlhead = yaml.stringify(yamlObj);
		//  if yamlhead hava last \n  remove it
		const yamlhead_remove_n = yamlhead.replace(/\n$/, "");
		// if __content have start \n remove it
		const __content_remove_n = __content.replace(/^\n/, "");
		const content =
			"---\n" + yamlhead_remove_n + "\n---\n" + __content_remove_n;
		try {
			await nowFile.vault.modify(nowFile, content);
		} catch (error) {
			throw new Error(`write file error ${error}`);
		}
	}

	async buildNotionPropertiesByYaml(
		yamlObj: yamlObj
	): Promise<Record<string, any>> {

		const properties = (await this.notion.databases.retrieve({
			database_id: yamlObj.databaseId,
		}))?.properties;

		if (!properties) {
			throw new Error("No properties found in the database.");
		}

		const list = Object.keys(properties).map((customName) => {
			return [customName, this.buildPropertyObject(customName, properties[customName].type, yamlObj)];
		});

		return Object.fromEntries(list);
	}

	private buildPropertyObject(customName: string, customType: string, customValues: Record<string, any>) {
		const value = customValues[customName] || '';

		switch (customType) {
			case "title":
				return {
					title: [
						{
							text: {
								content: value,
							},
						},
					],
				};
			case "rich_text":
				return {
					rich_text: [
						{
							text: {
								content: value || '',
							},
						},
					],
				};
			case "date":
				return {
					date: {
						start: value || new Date().toISOString(),
					},
				};
			case "number":
				return {
					number: Number(value),
				};
			case "phone_number":
				return {
					phone_number: value,
				};
			case "email":
				return {
					email: value,
				};
			case "url":
				return {
					url: value,
				};
			case "files":
				return {
					files: Array.isArray(value) ? value.map(url => ({
						name: url,
						type: "external",
						external: {
							url: url,
						},
					})) : [
						{
							name: value,
							type: "external",
							external: {
								url: value,
							},
						},
					],
				};
			case "checkbox":
				return {
					checkbox: Boolean(value) || false,
				};
			case "select":
				return {
					select: {
						name: value,
					},
				};
			case "multi_select":
				return {
					multi_select: Array.isArray(value) ? value.map(item => ({name: item})) : [{name: value}],
				};
		}
	}
}
