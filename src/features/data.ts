/**
 * 数据管理类，负责加载路由数据
 *
 * 职责：
 * - 在导航到指定路由时加载数据到 route.data
 * - 支持静态数据和远程数据加载
 * - 处理数据加载错误和重试
 */

import type { KylinRouter } from "@/router";
import type { RouteItem } from "@/types";

/**
 * 数据加载结果
 */
interface DataLoadResult {
    success: boolean;
    data?: Record<string, any>;
    error?: Error;
}

/**
 * 数据加载选项
 */
interface DataLoadOptions {
    timeout?: number;
    signal?: AbortSignal;
}

export class DataLoader {
    /** AbortController 用于取消进行中的请求 */
    private abortController?: AbortController;
    private router: KylinRouter;
    constructor(router: KylinRouter) {
        this.router = router;
    }

    /**
     * 主加载方法 - 根据 route.data 类型加载数据
     * @param route - 目标路由
     * @param options - 加载选项
     * @returns 加载结果
     */
    async loadData(route: RouteItem, options?: DataLoadOptions): Promise<DataLoadResult> {
        const data = route.data;

        // 如果没有 data 字段，返回空数据
        if (!data) {
            return {
                success: true,
                data: {},
            };
        }

        try {
            // 取消之前的加载请求
            if (this.abortController) {
                this.abortController.abort();
            }
            this.abortController = new AbortController();

            // 检查 data 类型
            if (typeof data === "function") {
                // 远程数据加载：data 是返回 Promise 的函数
                return await this.loadRemoteData(
                    data as () => Promise<Record<string, any>>,
                    options,
                );
            } else {
                // 静态数据：data 已经是 Record<string, any>
                return {
                    success: true,
                    data: data as Record<string, any>,
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * 远程数据加载 - 处理返回 Promise 的 data 函数
     * @param dataFn - 数据加载函数
     * @param options - 加载选项
     * @returns 加载结果
     */
    private async loadRemoteData(
        dataFn: () => Promise<Record<string, any>>,
        options?: DataLoadOptions,
    ): Promise<DataLoadResult> {
        const timeout = options?.timeout || 5000;

        try {
            // 使用 Promise.race 实现超时机制
            const result = await Promise.race([
                dataFn(),
                new Promise<Record<string, any>>((_, reject) =>
                    setTimeout(() => reject(new Error("Data load timeout")), timeout),
                ),
            ]);

            // 验证返回数据类型
            if (typeof result !== "object" || result === null) {
                throw new Error("Data function must return an object");
            }

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            // 处理 AbortError（请求被取消）
            if (error instanceof Error && error.name === "AbortError") {
                return {
                    success: false,
                    error: new Error("Data load cancelled"),
                };
            }

            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * 取消所有进行中的请求
     */
    abortPendingRequests(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = new AbortController();
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
