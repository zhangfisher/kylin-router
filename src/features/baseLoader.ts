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
import { generateRouteHash } from "@/utils/generateRouteHash";

/**
 * 加载器类型标识
 */
export type LoadType = "data" | "view";

export type BaseLoaderSource<Data = any> =
    | string
    | Data
    | ((route: KylinMatchedRouteItem) => Data | Promise<Data>);

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
    from: BaseLoaderSource<Data>; //| string | ((matched: KylinMatchedRouteItem) => TData | Promise<TData>);
    /** 缓存时间（毫秒），0 表示不缓存 */
    cache?: number;
    /** 加载超时时间（毫秒） */
    timeout?: number;
    /** 缓存哈希标识模板 */
    hash?: string;
    /**
     * 是否预加载
     * - true: 在路由实例创建时自动预加载进缓存，这可以加速数据加载
     * - false: 默认值，不预加载
     */
    preload?: boolean;
}

/**
 * 缓存项基础结构
 */
export interface CacheItem<T> {
    value: T;
    timestamp: number;
}

/**
 * 首字母大写工具类型
 */
type Capitalize<T extends string> = T extends `${infer First}${infer Rest}`
    ? `${Uppercase<First>}${Rest}`
    : T;

/**
 * 路由数据加载器基类
 * 通过 TLoadType 泛型参数实现精确的类型推导
 *
 * @template TLoadType - 加载器类型
 * @template TOptions - 加载器选项类型
 * @template TData - 数据类型
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
    protected readonly signalKey: `_get${Capitalize<TLoadType>}`;
    protected readonly optionsKey: `_${TLoadType}Options`;
    protected readonly routeKey: TLoadType;

    constructor(
        router: KylinRouter,
        loadType: TLoadType,
        defaultOptions: Required<Omit<TOptions, "from">>,
    ) {
        this.router = router;
        this.loadType = loadType;
        this.options = Object.assign(
            {
                timeout: 5000,
                cache: 0,
                hash: "{path}",
            },
            defaultOptions,
        );

        // 根据 loadType 自动推导键名（运行时值）
        this.signalKey =
            `_get${loadType.charAt(0).toUpperCase() + loadType.slice(1)}` as `_get${Capitalize<TLoadType>}`;
        this.optionsKey = `_${loadType}Options` as `_${TLoadType}Options`;
        this.routeKey = loadType;
    }

    // ========================================
    // 类型安全的属性访问器（核心简化点）
    // ========================================

    /**
     * 获取路由的加载信号
     * 根据 signalKey 自动访问 _getData 或 _getView
     */
    protected getLoadSignal(matched: KylinMatchedRouteItem): IAsyncSignal | undefined {
        return (matched.route as any)[this.signalKey] as IAsyncSignal | undefined;
    }

    /**
     * 设置路由的加载信号
     */
    protected setLoadSignal(matched: KylinMatchedRouteItem, signal: IAsyncSignal): void {
        (matched.route as any)[this.signalKey] = signal;
    }

    /**
     * 获取路由的配置选项
     */
    protected getRouteOptions(matched: KylinMatchedRouteItem): Required<TOptions> {
        if (!(matched.route as any)[this.optionsKey]) {
            (matched.route as any)[this.optionsKey] = this._mergeRouteOptions(matched) as any;
        }
        return (matched.route as any)[this.optionsKey] as unknown as Required<TOptions>;
    }

    /**
     * 获取数据源
     */
    protected getDataSource(options: TOptions): any {
        return options.from;
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
        routes.forEach((matched) => this.loadSingleRoute(matched));
    }

    /**
     * 加载单个路由
     */
    protected loadSingleRoute(matched: KylinMatchedRouteItem): void {
        const options = this.getRouteOptions(matched);
        const [hash, cacheItem] = this.getRouteCache(matched, options);

        // 1. 确保 signal 存在
        this.ensureLoadSignal(matched);

        // 2. 缓存优先策略
        if (this.tryUseCache(matched, hash, cacheItem, options)) {
            return;
        }

        // 3. Abort 逻辑
        this.abortPendingLoad(matched);

        // 4. 执行加载
        this.executeLoad(matched, options, hash);
    }

    /**
     * 执行加载
     */
    protected executeLoad(
        matched: KylinMatchedRouteItem,
        options: Required<TOptions>,
        hash: string,
    ): void {
        // 创建新的 signal
        this.setLoadSignal(matched, asyncSignal());
        const signal = this.getLoadSignal(matched)!;

        // 获取数据源
        const source = this.resolveDataSource(matched, options);

        // 成功和错误处理
        const onSuccess = (data: TData) => this.onLoadSuccess(data, hash, options, signal);
        const onError = (error: any) => this.onLoadError(error, hash, signal);

        // 根据数据源类型分发
        Promise.resolve(source)
            .then((resolvedSource) =>
                this.dispatchBySourceType(resolvedSource, matched, options, signal),
            )
            .then(onSuccess)
            .catch(onError);
    }

    // ========================================
    // 抽象方法（子类必须实现）
    // ========================================

    /**
     * 处理远程加载的响应
     * DataLoader: response.json()
     * ViewLoader: response.text() + HTML 处理
     */
    protected abstract processRemoteResponse(
        response: Response,
        options: TOptions,
        signal: IAsyncSignal,
    ): Promise<TData>;

    /**
     * 验证数据类型
     */
    protected abstract validateDataType(data: unknown): data is TData;

    /**
     * 判断是否应该缓存
     * DataLoader: 所有类型都可缓存
     * ViewLoader: 只缓存字符串类型
     */
    protected abstract shouldCacheData(data: TData): boolean;

    // ========================================
    // 私有方法（基类内部使用）
    // ========================================

    private _isCacheExpired(cacheItem: CacheItem<TData> | undefined, options: TOptions): boolean {
        if (!cacheItem) return true;
        if ((options.cache || 0) > 0) {
            return Date.now() - cacheItem.timestamp > options.cache!;
        }
        return true;
    }

    protected _getRouteHash(options: TOptions, matched: KylinMatchedRouteItem): string {
        return generateRouteHash(options.hash || "{url}", getRouteVars(matched));
    }

    private ensureLoadSignal(matched: KylinMatchedRouteItem): void {
        if (!this.getLoadSignal(matched)) {
            this.setLoadSignal(matched, asyncSignal());
        }
    }

    private tryUseCache(
        matched: KylinMatchedRouteItem,
        hash: string,
        cacheItem: CacheItem<TData> | undefined,
        options: TOptions,
    ): boolean {
        const signal = this.getLoadSignal(matched)!;

        if ((options.cache || 0) > 0 && cacheItem && !this._isCacheExpired(cacheItem, options)) {
            signal.resolve(cacheItem.value);
            return true;
        } else if ((options.cache || 0) > 0 && this.cache.has(hash)) {
            this.cache.delete(hash);
        }

        return false;
    }

    private abortPendingLoad(_matched: KylinMatchedRouteItem): void {
        // 不需要主动 abort
        // 在 executeLoad 中会创建新的 signal 覆盖旧的
        // 旧的 signal 会被垃圾回收，其关联的 fetch 请求会继续
        // 但结果会被忽略，因为我们使用新的 signal
    }

    protected resolveDataSource(matched: KylinMatchedRouteItem, options: TOptions): any {
        const source = this.getDataSource(options);
        return typeof source === "function" ? source(matched) : source;
    }

    private dispatchBySourceType(
        resolvedSource: any,
        matched: KylinMatchedRouteItem,
        options: TOptions,
        signal: IAsyncSignal,
    ): Promise<TData> {
        if (typeof resolvedSource === "string") {
            // 字符串类型：远程加载
            const url = prefixBaseUrl(
                resolvedSource.params(getRouteVars(matched)),
                this.router.options.base,
            );
            return this.loadRemote(url, options, signal);
        } else if (this.validateDataType(resolvedSource)) {
            // 本地数据/视图
            return Promise.resolve(resolvedSource);
        } else {
            throw new Error(`Invalid source type`);
        }
    }

    private async loadRemote(url: string, options: TOptions, signal: IAsyncSignal): Promise<TData> {
        let timeoutId: any;
        const { timeout = 0 } = options;

        return new Promise((resolve, reject) => {
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    reject(new Error("Load timeout"));
                }, timeout);
            }
            signal.meta.url = url;
            fetch(url, { signal: signal.getAbortSignal() })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Load ${url} error: ${response.status}`);
                    }
                    return this.processRemoteResponse(response, options, signal);
                })
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timeoutId));
        });
    }

    protected onLoadSuccess(
        data: TData,
        hash: string,
        options: TOptions,
        signal: IAsyncSignal,
    ): void {
        // 缓存
        if ((options.cache || 0) > 0 && this.shouldCacheData(data)) {
            this.cache.set(hash, {
                value: data,
                timestamp: Date.now(),
            } as CacheItem<TData>);
        }
        signal.resolve(data);
    }

    protected onLoadError(error: any, hash: string, signal: IAsyncSignal): void {
        if (error.name === "AbortError") {
            signal.resolve(undefined);
        } else {
            signal.reject(error);
            this.cache.delete(hash);
        }
    }

    private _mergeRouteOptions(matched: KylinMatchedRouteItem): Required<TOptions> {
        const routeSource = (matched.route as any)[this.routeKey];

        return Object.assign(
            { ...this.options },
            this.isOptionsObject(routeSource) ? routeSource : { from: routeSource },
        ) as Required<TOptions>;
    }

    protected getRouteCache(
        matched: KylinMatchedRouteItem,
        options: TOptions,
    ): [string, CacheItem<TData> | undefined] {
        const hash = this._getRouteHash(options, matched);
        return [hash, this.cache.get(hash)];
    }

    // ========================================
    // 公共方法
    // ========================================

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.cache.clear();
    }
}
