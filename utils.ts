import { requestUrl } from "obsidian";

/**
 * 
 * @param fn - 一个可能会抛出异常，但我们希望在调用时忽略异常的函数。
 * @returns 
 */
export function slient(fn: () => unknown): unknown | undefined {
    try {
        return fn();
    } catch (e) {
        e;
    }
}

export const obsidianFetch: typeof fetch = async (input, init = {}) => {
    try {
        const res = await requestUrl({
            url: typeof input === "string" ? input : input.toString(),
            method: init.method ?? "GET",
            headers: init.headers as Record<string, string>,
            body: init.body as string | ArrayBuffer,
            // @ts-ignore
            agent: init.agent as HttpsProxyAgent | undefined,
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