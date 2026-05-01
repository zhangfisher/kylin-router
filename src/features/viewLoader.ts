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
import { sanitizeHTML } from "@/utils/sanitizeHTML";

/**
 * ViewLoader 类 - 负责加载视图组件
 * 继承自 RouteDataLoaderBase 基类
 */
export class ViewLoader extends RouteDataLoaderBase<"view", KylinRouteViewOptions, string> {
    constructor(router: KylinRouter) {
        super(
            router,
            "view",
            Object.assign(
                {
                    allowUnsafe: true,
                    datatype: "text",
                },
                router.options.viewOptions,
            ) as Required<Omit<KylinRouteViewOptions, "from">>,
        );
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
            const mergedOptions = Object.assign({}, this.options, options || {}, {
                from: viewSource,
            }) as Required<KylinRouteViewOptions>;

            // 执行加载
            this.startLoad(
                tempMatched,
                mergedOptions,
                this._getRouteHash(mergedOptions, tempMatched),
            );

            // 等待加载完成
            const signal = this.getLoadSignal(tempMatched);
            if (!signal) {
                return {
                    success: false,
                    content: null,
                    error: new Error("Failed to create load signal"),
                };
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

    /**
     * 智能内容提取 - 从 HTML 中提取有效内容
     * @param html - 原始 HTML 字符串
     * @param selector - 自定义选择器（可选）
     * @returns 提取后的内容
     */
    protected onHandleData(html: string, options: KylinRouteViewOptions): string {
        const { selector, allowUnsafe } = options;
        let htmlResult: string = html;
        try {
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
                htmlResult = body ? body.innerHTML : html;
            }
            // 检查是否有 data-outlet 属性的元素（D-02）
            const outletMatch = html.match(/<[^>]+data-outlet[^>]*>([\s\S]*?)<\/[^>]+>/);
            if (outletMatch) {
                htmlResult = outletMatch[1];
            }
            htmlResult = html;
        } catch (e: any) {
            this.router.logger.error(`视图内容提取失败: ${e.message}`);
        }
        if (!allowUnsafe) {
            htmlResult = sanitizeHTML(htmlResult);
        }
        return htmlResult;
    }
}
