/**
 * 路由数据加载器基类
 * 提取 DataLoader 和 ViewLoader 的公共逻辑
 *
 * @module features/baseLoader
 */

import type { KylinRouter } from "@/router";
import type { KylinMatchedRouteItem } from "@/types/routes";
import { asyncSignal, type IAsyncSignal } from "asyncsignal";
import { getRouteVars } from "@/utils/getRouteVars";
import { prefixBaseUrl } from "@/utils/prefixBaseUrl";
import { getSignalHash } from "@/utils/getSignalHash";
import { KylinRouterError } from "@/errors";

/**
 * 加载器类型标识
 */
export type LoadType = "data" | "view";

/**
 * 基础加载器数据来源类型
 *
 * - string: URL,支持插值
 * - Data: 直接的数据对象
 * - (route) => Data 函数返回数据
 * - true: 简化配置，当data=true时，则自动使用与view同名地址的JSON.
 *         例如view="pages/a.html"时，data=true会自动加载"pages/a.json"
 */
export type BaseLoaderSource<Data = any> =
    | true
    | string
    | Data
    | ((route: KylinMatchedRouteItem) => Data);

/**
 * 基础加载选项接口
 * 所有加载器共享的基础选项
 */
export interface BaseLoaderOptions<Data = any> {
    /**
     * 数据/视图来源
     * - TData: 直接的数据/视图值（如对象、HTMLElement）
     * - string: URL 地址
     * - (matched) => TData | Promise<TData>: 函数返回数据
     */
    from: BaseLoaderSource<Data>;
    /**
     * 加载器名称
     * 可选：用于标识加载器的名称，
     * 对于数据加载器，名称将Alpine.data(name)的键名，
     */
    name?: string;
    /** 缓存时间（毫秒），0 表示不缓存 */
    cache?: number;
    /** 加载超时时间（毫秒） */
    timeout?: number;
    /**
     * 是否预加载
     * - true: 在路由实例创建时自动预加载进缓存，这可以加速数据加载
     * - false: 默认值，不预加载
     */
    preload?: boolean;
    /**
     * 当从远程url加载数据时，指定数据类型
     * 决定response.text()或response.json()的调用
     */
    datatype?: "json" | "text";
    /**
     * 路由hash值，用于生成缓存键
     * 例如："{path}"表示使用路由的路径作为hash值
     */
    hash?: string;
}

/**
 * 缓存项基础结构
 */
export interface CacheItem<T> {
    value: T;
    timestamp: number;
}

/**
 * 路由数据加载器基类
 * 通过 TLoadType 泛型参数实现精确的类型推导
 *
 * @template TLoadType - 加载器类型
 * @template TOptions - 加载器选项类型
 * @template TData - 从远程加载的数据类型
 * @template TCacheItem - 缓存项类型
 */
export abstract class RouteDataLoaderBase<
    TLoadType extends string,
    TOptions extends BaseLoaderOptions<TData>,
    TData = any,
> {
    // 基础属性
    router: KylinRouter;
    protected readonly loadType: TLoadType;
    protected options: Required<Omit<TOptions, "from">>;
    cache: Map<string, CacheItem<TData>> = new Map();

    // 根据 TLoadType 精确推导的键名类型
    protected readonly _signalKey: `_get${Capitalize<TLoadType>}`;
    protected readonly _optionsKey: `_${TLoadType}Options`;
    protected readonly _optionKey: TLoadType;

    constructor(
        router: KylinRouter,
        type: TLoadType,
        defaultOptions: Required<Omit<TOptions, "from">>,
    ) {
        this.router = router;
        this.loadType = type;
        this.options = Object.assign(
            {
                timeout: 0,
                cache: 0,
                hash: "{path}",
                datatype: "json",
            },
            defaultOptions,
        );

        // 根据 loadType 自动推导键名（运行时值）
        this._signalKey =
            `_get${type.charAt(0).toUpperCase() + type.slice(1)}` as `_get${Capitalize<TLoadType>}`;
        this._optionsKey = `_${type}Options` as `_${TLoadType}Options`;
        this._optionKey = type;
    }

    // ========================================
    // 类型安全的属性访问器（核心简化点）
    // ========================================

    /**
     * 获取路由当前正在使用的加载信号
     * 根据 signalKey 自动访问 _getData 或 _getView
     */
    protected getSignal(matched: KylinMatchedRouteItem): IAsyncSignal | undefined {
        return (matched.route as any)[this._signalKey] as IAsyncSignal | undefined;
    }

    /**
     * 创建新的加载信号
     * 在创建前会先 abort 并清理旧的 signal
     */
    protected createSignal(matched: KylinMatchedRouteItem): IAsyncSignal {
        const oldSignal = this.getSignal(matched);
        if (oldSignal) {
            oldSignal.abort();
        }
        const newSignal = asyncSignal();
        (matched.route as any)[this._signalKey] = newSignal;
        return newSignal;
    }

    /**
     * 获取路由的配置选项
     */
    protected getRouteOptions(matched: KylinMatchedRouteItem): Required<TOptions> {
        if (!(matched.route as any)[this._optionsKey]) {
            (matched.route as any)[this._optionsKey] = this._mergeRouteOptions(matched) as any;
        }
        return (matched.route as any)[this._optionsKey] as unknown as Required<TOptions>;
    }

    /**
     * 判断是否为配置对象
     */
    protected isOptionsObject(data: unknown): data is TOptions {
        return typeof data === "object" && data !== null && "from" in data;
    }

    // ========================================
    // 模板方法（基类实现完整流程）
    // ========================================

    /**
     * 并发加载多个路由
     */
    public async loadRoutes(routes: KylinMatchedRouteItem[]): Promise<void> {
        for (const matched of routes) {
            this.loadRoute(matched);
        }
    }

    /**
     * 加载单个路由
     */
    protected loadRoute(matched: KylinMatchedRouteItem): void {
        // @ts-ignore
        if (!matched.route[this._optionKey]) return;

        const options = this.getRouteOptions(matched);

        const source = this.getSource(matched, options);
        if (!source) return;

        // 检查 source 是否是错误对象
        if (source instanceof Error) {
            const signal = this.createSignal(matched);
            this.onLoadError(matched, source as any, signal);
            return;
        }

        const cacheItem = this.getRouteCache(matched);

        // 2. 缓存优先策略
        if (this.tryUseCache(matched, cacheItem, options)) {
            return;
        }

        // 3. 如果有正在加载的信号，则中断
        this.abortPendingLoad(matched);

        // 4. 执行加载
        this.startLoad(matched, options);
    }

    /**
     * 执行加载
     */
    protected startLoad(matched: KylinMatchedRouteItem, options: Required<TOptions>): void {
        // 每次加载创建新的信号，旧的信号会被自动 abort
        let signal = this.createSignal(matched);
        // 设置 hash，确保静态数据源也有 hash
        signal.meta.hash = this._getHash(matched, options);
        // 获取数据源
        const source = this.getSource(matched, options)!;
        // 成功和错误处理
        const onSuccess = (data: TData) => {
            this.onLoadSuccess(matched, data, options, signal);
        };
        const onError = (error: any) => {
            this.onLoadError(matched, error, signal);
        };
        try {
            if (typeof source === "string") {
                const url = prefixBaseUrl(
                    source.params(getRouteVars(matched)),
                    this.router.options.base,
                );
                // 从远程加载数据
                this.loadRemote(url, options, signal, matched).then(onSuccess).catch(onError);
            } else {
                // 静态数据源也需要调用 onHandleData
                const processedData = this.onHandleData(source, options, signal, matched);
                // 如果 processedData 是 Promise，使用 then/catch 处理
                if (processedData instanceof Promise) {
                    processedData.then(onSuccess).catch(onError);
                } else {
                    onSuccess(processedData);
                }
            }
        } catch (e: any) {
            onError(e);
        }
    }

    private _isCacheExpired(cacheItem: CacheItem<TData> | undefined, options: TOptions): boolean {
        if (!cacheItem) return true;
        if ((options.cache || 0) > 0) {
            return Date.now() - cacheItem.timestamp > options.cache!;
        }
        return true;
    }

    /**
     * 尝试使用缓存数据
     * @param matched - 匹配的路由项
     * @param hash - 缓存键的哈希值
     * @param cacheItem - 缓存项，可能为 undefined
     * @param options - 加载选项配置
     * @returns 是否成功使用缓存数据，true 表示使用缓存成功，false 表示需要重新加载
     */
    private tryUseCache(
        matched: KylinMatchedRouteItem,
        cacheItem: CacheItem<TData> | undefined,
        options: TOptions,
    ): boolean {
        const hash = this._getHash(matched, options);

        if ((options.cache || 0) > 0 && cacheItem && !this._isCacheExpired(cacheItem, options)) {
            // 缓存命中时，创建新的 signal 并 resolve
            const signal = this.createSignal(matched);
            signal.meta.hash = hash;
            const processedData = this.onHandleData(cacheItem.value, options, signal, matched);
            signal.resolve(processedData);
            return true;
        } else if ((options.cache || 0) > 0 && this.cache.has(hash)) {
            this.cache.delete(hash);
        }

        return false;
    }

    /**
     * 中止正在进行的加载
     * 注意：由于 startLoad 会创建新的 signal 并自动 abort 旧的，
     * 这个方法现在主要作为一个文档说明，保留接口兼容性
     */
    private abortPendingLoad(_matched: KylinMatchedRouteItem): void {
        // createSignal 会自动 abort 旧的 signal，所以这里不需要额外操作
    }

    private _getHash(matched: KylinMatchedRouteItem, options: TOptions) {
        if (options.hash) {
            return getSignalHash(options.hash, matched);
        }
        return getSignalHash(options.hash || "{path}", matched);
    }
    /**
     * 获取数据源，根据配置的 from 选项返回静态数据或动态函数
     * @param matched - 匹配的路由项对象
     * @param options - 数据加载配置选项，包含 from 属性指定数据源
     * @returns 返回静态数据或函数执行结果
     */
    protected getSource(
        matched: KylinMatchedRouteItem,
        options: TOptions,
    ): string | TData | undefined {
        const source = options.from;
        try {
            return typeof source === "function"
                ? (source as any)(matched)
                : typeof source === "boolean"
                  ? this.getAutoUrl(matched, source)
                  : source;
        } catch (error) {
            // 返回错误对象以便在 loadRoute 中处理
            return error as any;
        }
    }

    protected getAutoUrl(_matched: KylinMatchedRouteItem, _source: boolean): string | undefined {
        return undefined;
    }

    private async loadRemote(
        url: string,
        options: TOptions,
        signal: IAsyncSignal,
        matched: KylinMatchedRouteItem,
    ): Promise<TData> {
        let timeoutId: any;
        const { timeout = 0 } = options;

        return new Promise((resolve, reject) => {
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    this.router.logger.warn(
                        `⏰ [加载调试] 请求超时 - url: ${url}, timeout: ${timeout}`,
                    );
                    reject(new Error("Load timeout"));
                }, timeout);
            }
            signal.meta.url = url;
            signal.meta.hash = this._getHash(matched, options);
            this.router.logger.debug(`{} -> 正在加载 {}(hash={})`, () => [
                matched.id,
                url,
                signal.meta.hash,
            ]);
            fetch(url, { signal: signal.getAbortSignal() })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new KylinRouterError(
                            `Fail when load ${url} : ${response.statusText}`,
                            response.status,
                        );
                    }
                    const result = await response[this.options.datatype as "json" | "text"]();
                    return this.onHandleData(result, options, signal, matched) as TData;
                })
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timeoutId));
        });
    }
    /**
     * 处理数据的钩子方法，子类可以重写此方法以实现自定义的数据处理逻辑
     * @param {TData} data - 待处理的数据
     * @param {TOptions} _options - 处理选项（未使用，保留用于扩展）
     * @returns {TData} 处理后的数据，默认直接返回原始数据
     */
    protected onHandleData(
        data: TData,
        _options: TOptions,
        _signal: IAsyncSignal,
        _matched: KylinMatchedRouteItem,
    ): TData {
        return data;
    }

    protected onLoadSuccess(
        matched: KylinMatchedRouteItem,
        data: TData,
        options: TOptions,
        signal: IAsyncSignal,
    ): void {
        // 缓存
        if ((options.cache || 0) > 0) {
            const hash = this._getHash(matched, options);
            this.cache.set(hash, {
                value: data,
                timestamp: Date.now(),
            } as CacheItem<TData>);
        }
        this.router.logger.debug(`{} -> 加载{}成功: {}`, () => [
            matched.id,
            this.loadType,
            signal.meta.url,
            matched.url,
        ]);
        signal.resolve(data);
    }

    protected onLoadError(
        matched: KylinMatchedRouteItem,
        error: KylinRouterError,
        signal: IAsyncSignal,
    ): void {
        if (error.name === "AbortError") {
            signal.resolve(undefined);
        } else {
            signal.meta.statusCode = error.status || 500;
            this.cache.delete(matched.hash);

            this.router.logger.error(
                `{id} -> 加载{type}失败: {url}`,
                () => [matched.id, this.loadType, signal.meta.url],
                error,
            );
            signal.reject(error);
        }
    }

    private _mergeRouteOptions(matched: KylinMatchedRouteItem): Required<TOptions> {
        const routeSource = (matched.route as any)[this._optionKey];
        return Object.assign(
            { ...this.options },
            this.isOptionsObject(routeSource) ? routeSource : { from: routeSource },
        ) as Required<TOptions>;
    }

    protected getRouteCache(matched: KylinMatchedRouteItem): CacheItem<TData> | undefined {
        return this.cache.get(matched.hash);
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.cache.clear();
    }
}
