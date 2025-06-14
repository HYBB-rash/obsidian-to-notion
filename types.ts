export interface PluginSettings {
	notionAPI: string;
	bannerUrl: string;
	notionID: string;
	proxy: string;
	allowTags: boolean;
}

export interface yamlObj {
	[key: string]: any;
	__content: string;
}

export interface NotionPageResponse {
	id: string;
	url: string;
	properties: Record<string, unknown>;
	created_time: string;
	last_edited_time: string;
	icon?: {
		type: string;
		emoji?: string;
		external?: {
			url: string;
		};
	};
	cover?: {
		type: string;
		external?: {
			url: string;
		};
		file?: {
			url: string;
			expiry_time: string;
		};
	};
	archived: boolean;
	parent: {
		type: string;
		database_id?: string;
		page_id?: string;
		workspace?: boolean;
	};
	children?: Array<{
		object: string;
		id: string;
		type: string;
		[key: string]: any; // 其他可能的属性
	}>;
}
