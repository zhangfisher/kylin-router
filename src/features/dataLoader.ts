/**
 * Loader 特性 - 组件加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/loader
 */

import type { KylinRouter } from "@/router";
import type { KylinMatchedRouteItem } from "@/types/routes";
import { asyncSignal, type IAsyncSignal } from "asyncsignal";
import { getRouteVars } from "@/utils/getRouteVars";
import { prefixBaseUrl } from "@/utils/prefixBaseUrl";
import type { KylinRouteDataOptions } from "@/types/data";
import { quickHash } from "@/utils/quickHash";
import { generateRouteHash } from "@/utils/generateRouteHash";

/**
 * 类型守卫：检查 view 是否为 ViewOptions
 */
function isDataOptions(data: any): data is KylinRouteDataOptions {
    return typeof data === "object" && data !== null && "from" in data;
}

export type DataCacheItem = {
    value: any;
    timestamp: number;
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

    private _getRouteDataOptions(matched: KylinMatchedRouteItem) {
        if (!matched.route._dataOptions) {
            matched.route._dataOptions = Object.assign(
                {
                    cache: 0,
                    allowUnsafe: true,
                    timeout: 5000,
                },
                {
                    ...this.options,
                    ...(isDataOptions(matched.route.data)
                        ? matched.route.data
                        : {
                              from: matched.route.data,
                          }),
                },
            ) as Required<KylinRouteDataOptions>;
        }
        return matched.route._dataOptions;
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
     * 从缓存获取数据
     */
    private _getRouteDataCache(
        matched: KylinMatchedRouteItem,
        dataOptions: Required<KylinRouteDataOptions>,
    ): [string, DataCacheItem | undefined] {
        // 每一个数据项均需要唯一标识
        const hash = this._getRouteDataHash(dataOptions, matched);
        return [hash, this.cache.get(hash)];
    }
    private _getRouteDataHash(
        dataOptions: Required<KylinRouteDataOptions>,
        matched: KylinMatchedRouteItem,
    ) {
        return generateRouteHash(dataOptions.hash || "{url}", getRouteVars(matched));
    }
    private _initRouteDataLoadIndicator(matched: KylinMatchedRouteItem) {
        if (typeof matched.route._data !== "object") {
            matched.route._data = {
                timestamp: 0,
                signal: null,
                error: null,
            };
        }
    }
    /**
     * 并发加载匹配路由的数据
     * @param routes
     */
    async loadDatas(routes: KylinMatchedRouteItem[]) {
        routes.forEach((matched) => {
            this._initRouteDataLoadIndicator(matched);
            const dataOptions = this._getRouteDataOptions(matched);
            const [hash, dataCache] = this._getRouteDataCache(matched, dataOptions);
            const _data = matched.route._data!;
            if (dataOptions.cache > 0 && this.cache.has(hash)) {
                // 是否启用缓存
                if (this._dataIsExpired(dataCache, dataOptions)) {
                    this.cache.delete(hash);
                } else {
                    // 将缓存的数据返回给加载信号
                    _data.signal = asyncSignal.resolve(dataCache);
                    _data.error = null;
                    return; // 因为数据已存在，所以不再加载
                }
            }
            // 如果数据正在加载中，则取消之前的加载
            if (_data.signal?.isPending()) {
                _data.signal.abort();
            }
            this.loadData(matched, dataOptions);
        });
    }
    /**
     * 主加载方法 - 根据 view 类型分发到不同加载策略
     * @param view - 视图源配置（ViewSource）
     * @param options - 视图加载选项（可选）
     * @returns 加载结果的 Promise
     */
    loadData(matched: KylinMatchedRouteItem, dataOptions: Required<KylinRouteDataOptions>) {
        const dataSource =
            typeof dataOptions.from === "function"
                ? dataOptions.from(matched)
                : () => dataOptions.from;
        const _data = matched.route._data!;
        const hash = this._getRouteDataHash(dataOptions, matched);
        _data.signal = asyncSignal();
        Promise.resolve(dataSource)
            .then((from) => {
                // 进行URL处理和插值
                const url = prefixBaseUrl(
                    from.params(getRouteVars(matched)),
                    this.router.options.base,
                );
                // 检测 from 类型，字符串代表url,并且支持变量插值
                if (typeof from === "string") {
                    this.loadRemoteData(url, dataOptions, _data.signal!)
                        .then((result) => {
                            // 加载后的的是一个字符串模板
                            if (result !== undefined) {
                                _data.timestamp = Date.now();
                                // 缓存数据
                                if (dataOptions.cache > 0) {
                                    this.cache.set(hash, {
                                        value: result,
                                        timestamp: Date.now(),
                                    });
                                }
                                _data.signal?.resolve(result);
                            }
                        })
                        .catch((e) => {
                            _data.signal!.reject(e);
                            _data.error = e;
                            this.cache.delete(hash);
                        });
                }
            })
            .catch((e) => {
                _data.signal!.reject(e);
                _data.error = e;
                this.cache.delete(hash);
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
    ): Promise<any> {
        let tmId: any;
        return new Promise<any>((resolve, reject) => {
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
