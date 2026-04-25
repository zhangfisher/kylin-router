/**
 * Loader 特性 - 视图加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/viewLoader
 */

import type { KylinRouter } from "@/router";
import type { KylinMatchedRouteItem, KylinRouteViewOptions } from "@/types/routes";
import { RouteDataLoaderBase } from "./baseLoader";
import type { IAsyncSignal } from "asyncsignal";
import { sanitizeHTML } from "@/utils/sanitizeHTML";

/**
 * ViewLoader 类 - 负责加载视图组件
 * 继承自 RouteDataLoaderBase 基类
 */
export class ViewLoader extends RouteDataLoaderBase<
    "view",
    KylinRouteViewOptions,
    string | HTMLElement
> {
    constructor(router: KylinRouter) {
        super(
            router,
            "view", // loadType
            Object.assign(
                {
                    allowUnsafe: true,
                },
                router.options.viewOptions,
            ) as Required<Omit<KylinRouteViewOptions, "from">>,
        );
    }

    // ========================================
    // 实现抽象方法
    // ========================================

    /**
     * 处理远程加载的响应
     * ViewLoader 使用 response.text() 解析 HTML 内容
     */
    protected async processRemoteResponse(
        response: Response,
        options: KylinRouteViewOptions,
        _signal: IAsyncSignal,
    ): Promise<string | HTMLElement> {
        let html = await response.text();
        html = this.extractContent(html, options.selector);
        if (!options.allowUnsafe) {
            html = sanitizeHTML(html);
        }
        return html;
    }

    /**
     * 验证数据类型
     * ViewLoader 接受字符串或 HTMLElement
     */
    protected validateDataType(data: unknown): data is string | HTMLElement {
        return typeof data === "string" || data instanceof HTMLElement;
    }

    /**
     * 判断是否应该缓存
     * ViewLoader 只缓存字符串类型的视图
     */
    protected shouldCacheData(data: string | HTMLElement): boolean {
        return typeof data === "string";
    }

    // ========================================
    // 保持公共 API
    // ========================================

    /**
     * 并发加载匹配路由的视图
     * @param routes - 匹配的路由数组
     */
    async loadViews(routes: KylinMatchedRouteItem[]) {
        return this.loadRoutes(routes);
    }

    /**
     * 加载单个视图资源（用于 modal 等特殊场景）
     * @param viewSource - 视图源（URL、元素名或函数）
     * @param options - 可选的加载选项
     * @returns 加载结果
     */
    async loadView(
        viewSource: string | (() => Promise<any>),
        options?: Partial<KylinRouteViewOptions>,
    ): Promise<{ success: boolean; content: string | HTMLElement | null; error?: Error }> {
        try {
            // 创建临时的匹配路由项用于加载
            const tempMatched: KylinMatchedRouteItem = {
                route: {
                    name: "__temp__",
                    path: "/__temp__",
                    view: viewSource,
                    ...options,
                } as any,
                params: {},
                query: {},
                state: {},
                path: "/__temp__",
                url: "/__temp__",
                hash: "",
            };

            // 合并选项
            const mergedOptions = Object.assign(
                {},
                this.options,
                options || {},
                { from: viewSource },
            ) as Required<KylinRouteViewOptions>;

            // 执行加载
            this.executeLoad(tempMatched, mergedOptions, this._getRouteHash(mergedOptions, tempMatched));

            // 等待加载完成
            const signal = this.getLoadSignal(tempMatched);
            if (!signal) {
                return { success: false, content: null, error: new Error("Failed to create load signal") };
            }

            // 等待 signal 完成
            const content = await new Promise<string | HTMLElement>((resolve, reject) => {
                const checkSignal = () => {
                    if (signal.isFulfilled()) {
                        resolve(signal.result as string | HTMLElement);
                    } else if (signal.isRejected()) {
                        reject(signal.error);
                    } else {
                        // 继续等待
                        setTimeout(checkSignal, 10);
                    }
                };
                checkSignal();
            });

            return { success: true, content };
        } catch (error) {
            return { success: false, content: null, error: error as Error };
        }
    }

    // ========================================
    // 保留 ViewLoader 特有方法
    // ========================================

    /**
     * 智能内容提取 - 从 HTML 中提取有效内容
     * @param html - 原始 HTML 字符串
     * @param selector - 自定义选择器（可选）
     * @returns 提取后的内容
     */
    private extractContent(html: string, selector?: string): string {
        // 如果提供了自定义选择器，使用它
        if (selector) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const element = doc.querySelector(selector);
            return element ? element.innerHTML : html;
        }

        // 检查是否包含完整的 HTML 文档
        if (html.includes("<html") || html.includes("<HTML")) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            // 提取 body 内容
            const body = doc.body;
            return body ? body.innerHTML : html;
        }

        // 检查是否有 data-outlet 属性的元素（D-02）
        const outletMatch = html.match(/<[^>]+data-outlet[^>]*>([\s\S]*?)<\/[^>]+>/);
        if (outletMatch) {
            return outletMatch[1];
        }

        // 检查是否有 body 标签（但没有 html 标签）
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            return bodyMatch[1];
        }

        // 返回原始内容
        return html;
    }

}
