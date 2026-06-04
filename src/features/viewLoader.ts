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
import { scopeStyles } from "@/utils/scopeStyle";
import type { IAsyncSignal } from "asyncsignal";

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
    ) {}

    /**
     * 智能内容提取 - 从 HTML 中提取有效内容
     * @param html - 原始 HTML 字符串
     * @param options - 视图选项
     * @param signal - 异步信号
     * @param matched - 匹配的路由项
     * @returns 提取后的内容
     */
    protected onHandleData(
        html: string,
        options: KylinRouteViewOptions,
        signal: IAsyncSignal,
        _matched: KylinMatchedRouteItem,
    ): string {
        const { selector, allowUnsafe, scopedStyle } = options;
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
        } catch (e: any) {
            this.router.logger.error(`视图内容提取失败: ${e.message}`);
        }

        // 应用样式隔离（默认启用）
        if (scopedStyle !== false) {
            const result = scopeStyles(htmlResult, signal.meta.hash);
            htmlResult = result.html;

            // 将 scopeId 和 v-bind 变量保存到 signal.meta
            signal.meta.vBindVars = result.vBindVars;
        }

        if (!allowUnsafe) {
            htmlResult = sanitizeHTML(htmlResult);
        }
        return htmlResult;
    }
}
