import { requestUrl, TFile, normalizePath, App } from "obsidian";
import { Client } from "@notionhq/client";
import { markdownToBlocks } from "@tryfabric/martian";
import * as yamlFrontMatter from "yaml-front-matter";
import * as yaml from "yaml";
import MyPlugin from "main";

import { HttpsProxyAgent } from "https-proxy-agent";

const obsidianFetch: typeof fetch = async (input, init = {}) => {
	try {
		const res = await requestUrl({
			url: typeof input === "string" ? input : input.toString(),
			method: init.method ?? "GET",
			headers: init.headers as Record<string, string>,
			body: init.body as any,
			// @ts-ignore
			agent: init.agent as any,
			// 不写 throw，默认就是 true
		});

		return new Response(res.arrayBuffer, {
			status: res.status,
			// statusText: res.status,
			headers: res.headers,
		});
	} catch (e) {
		console.error(
			"Request failed:",
			e.status ?? e.code,
			"err msg:",
			e.message
		);

		if (e.body) {
			const bodyText =
				typeof e.body === "string"
					? e.body
					: Buffer.isBuffer(e.body)
					? e.body.toString("utf8")
					: "";
			console.error("Error body:", bodyText);
		}

		throw e;
		// throw new Error(`Request failed: ${e.status ?? e.code} ${e.message}`);
	}
};

export class Upload2Notion {
	app: MyPlugin;
	notion: Client;
	agent: any;

	constructor(app: MyPlugin) {
		this.app = app;
		this.agent = new HttpsProxyAgent(this.app.settings.proxy);
		this.notion = new Client({
			auth: this.app.settings.notionAPI,
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
		notionID: string,
		title: string,
		allowTags: boolean,
		tags: string[],
		childArr: any
	) {
		await this.deletePage(notionID);
		const res = await this.createPage(
			title,
			allowTags,
			tags,
			childArr
		);
		return res;
	}

	async createPage(
		title: string,
		allowTags: boolean,
		tags: string[],
		childArr: any
	) {
		try {
			const response = await this.notion.pages.create({
				parent: {
					database_id: this.app.settings.databaseID,
				},
				properties: {
					Name: {
						type: "title",
						title: [
							{
								type: "text",
								text: {
									content: title,
								},
							},
						],
					},
				},
				children: childArr,
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
		markdown: string,
		nowFile: TFile,
		app: App,
		settings: any
	): Promise<any> {
		let res: any;
		const yamlObj: any = yamlFrontMatter.loadFront(markdown);
		const __content = yamlObj.__content;
		const file2Block = markdownToBlocks(__content);
		const frontmasster = await app.metadataCache.getFileCache(nowFile)
			?.frontmatter;
		const notionID = frontmasster ? frontmasster.notionID : null;

		if (notionID) {
			res = await this.updatePage(
				notionID,
				title,
				allowTags,
				tags,
				file2Block
			);
		} else {
			res = await this.createPage(
				title,
				allowTags,
				tags,
				file2Block
			);
			console.log("create new page res", res);
		}
		await this.updateYamlInfo(markdown, nowFile, res, app, settings);

		return res;
	}
	async updateYamlInfo(
		yamlContent: string,
		nowFile: TFile,
		res: any,
		app: App,
		settings: any
	) {

		const yamlObj: Record<string, any> = yamlFrontMatter.loadFront(yamlContent);

		let { url, id } = res;
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
}
