/**
 * Loader 特性 - 组件加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/loader
 */

import type { KylinRouter } from "@/router";
import type { LoadResult, RemoteLoadOptions } from "@/types/routes";

/**
 * Loader 类 - 负责组件加载逻辑
 */
export class Loader {
    private router: KylinRouter;
    private abortController?: AbortController;

    constructor(router: KylinRouter) {
        this.router = router;
    }

    /**
     * 主加载方法 - 根据 component 类型分发到不同加载策略
     * @param component - 组件配置（字符串、函数或 URL）
     * @param options - 远程加载选项（可选）
     * @returns 加载结果的 Promise
     */
    async loadComponent(
        component: string | (() => Promise<any>),
        options?: RemoteLoadOptions
    ): Promise<LoadResult> {
        // 取消之前的加载请求
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        try {
            // 检测 component 类型
            if (typeof component === "string") {
                // 判断是否为 URL
                if (this.isURL(component)) {
                    return await this.loadRemoteHTML(component, options);
                } else {
                    return this.loadLocalComponent(component);
                }
            } else if (typeof component === "function") {
                return await this.loadDynamicImport(component);
            } else {
                return {
                    success: false,
                    content: null,
                    error: new Error(`Invalid component type: ${typeof component}`),
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
     * @param component - HTML 元素名（如 'div'、'my-component'）
     * @returns 加载结果
     */
    private loadLocalComponent(component: string): LoadResult {
        // 验证元素名格式
        if (!component || typeof component !== "string") {
            return {
                success: false,
                content: null,
                error: new Error("Invalid component name"),
            };
        }

        // 返回元素名，由 Render 类负责实际渲染
        return {
            success: true,
            content: component,
            error: null,
        };
    }

    /**
     * 动态导入加载 - 处理函数形式的组件
     * @param importFn - 动态导入函数（如 () => import('./MyComponent.js')）
     * @returns 加载结果的 Promise
     */
    private async loadDynamicImport(importFn: () => Promise<any>): Promise<LoadResult> {
        try {
            // 调用动态导入函数
            const module = await importFn();

            // 提取默认导出或命名导出
            const component = module.default || module;

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
     * 清理 AbortController
     */
    cleanup(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }
}

/**
 * Loader Mixin 特性
 * 为 KylinRouter 提供组件加载能力
 */
export function LoaderMixin<T extends new (...args: any[]) => any>(Base: T) {
    return class extends Base {
        private _loader?: Loader;

        /**
         * 获取 Loader 实例
         */
        get loader(): Loader {
            if (!this._loader) {
                this._loader = new Loader(this as unknown as KylinRouter);
            }
            return this._loader;
        }

        /**
         * 清理 Loader 资源
         */
        cleanupLoader() {
            if (this._loader) {
                this._loader.cleanup();
            }
        }
    };
}
