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
import type { RouteDataOptions } from "@/types/hooks";
import { params } from "@/utils/params";

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

/**
 * 缓存项接口
 */
interface CacheItem {
    /** 缓存的数据 */
    data: Record<string, any>;
    /** 过期时间戳，0 表示不过期 */
    expires: number;
    /** 缓存创建时间戳 */
    timestamp: number;
}

export class DataLoader {
    /** AbortController 用于取消进行中的请求 */
    private abortController?: AbortController;
    /** 全局数据加载配置 */
    protected globalDataOptions?: Omit<RouteDataOptions, 'from'>;
    /** 缓存存储 */
    private cached: Map<string, CacheItem>;
    /** 路由器实例 */
    private _router: KylinRouter;

    constructor(_router: KylinRouter, globalDataOptions?: Omit<RouteDataOptions, 'from'>) {
        this._router = _router;
        this.globalDataOptions = globalDataOptions;
        this.cached = new Map();
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
            // 检查是否是 RouteDataOptions 类型且启用了缓存
            if (typeof data === "object" && data !== null && "from" in data) {
                const dataOptions = data as RouteDataOptions;

                // 处理缓存逻辑
                if (dataOptions.cache !== undefined) {
                    const cacheResult = this.handleCache(dataOptions);
                    if (cacheResult) {
                        return cacheResult;
                    }
                }
            }

            // 取消之前的加载请求
            if (this.abortController) {
                this.abortController.abort();
            }
            this.abortController = new AbortController();

            // 检查 data 类型
            if (typeof data === "function") {
                // 远程数据加载：data 是返回 Promise 的函数
                // 合并全局选项和传入的选项
                const mergedOptions = options ? { ...options } : {};
                if (this.globalDataOptions?.timeout !== undefined) {
                    mergedOptions.timeout = mergedOptions.timeout ?? this.globalDataOptions.timeout;
                }
                return await this.loadRemoteData(
                    data as () => Promise<Record<string, any>>,
                    mergedOptions,
                );
            } else if (typeof data === "object" && data !== null && "from" in data) {
                // RouteDataOptions 类型：合并全局选项
                const dataOptions = data as RouteDataOptions;
                const mergedTimeout = dataOptions.timeout ?? this.globalDataOptions?.timeout;

                // 检查 from 字段的类型
                const from = dataOptions.from;
                if (typeof from === "function") {
                    // from 是函数，调用 loadRemoteData
                    const dataFn = () => {
                        const result = from();
                        return result instanceof Promise ? result : Promise.resolve(result);
                    };
                    const result = await this.loadRemoteData(
                        dataFn,
                        { timeout: mergedTimeout, signal: options?.signal },
                    );

                    // 如果启用缓存且加载成功，存入缓存
                    if (result.success && result.data && dataOptions.cache !== undefined) {
                        this.setCache(dataOptions, result.data);
                    }

                    return result;
                } else if (typeof from === "string") {
                    // from 是字符串 URL，需要从远程加载
                    // 使用插值处理 URL
                    const interpolationVars = this.buildInterpolationVars();
                    const interpolatedUrl = params(from, interpolationVars);

                    // 创建数据加载函数
                    const dataFn = async () => {
                        const response = await fetch(interpolatedUrl, {
                            signal: options?.signal || this.abortController?.signal,
                        });
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return await response.json();
                    };

                    const result = await this.loadRemoteData(
                        dataFn,
                        { timeout: mergedTimeout, signal: options?.signal },
                    );

                    // 如果启用缓存且加载成功，存入缓存
                    if (result.success && result.data && dataOptions.cache !== undefined) {
                        this.setCache(dataOptions, result.data);
                    }

                    return result;
                } else {
                    // from 是 Record，直接作为静态数据返回
                    const staticData = from as Record<string, any>;

                    // 如果启用缓存，存入缓存
                    if (dataOptions.cache !== undefined) {
                        this.setCache(dataOptions, staticData);
                    }

                    return {
                        success: true,
                        data: staticData,
                    };
                }
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

    /**
     * 构建插值变量字典
     * @returns 插值变量对象
     */
    private buildInterpolationVars(): Record<string, any> {
        const current = this._router.routes.current;
        return {
            path: current.route?.path || '',
            basepath: current.route?.path || '',
            url: this._router.history.location.pathname,
            timestamp: Date.now(),
            ...current.query,
            ...current.params,
        };
    }

    /**
     * 生成缓存键
     * @param dataOptions - 数据加载选项
     * @returns 缓存键字符串
     */
    private generateCacheKey(dataOptions: RouteDataOptions): string {
        const cacheConfig = dataOptions.cache;
        let cacheKeyPattern: string;

        // 确定缓存键模式
        if (typeof cacheConfig === 'boolean') {
            cacheKeyPattern = '{path}';
        } else if (typeof cacheConfig === 'string') {
            cacheKeyPattern = cacheConfig;
        } else {
            // cacheConfig 是 undefined，使用默认值
            cacheKeyPattern = '{path}';
        }

        // 使用插值变量生成缓存键
        const interpolationVars = this.buildInterpolationVars();
        return params(cacheKeyPattern, interpolationVars);
    }

    /**
     * 处理缓存逻辑
     * @param dataOptions - 数据加载选项
     * @returns 如果缓存有效则返回缓存数据，否则返回 null
     */
    private handleCache(dataOptions: RouteDataOptions): DataLoadResult | null {
        const cacheKey = this.generateCacheKey(dataOptions);
        const cachedItem = this.cached.get(cacheKey);

        if (cachedItem) {
            // 检查缓存是否过期
            const expires = dataOptions.expires || 0;
            const isExpired = expires !== 0 && (Date.now() - cachedItem.timestamp) > expires;

            if (!isExpired) {
                // 缓存有效，返回缓存数据
                return {
                    success: true,
                    data: cachedItem.data,
                };
            } else {
                // 缓存过期，删除
                this.cached.delete(cacheKey);
            }
        }

        return null;
    }

    /**
     * 设置缓存
     * @param dataOptions - 数据加载选项
     * @param data - 要缓存的数据
     */
    private setCache(dataOptions: RouteDataOptions, data: Record<string, any>): void {
        const cacheKey = this.generateCacheKey(dataOptions);
        const expires = dataOptions.expires || 0;

        this.cached.set(cacheKey, {
            data,
            expires,
            timestamp: Date.now(),
        });
    }

    /**
     * 清空缓存
     * @param key - 可选，指定要清空的缓存键。如果不指定，清空所有缓存
     */
    clearCache(key?: string): void {
        if (key) {
            this.cached.delete(key);
        } else {
            this.cached.clear();
        }
    }
}
