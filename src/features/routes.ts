/**
 * 路由表管理功能
 *
 * 负责：
 * - 路由表初始化和规范化
 * - 动态路由注册（addRoute/removeRoute）
 * - 远程路由表加载（loadRemoteRoutes）
 * - 路由匹配和参数提取
 * - 默认路径重定向
 */

import type { KylinRoutes, RouteItem } from "@/types";
import { matchRoute } from "@/utils/matchRoute";
import { extractQueryParams } from "@/utils/parseParams";

/** 最大重定向次数，防止循环重定向 */
const MAX_REDIRECTS = 10;

/** 导航回调函数类型 */
export interface NavigationCallbacks {
    push: (path: string) => void;
    getLocation: () => { pathname: string; search: string };
    setIsNavigating: (value: boolean) => void;
}

export class RouteRegistry {
    /** 路由表配置 */
    public routes!: RouteItem[];

    /** 404 路由配置 */
    public notFound?: RouteItem;

    /** 默认路径重定向 */
    public defaultRoute?: string;

    /** 当前路由状态 */
    public current: {
        route: RouteItem | null;
        params: Record<string, string>;
        query: Record<string, string>;
        remainingPath: string;
        /** 匹配的路由链（从根到叶子节点） */
        matchedRoutes: Array<{
            route: RouteItem;
            params: Record<string, string>;
            remainingPath: string;
        }>;
    } = {
        route: null,
        params: {},
        query: {},
        remainingPath: "",
        matchedRoutes: [],
    };

    /** 当前会话的重定向次数（用于循环检测） */
    public _redirectCount: number = 0;

    /** 导航回调函数 */
    private _callbacks?: NavigationCallbacks;

    /**
     * 设置导航回调函数
     */
    public setCallbacks(callbacks: NavigationCallbacks): void {
        this._callbacks = callbacks;
    }

    /**
     * 初始化路由表
     *
     * 支持 RouteItem[]、单个 RouteItem、string（URL）、函数（同步/异步）格式
     * 按照 D-17: 支持多种路由配置格式
     */
    public initRoutes(
        rawRoutes: KylinRoutes,
        notFound?: RouteItem,
        defaultRoute?: string,
    ): void {
        this.notFound = notFound;
        this.defaultRoute = defaultRoute;

        if (typeof rawRoutes === "function") {
            const result = rawRoutes();
            if (result instanceof Promise) {
                // 异步加载：先设空路由表，异步加载完成后更新
                this.routes = [];
                result.then((loaded) => {
                    this.routes = normalizeRoutes(loaded);
                    this.matchCurrentLocation();
                });
                return;
            }
            this.routes = normalizeRoutes(result);
        } else if (typeof rawRoutes === "string") {
            // URL 字符串：先设空路由表，后续通过 loadRemoteRoutes 加载
            this.routes = [];
        } else {
            this.routes = normalizeRoutes(rawRoutes);
        }
    }

    /**
     * 动态添加路由到路由表
     * 如果 name 已存在则覆盖旧路由（后者覆盖策略）
     * 按照 D-11: 后者覆盖策略、D-38: 统一优先级规则
     */
    public addRoute(route: RouteItem): void {
        const existingIndex = this.routes.findIndex((r) => r.name === route.name);
        if (existingIndex !== -1) {
            this.routes[existingIndex] = route;
        } else {
            this.routes.push(route);
        }
    }

    /**
     * 匹配路径并返回匹配结果
     * @param pathname - 要匹配的路径
     * @returns 匹配结果或 null
     */
    public match(pathname: string): ReturnType<typeof matchRoute> {
        return matchRoute(pathname, this.routes) || null;
    }

    /**
     * 动态删除指定名称的路由
     * 支持递归删除嵌套路由
     * 如果删除的是当前访问的路由，自动重定向到默认路由或 404
     * 按照 D-10: 静默处理不存在的路由、D-39: 当前路由删除后重定向
     */
    public removeRoute(name: string): void {
        const removed = removeRouteByName(this.routes, name);

        // 如果删除了路由且当前正在访问该路由，触发重定向
        if (removed && this.current.route && this.current.route.name === name) {
            this.redirectToDefaultOrNotFound();
        }
    }

    /**
     * 动态加载远程路由表并合并到现有路由表
     * 支持 RouteItem[]、函数、异步函数格式
     * 按照 D-17: 统一格式转换
     */
    public async loadRemoteRoutes(
        source: RouteItem[] | RouteItem | (() => KylinRoutes | Promise<KylinRoutes>),
    ): Promise<void> {
        let loaded: KylinRoutes;

        if (typeof source === "function") {
            loaded = await source();
        } else {
            loaded = source;
        }

        // 验证格式
        if (loaded === null || loaded === undefined) {
            throw new Error("远程路由表加载失败：返回的数据为空");
        }

        // 规范化并合并到路由表
        const newRoutes = normalizeRoutes(loaded);
        this.routes.push(...newRoutes);
    }

    /**
     * 执行初始路由匹配
     * 在构造函数中调用，匹配当前 URL 的路由
     */
    public matchCurrentLocation(): void {
        if (!this._callbacks) {
            throw new Error("RouteRegistry: callbacks not set. Call setCallbacks() first.");
        }

        const location = this._callbacks.getLocation();
        const pathname = location.pathname;
        const search = location.search;

        // 设置导航状态
        this._callbacks.setIsNavigating(true);

        // 执行路由匹配
        const matched = matchRoute(pathname, this.routes);

        if (matched) {
            this.current.route = matched.route;
            this.current.params = matched.params;
            this.current.remainingPath = matched.remainingPath;
            this.current.matchedRoutes = matched.matchedRoutes || [];
        } else if (this.notFound) {
            this.current.route = this.notFound;
            this.current.params = {};
            this.current.remainingPath = pathname;
            this.current.matchedRoutes = [];
        } else {
            this.current.route = null;
            this.current.params = {};
            this.current.remainingPath = pathname;
            this.current.matchedRoutes = [];
        }

        // 提取查询参数
        this.current.query = extractQueryParams(search);

        // 重置导航状态
        this._callbacks.setIsNavigating(false);

        // 检查默认路径重定向
        this.checkDefaultRedirect(pathname);
    }

    /**
     * 匹配路由并更新状态
     * 在 onRouteUpdate 中调用
     */
    public matchAndUpdateState(pathname: string, search: string): void {
        const matched = matchRoute(pathname, this.routes);

        if (matched) {
            this.current.route = matched.route;
            this.current.params = matched.params;
            this.current.remainingPath = matched.remainingPath;
            this.current.matchedRoutes = matched.matchedRoutes || [];
        } else if (this.notFound) {
            this.current.route = this.notFound;
            this.current.params = {};
            this.current.remainingPath = pathname;
            this.current.matchedRoutes = [];
        } else {
            this.current.route = null;
            this.current.params = {};
            this.current.remainingPath = pathname;
            this.current.matchedRoutes = [];
        }

        // 提取查询参数
        this.current.query = extractQueryParams(search);
    }

    /**
     * 检查是否需要执行默认路径重定向
     * 当访问根路径（/ 或 hash 模式的 #/）且配置了 defaultRoute 时触发
     * 按照 D-42: 重定向触发完整导航流程、D-43: 循环重定向检测
     */
    public checkDefaultRedirect(pathname: string): void {
        if (!this.defaultRoute) return;

        // 规范化路径用于比较
        const normalizedPath = pathname === "" ? "/" : pathname.replace(/\/+$/, "") || "/";

        // 只在根路径时触发重定向
        if (normalizedPath !== "/") {
            // 非 root 路径正常导航，重置重定向计数
            this._redirectCount = 0;
            return;
        }

        // 已经在 defaultRoute 路径上，不需要重定向
        const targetPath = this.defaultRoute.replace(/\/+$/, "") || "/";
        if (targetPath === "/") {
            this._redirectCount = 0;
            return;
        }

        // 循环重定向检测
        this._redirectCount++;
        if (this._redirectCount > MAX_REDIRECTS) {
            this._redirectCount = 0;
            throw new Error(`检测到循环重定向，已超过最大重定向次数 (${MAX_REDIRECTS})`);
        }

        // 执行重定向
        if (this._callbacks) {
            this._callbacks.push(this.defaultRoute);
        }
    }

    /**
     * 当当前路由被删除或不可访问时，重定向到默认路由或 404
     */
    public redirectToDefaultOrNotFound(): void {
        if (this.defaultRoute) {
            if (this._callbacks) {
                this._callbacks.push(this.defaultRoute);
            }
        } else if (this.notFound) {
            this.current.route = this.notFound;
            this.current.params = {};
            if (this._callbacks) {
                const location = this._callbacks.getLocation();
                this.current.remainingPath = location.pathname;
            }
        }
    }
}

/**
 * 将路由配置规范化为 RouteItem[]
 * 按照 D-17: 支持多种路由配置格式（对象数组、单个对象）
 */
function normalizeRoutes(routes: KylinRoutes): RouteItem[] {
    if (Array.isArray(routes)) {
        return routes;
    }
    // 单个路由对象包装为数组
    return [routes as RouteItem];
}

/**
 * 从路由表中递归删除指定名称的路由
 */
function removeRouteByName(routes: RouteItem[], name: string): boolean {
    for (let i = 0; i < routes.length; i++) {
        if (routes[i].name === name) {
            routes.splice(i, 1);
            return true;
        }
        // 递归检查子路由
        if (routes[i].children) {
            const removed = removeRouteByName(routes[i].children!, name);
            if (removed) return true;
        }
    }
    return false;
}
