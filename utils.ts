
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