/**
 * Loader 特性 - 组件加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/loader
 */

import type { KylinRouter } from "@/router";
import type { KylinRouteViewOptions, KylinRouteItem, KylinMatchedRouteItem } from "@/types/routes";
import { asyncSignal, type IAsyncSignal } from "asyncsignal";
import { getRouteVars } from "@/utils/getRouteVars";
import { prefixBaseUrl } from "@/utils/prefixBaseUrl";
import type { KylinRouteDataOptions } from "@/types/data";
import { generateRouteHash } from "@/utils";
import { getRouteHash } from "@/utils/getRouteHash";
import { quickHash } from "@/utils/quickHash";

/**
 * 类型守卫：检查 view 是否为 ViewOptions
 */
function isDataOptions(data: any): data is KylinRouteDataOptions {
    return typeof data === "object" && data !== null && "from" in data;
}

export type DataCacheItem = {
    value: any;
    timestamp: number;
    signal: IAsyncSignal | null;
};
/**
 * Loader 类 - 负责加载路由数据
 */
export class DataLoader {
    router: KylinRouter;
    /** 全局视图加载配置 */
    protected options: Required<Omit<KylinRouteDataOptions, "from">>;
    cache: Map<string, DataCacheItem> = new Map();
    constructor(router: KylinRouter) {
        this.router = router;
        this.options = Object.assign(
            {
                timepout: 5000,
                cache: 0,
            },
            this.router.options.dataOptions,
        ) as Required<Omit<KylinRouteDataOptions, "from">>;
    }
    /**
     * 判断视图缓存是否过期
     * @param view
     * @returns
     */
    private _dataIsExpired(
        dataItem: DataCacheItem | undefined,
        dataOptions: KylinRouteDataOptions,
    ) {
        if (!dataItem) return true;
        if ((dataOptions.cache || 0) > 0) {
            return Date.now() - dataItem.timestamp > dataOptions.cache!;
        } else {
            return true;
        }
    }
    /**
     * 并发加载匹配路由的数据
     * @param routes
     */
    async loadDatas(routes: KylinMatchedRouteItem[]) {
        routes.forEach((matched) => {
            // 必须有指定data参数,如果没有则跳过
            if (!matched.route.data) return;
            this.loadData(matched);
        });
    }
    private _getDataFromCache(url: string, dataOptions: Required<KylinRouteDataOptions>) {
        const routeHash = quickHash(url);
        const useCache = dataOptions.cache || 0 > 0;
        let data: DataCacheItem = this.cache.get(routeHash) as DataCacheItem;
        if (!data) {
            data = {
                value: undefined,
                timestamp: 0,
                signal: asyncSignal(),
            };
            this.cache.set(routeHash, data);
        }
        if (useCache) {
            const isExpired = this._dataIsExpired(data!, dataOptions);
            if (isExpired) {
                data.value = undefined;
            }
        }
        return data;
    }
    /**
     * 主加载方法 - 根据 view 类型分发到不同加载策略
     * @param view - 视图源配置（ViewSource）
     * @param options - 视图加载选项（可选）
     * @returns 加载结果的 Promise
     */
    loadData(matched: KylinMatchedRouteItem) {
        const dataOptions = {
            ...this.options,
            ...(isDataOptions(matched.route.data)
                ? matched.route.data
                : { from: matched.route.data }),
        } as Required<KylinRouteDataOptions>;

        const dataSource =
            typeof dataOptions.from === "function"
                ? dataOptions.from(matched)
                : () => dataOptions.from;

        Promise.resolve(dataSource)
            .then((from) => {
                // 进行URL处理和插值
                const url = prefixBaseUrl(
                    from.params(getRouteVars(matched)),
                    this.router.options.base,
                );
                // 读取缓存数据
                let data = this._getDataFromCache(url, dataOptions);
                if (data) {
                    data.signal?.abort();
                } else {
                    data = {
                        signal: asyncSignal(),
                        timestamp: Date.now(),
                        value: null,
                    };
                }
                // 检测 from 类型，字符串代表url,并且支持变量插值
                if (typeof from === "string") {
                    this.loadRemoteData(url, dataOptions, data.signal!)
                        .then((result) => {
                            // 加载后的的是一个字符串模板
                            if (typeof result === "string") {
                                data.value = result;
                                data.timestamp = Date.now();
                                data.signal?.resolve();
                            }
                        })
                        .catch((e) => {
                            data.signal?.reject(e);
                            data.error = e;
                        })
                        .finally(() => {
                            data.signal?.destroy();
                            data.signal = null;
                        });
                }
            })
            .catch((err) => {
                data.error = err;
            });
    }
    /**
     * 远程 HTML 加载 - 从 URL 获取 HTML 内容
     * @param url - 远程 HTML 的 URL
     * @param routeOptions - 路由级加载选项
     * @param globalOptions - 全局加载选项
     * @returns 加载结果的 Promise
     */
    private loadRemoteData(
        url: string,
        dataOptions: KylinRouteDataOptions,
        signal: IAsyncSignal,
    ): Promise<string | undefined> {
        let tmId: any;
        return new Promise<string | undefined>((resolve, reject) => {
            const { timeout = 0 } = dataOptions;
            if (timeout > 0) {
                tmId = setTimeout(() => {
                    reject(new Error("Load timeout"));
                }, timeout);
            }
            fetch(url, {
                signal: signal.getAbortSignal(),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `Load view ${url} error: ${response.status} ${response.statusText}`,
                        );
                    }
                    response.json().then((data) => {
                        resolve(data);
                    });
                })
                .catch((e) => {
                    if (e.name === "AbortError") {
                        resolve(undefined);
                    } else {
                        reject(e);
                    }
                })
                .finally(() => {
                    clearTimeout(tmId);
                });
        });
    }

    /**
     * 清理 AbortController
     */
    cleanup(): void {}
}
