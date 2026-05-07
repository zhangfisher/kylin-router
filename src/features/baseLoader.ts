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
     * 获取路由的加载信号
     * 根据 signalKey 自动访问 _getData 或 _getView
     */
    protected getSignal(
        matched: KylinMatchedRouteItem,
        created: boolean = false,
    ): IAsyncSignal | undefined {
        const signal = (matched.route as any)[this._signalKey] as IAsyncSignal | undefined;
        if (!signal && created) {
            const signal = asyncSignal();
            (matched.route as any)[this._signalKey] = signal;
            return signal;
        }
        return signal;
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
        routes.forEach((matched) => this.loadRoute(matched));
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
        // 创建新的信号，确保每次加载都有一个信号，方便统一调用
        let signal = this.getSignal(matched, true)!;
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
                onSuccess(source);
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
        const signal = this.getSignal(matched)!;
        const hash = this._getHash(matched, options);

        if ((options.cache || 0) > 0 && cacheItem && !this._isCacheExpired(cacheItem, options)) {
            signal.resolve(cacheItem.value);
            return true;
        } else if ((options.cache || 0) > 0 && this.cache.has(hash)) {
            this.cache.delete(hash);
        }

        return false;
    }

    private abortPendingLoad(matched: KylinMatchedRouteItem): void {
        // 不需要主动 abort
        // executeLoad 会复用现有的 signal（由 ensureLoadSignal 创建）
        // 旧的请求会继续执行，但结果会被忽略，因为我们使用新的 signal
        // fetch 的 AbortSignal 会在新的 signal 中创建，自动取消旧请求
        const signal = this.getSignal(matched);
        if (signal?.isPending()) {
            signal.abort();
        }
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
        return typeof source === "function"
            ? (source as any)(matched)
            : typeof source === "boolean"
              ? this.getAutoUrl(matched, source)
              : source;
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
            fetch(url, { signal: signal.getAbortSignal() })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`Load ${url} error: ${response.status}`);
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

        signal.resolve(data);
    }

    protected onLoadError(matched: KylinMatchedRouteItem, error: any, signal: IAsyncSignal): void {
        if (error.name === "AbortError") {
            signal.resolve(undefined);
        } else {
            signal.reject(error);
            this.cache.delete(matched.hash);
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
