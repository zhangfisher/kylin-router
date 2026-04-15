/**
 * Loader 特性 - 组件加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/loader
 */

import type { KylinRouter } from "@/router";
import type { KylinRouterOptions } from "@/types/config";
import type {
    RouteViewLoadResult,
    KylinRouteViewOptions,
    KylinRouteItem,
    KylinMatchedRouteItem,
} from "@/types/routes";
import { joinPath } from "@/utils/joinPath";
import { asyncSignal } from "asyncsignal";

/**
 * 类型守卫：检查 view 是否为 ViewOptions
 */
function isViewOptions(view: any): view is KylinRouteViewOptions {
    return typeof view === "object" && view !== null && "form" in view;
}
/**
 * Loader 类 - 负责组件加载逻辑
 */
export class ViewLoader {
    /** AbortController 用于取消加载请求 */
    protected abortController?: AbortController;
    router: KylinRouter;
    /** 全局视图加载配置 */
    protected options: Required<Omit<KylinRouteViewOptions, "form">>;

    constructor(router: KylinRouter) {
        this.router = router;
        this.options = Object.assign(
            { allowUnsafe: true, timepout: 5000, cache: 0 },
            this.router.options.viewOptions,
        ) as Required<Omit<KylinRouteViewOptions, "form">>;
    }
    /**
     * 判断视图缓存是否过期
     * @param view
     * @returns
     */
    private _viewIsExpired(view: KylinRouteItem["_view"]) {
        if (view) {
            if (this.options.cache > 0 && view.timestamp > 0) {
                return Date.now() - view.timestamp > this.options.cache;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    async loadViews(routes: KylinMatchedRouteItem[]): Promise<RouteViewLoadResult> {
        routes.forEach((matched) => {
            if (matched.route._view) {
                if (this._viewIsExpired(matched.route._view)) {
                }
                const signal = asyncSignal();
                this.loadView(matched.route)
                    .then((result) => {})
                    .catch((e) => {});
            }
        });
    }

    /**
     * 主加载方法 - 根据 view 类型分发到不同加载策略
     * @param view - 视图源配置（ViewSource）
     * @param options - 视图加载选项（可选）
     * @returns 加载结果的 Promise
     */
    async loadView(route: KylinRouteItem): Promise<RouteViewLoadResult> {
        const view = route.view;
        // 取消之前的加载请求
        if (this.abortController) {
            this.abortController.abort();
        }
        const abortController = new AbortController();

        const viewOptions = {
            ...this.options,
            ...(isViewOptions(route.view)
                ? route.view
                : {
                      from: route.view,
                  }),
        } as KylinRouteViewOptions;

        const from =
            typeof viewOptions.from === "function"
                ? await viewOptions.from(route)
                : viewOptions.from;

        let result: any;
        const signal = asyncSignal();
        try {
            // 检测 view 类型，字符串代表url
            if (typeof from === "string") {
                // 自动添加 base URL 前缀
                const prefixedUrl = this.prefixBaseUrl(from);
                this.loadRemoteView(prefixedUrl, viewOptions, abortController.signal)
                    .then((result) => {
                        route._view = {
                            loading: signal,
                            value: result,
                            timestamp: Date.now(),
                        };
                    })
                    .catch((e) => {});
            } else if (from instanceof HTMLElement) {
                result = from;
            }
        } catch (error) {}
    }

    /**
     * 为 URL 自动添加 base URL 前缀
     * @param url - 原始 URL
     * @returns 添加前缀后的 URL
     */
    private prefixBaseUrl(url: string): string {
        // 如果是完整 URL（包含 :// 或以 // 开头），保持不变
        if (url.includes("://") || url.startsWith("//")) {
            return url;
        }

        // 获取 base URL
        const baseUrl = this.router.options.base || "";
        if (!baseUrl || baseUrl === "/") {
            // base 为空或根路径，直接返回原 URL
            return url;
        }

        // 如果 URL 以 / 开头（绝对路径），检查是否需要添加 base 前缀
        if (url.startsWith("/")) {
            // 检查是否已经包含 base 前缀
            if (url.startsWith(baseUrl)) {
                return url;
            }
            // 添加 base 前缀
            return joinPath(baseUrl, url);
        }

        // 相对路径，直接添加 base 前缀
        return joinPath(baseUrl, url);
    }

    /**
     * 远程 HTML 加载 - 从 URL 获取 HTML 内容
     * @param url - 远程 HTML 的 URL
     * @param routeOptions - 路由级加载选项
     * @param globalOptions - 全局加载选项
     * @returns 加载结果的 Promise
     */
    private loadRemoteView(
        url: string,
        viewOptions: KylinRouteViewOptions,
        abortSignal: AbortSignal,
    ): Promise<string> {
        let tmId: any;
        return new Promise<string>((resolve, reject) => {
            const { timeout = 0, selector, allowUnsafe } = viewOptions;
            if (timeout > 0) {
                tmId = setTimeout(() => {
                    reject(new Error("Load timeout"));
                }, timeout);
            }
            fetch(url, {
                signal: abortSignal,
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `Load view ${url} error: ${response.status} ${response.statusText}`,
                        );
                    }
                    response.text().then((html) => {
                        html = this.extractContent(html, selector);
                        if (!allowUnsafe) {
                            html = this.sanitizeHTML(html);
                        }
                        resolve(html);
                    });
                })
                .catch((e) => {
                    reject(e);
                })
                .finally(() => {
                    clearTimeout(tmId);
                });
        });
    }

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

    /**
     * 安全清理 - 移除危险的 HTML 元素和属性
     * @param html - 原始 HTML 字符串
     * @returns 清理后的安全 HTML
     */
    private sanitizeHTML(html: string): string {
        // 移除 <script> 标签及其内容
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

        // 移除危险的 HTML 事件处理属性（如 onclick、onerror）
        html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
        html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

        // 移除 javascript: 协议的链接
        html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
        html = html.replace(/href\s*=\s*javascript:[^\s>]*/gi, 'href="#"');

        // 移除 iframe、object、embed 等可能危险的标签
        html = html.replace(/<(iframe|object|embed|form)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "");
        html = html.replace(/<(iframe|object|embed|form)\b[^>]*/gi, "");

        return html;
    }

    /**
     * 清理 AbortController
     */
    cleanup(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }
}
