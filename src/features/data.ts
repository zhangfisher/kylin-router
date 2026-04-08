/**
 * 数据管理类，负责管理路由组件的数据，
 *
 * 用于在路由切换时自动加载数据，处理错误和重试，
 * 然后传递给路由组件进行渲染。
 *
 * 提供：
 * - 错误边界处理（两级配置：路由级 > 全局）
 * - 重试机制（固定和退避策略）
 * - 导航竞态控制（版本号 + AbortController）
 * - 加载状态管理
 */

import type { KylinRouter } from "@/router";
import type { RouteItem, ErrorBoundaryConfig, RetryConfig, NavigationVersion } from "@/types";
import type { ViewLoadResult } from "@/types/routes";
import { html, render } from "lit";

/**
 * 错误组件的属性接口
 */
interface ErrorComponentProps {
    error: Error;
    retry: () => void;
    router: KylinRouter;
    route: RouteItem;
}

export class DataLoader {
    /** AbortController 用于取消进行中的请求 */
    private abortController?: AbortController;

    constructor(private router: KylinRouter) {}

    /**
     * 处理加载错误（D-13）
     * @param error - 错误对象
     * @param route - 目标路由
     * @param outlet - 目标 outlet 元素
     */
    async handleError(error: Error, route: RouteItem, outlet: HTMLElement): Promise<void> {
        // 查找错误边界配置（路由级 > 全局）
        const config = this.findErrorConfig(route);

        // 记录错误信息
        this.logError(error, `加载组件失败: ${route.name || route.path}`);

        // 触发错误回调
        config.onError?.(error, { route, outlet });

        // 检查是否配置了重试
        if (config.retry) {
            const retryConfig: RetryConfig =
                typeof config.retry === "boolean"
                    ? { max: 3, delay: 1000, backoff: "linear" }
                    : config.retry;

            // 尝试重试
            try {
                const result = await this.retryLoad(route, outlet, retryConfig);
                if (result.success) {
                    // 重试成功，渲染组件（使用 Render 类的方法）
                    await (this.router as any).renderToOutlet(result, outlet, { mode: "replace" });
                    return;
                }
            } catch (retryError) {
                // 重试失败，继续到错误边界渲染
                this.logError(retryError instanceof Error ? retryError : new Error(String(retryError)), "重试失败");
            }
        }

        // 没有重试或重试失败，渲染错误边界
        this.renderErrorBoundary(error, config, outlet);

        // 触发 component-error 事件（使用 Emit mixin 的方法）
        (this.router as any).emit?.("component-error", { error, route, outlet });
    }

    /**
     * 渲染错误边界（ERROR-01）
     * @param error - 错误对象
     * @param config - 错误边界配置
     * @param outlet - 目标 outlet 元素
     */
    private renderErrorBoundary(error: Error, config: ErrorBoundaryConfig, outlet: HTMLElement): void {
        try {
            // 清空 outlet
            outlet.innerHTML = "";

            // 创建手动重试方法
            const retry = () => {
                (this.router as any).retryLoad?.();
            };

            // 准备错误组件的 props
            const props: ErrorComponentProps = {
                error,
                retry,
                router: this.router,
                route: this.router.routes.current.route || ({} as RouteItem),
            };

            // 检查是否配置了错误组件
            if (config.component) {
                if (typeof config.component === "string") {
                    // 字符串路径：使用简单的错误显示
                    const errorHtml = this.createErrorHtml(error, config.fallback);
                    render(errorHtml, outlet);
                } else if (typeof config.component === "function") {
                    // 动态导入函数：加载并渲染错误组件
                    config.component()
                        .then((module) => {
                            const ErrorComponent = module.default || module;
                            if (typeof ErrorComponent === "function") {
                                // 如果是组件类，创建实例
                                const errorElement = new ErrorComponent();
                                // 传递 props 到错误元素
                                Object.assign(errorElement, props);
                                outlet.appendChild(errorElement);
                            } else {
                                // 否则直接渲染
                                render(html`${ErrorComponent}`, outlet);
                            }
                        })
                        .catch((_loadError) => {
                            // 错误组件加载失败，使用回退 UI
                            const fallbackHtml = this.createErrorHtml(error, config.fallback);
                            render(fallbackHtml, outlet);
                        });
                }
            } else {
                // 没有错误组件，使用回退 UI
                const errorHtml = this.createErrorHtml(error, config.fallback);
                render(errorHtml, outlet);
            }
        } catch (renderError) {
            // 渲染错误边界本身失败，显示最简单的错误信息
            console.error("渲染错误边界失败:", renderError);
            outlet.innerHTML = `
                <div class="kylin-error-boundary-fail">
                    <h3>渲染错误</h3>
                    <p>无法显示错误详情</p>
                </div>
            `;
        }
    }

    /**
     * 创建错误显示的 HTML
     * @param error - 错误对象
     * @param fallback - 自定义回退 UI
     * @returns lit 模板
     */
    private createErrorHtml(error: Error, fallback?: string): any {
        if (fallback) {
            return html`${fallback}`;
        }

        // 默认错误显示
        return html`
            <div class="kylin-error-boundary">
                <h3>组件加载失败</h3>
                <p>${error.message || "未知错误"}</p>
                ${this.router.debug ? html`<pre>${error.stack || ""}</pre>` : ""}
            </div>
        `;
    }

    /**
     * 查找错误边界配置
     * @param route - 目标路由
     * @returns 错误边界配置
     */
    private findErrorConfig(route: RouteItem): ErrorBoundaryConfig {
        // 优先使用路由级配置
        if (route.errorBoundary) {
            return route.errorBoundary;
        }

        // 使用全局配置
        return {
            component: this.router.options.defaultErrorComponent,
            retry: true, // 默认启用重试
        };
    }

    /**
     * 记录错误信息
     * @param error - 错误对象
     * @param context - 错误上下文
     */
    private logError(error: Error, context: string): void {
        console.error(`[DataLoader] ${context}`, error);

        if (this.router.debug) {
            console.error("错误堆栈:", error.stack);
        }
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }
}
