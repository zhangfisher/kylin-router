/**
 * Loader 特性 - 组件加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/loader
 */

import type { KylinRouter } from "@/router";
import type { RouteViewLoadResult, RouteViewOptions, RouteViewSource } from "@/types/routes";

/**
 * Loader 类 - 负责组件加载逻辑
 */
export class ViewLoader {
    /** AbortController 用于取消加载请求 */
    protected abortController?: AbortController;
    router: KylinRouter;
    /** 全局视图加载配置 */
    protected globalViewOptions?: Omit<RouteViewOptions, 'form'>;

    constructor(router: KylinRouter, globalViewOptions?: Omit<RouteViewOptions, 'form'>) {
        this.router = router;
        this.globalViewOptions = globalViewOptions;
    }

    /**
     * 主加载方法 - 根据 view 类型分发到不同加载策略
     * @param view - 视图源配置（ViewSource）
     * @param options - 视图加载选项（可选）
     * @returns 加载结果的 Promise
     */
    async loadView(
        view: RouteViewSource,
        options?: RouteViewOptions,
    ): Promise<RouteViewLoadResult> {
        // 取消之前的加载请求
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        // 合并全局选项和路由级选项（路由级优先）
        const finalOptions: RouteViewOptions | undefined = options
            ? { ...this.globalViewOptions, ...options }
            : undefined;

        try {
            // 检测 view 类型
            if (typeof view === "string") {
                // 判断是否为 URL
                if (this.isURL(view)) {
                    return await this.loadRemoteView(view, finalOptions, this.globalViewOptions);
                } else {
                    return this.loadLocalView(view);
                }
            } else if (typeof view === "function") {
                return await this.loadDynamicImport(view);
            } else if (view instanceof HTMLElement) {
                // HTMLElement 类型，直接返回
                return {
                    success: true,
                    content: view,
                    error: null,
                };
            } else {
                return {
                    success: false,
                    content: null,
                    error: new Error(`Invalid view type: ${typeof view}`),
                };
            }
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * 本地组件加载 - 处理 HTML 元素名
     * @param view - HTML 元素名（如 'div'、'my-component'）
     * @returns 加载结果
     */
    private loadLocalView(view: string): RouteViewLoadResult {
        // 验证元素名格式
        if (!view || typeof view !== "string") {
            return {
                success: false,
                content: null,
                error: new Error("Invalid view name"),
            };
        }

        // 返回元素名，由 Render 类负责实际渲染
        return {
            success: true,
            content: view,
            error: null,
        };
    }

    /**
     * 动态导入加载 - 处理函数形式的组件
     * @param importFn - 动态导入函数（如 () => import('./MyComponent.js')）
     * @returns 加载结果的 Promise
     */
    private async loadDynamicImport(importFn: () => Promise<HTMLElement> | HTMLElement): Promise<RouteViewLoadResult> {
        try {
            // 调用动态导入函数
            const result = importFn();

            // 处理同步返回的 HTMLElement
            if (result instanceof HTMLElement) {
                return {
                    success: true,
                    content: result,
                    error: null,
                };
            }

            // 处理异步返回的 Promise
            const module = await result;

            // 提取默认导出或命名导出
            const component = (module as any).default || module;

            if (!component) {
                return {
                    success: false,
                    content: null,
                    error: new Error("Dynamic import has no default or named export"),
                };
            }

            // 返回组件类或构造函数
            return {
                success: true,
                content: component,
                error: null,
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * 判断字符串是否为 URL
     * @param str - 待检查的字符串
     * @returns 是否为 URL
     */
    private isURL(str: string): boolean {
        try {
            const url = new URL(str);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    /**
     * 远程 HTML 加载 - 从 URL 获取 HTML 内容
     * @param url - 远程 HTML 的 URL
     * @param routeOptions - 路由级加载选项
     * @param globalOptions - 全局加载选项
     * @returns 加载结果的 Promise
     */
    private async loadRemoteView(
        url: string,
        routeOptions?: RouteViewOptions,
        globalOptions?: Omit<RouteViewOptions, 'form'>,
    ): Promise<RouteViewLoadResult> {
        // 合并选项：路由级优先
        const timeout = routeOptions?.timeout ?? globalOptions?.timeout ?? 5000;
        const allowUnsafe = routeOptions?.allowUnsafe ?? globalOptions?.allowUnsafe ?? false;
        const selector = routeOptions?.selector ?? globalOptions?.selector;

        try {
            // 使用 Promise.race 实现超时机制
            const response = await Promise.race([
                fetch(url, {
                    signal: this.abortController?.signal,
                }),
                new Promise<Response>((_, reject) =>
                    setTimeout(() => reject(new Error("Load timeout")), timeout),
                ),
            ]);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 检查内容大小（D-32: 限制 1MB）
            const contentLength = response.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > 1024 * 1024) {
                throw new Error("Response too large (max 1MB)");
            }

            let html = await response.text();

            // 检查内容大小（如果没有 content-length 头）
            if (html.length > 1024 * 1024) {
                throw new Error("Response too large (max 1MB)");
            }

            // 智能内容提取（D-02）
            html = this.extractContent(html, selector);

            // 安全性检查（D-15, D-29）
            if (!allowUnsafe) {
                html = this.sanitizeHTML(html);
            }

            return {
                success: true,
                content: html,
                error: null,
            };
        } catch (error) {
            // 处理 AbortError（请求被取消）
            if (error instanceof Error && error.name === "AbortError") {
                return {
                    success: false,
                    content: null,
                    error: new Error("Request cancelled"),
                };
            }

            return {
                success: false,
                content: null,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
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
