
import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns, MatchedRoute, KylinRoutes, RouteItem } from "./types";
import { Mixin } from "ts-mixer";
import { Context,Hooks,ComponentLoader,KeepAlive,Transition ,Preload,Render,DataLoader,Model,Redirect} from "./features";
import { matchRoute } from "@/utils/matchRoute";
import { extractQueryParams } from "@/utils/parseParams";
import { createHashHistoryFromLib } from "@/utils/hashUtils";


/**
 * 
 * 
 *  const router = new KylinRouter("aa", {})
 * 
 *  <
 * 
 * 
 */
export class KylinRouter extends Mixin(
    Context,
    Hooks,
    ComponentLoader,
    KeepAlive,
    Transition,
    DataLoader,
    Preload,
    Render,
    Model,
    Redirect
) {
    // 用于存储一需要清理的副作用函数，比如 history.listen 返回的取消监听函数
    protected _cleanups: Array<() => void> = [];
    host: HTMLElement;
    history: ReturnType<typeof createBrowserHistory>;

    outlets?: OutletRefs;

    /** 路由表配置 */
    routes: RouteItem[];

    /** 404 路由配置 */
    notFound?: RouteItem;

    /** 默认路径重定向 */
    defaultRoute?: string;

    /** 当前匹配的路由 */
    currentRoute: MatchedRoute | null = null;

    /** 当前路径参数 */
    params: Record<string, string> = {};

    /** 当前查询参数 */
    query: Record<string, string> = {};

    /** 是否正在导航 */
    isNavigating: boolean = false;

    /** 当前会话的重定向次数（用于循环检测） */
    private _redirectCount: number = 0;

    /** 最大重定向次数，防止循环重定向 */
    private static readonly MAX_REDIRECTS: number = 10;

    /**
     *
     * @param host 元素或选择器字符串，指定 KylinRouter 的宿主元素
     * @param options
     */
    constructor(host: HTMLElement | string, options: KylinRouterOptiopns | KylinRouterOptiopns["routes"]) {
        super();

        // 规范化 options 参数（D-17: 支持多种路由配置格式）
        const resolvedOptions: KylinRouterOptiopns =
            Array.isArray(options) || ("path" in options && "name" in options)
                ? { routes: options as KylinRoutes }
                : options as KylinRouterOptiopns;

        // 根据 mode 创建对应的 History 实例（D-29 到 D-32）
        const mode = resolvedOptions.mode || "history";
        const base = resolvedOptions.base;
        this.history = mode === "hash"
            ? createHashHistoryFromLib(base)
            : createBrowserHistory({ basename: base || "" });

        // 初始化路由表（统一转换为 RouteItem[]）
        // 支持 RouteItem[]、RouteItem、string、函数格式
        const rawRoutes = resolvedOptions.routes;
        if (typeof rawRoutes === "function") {
            const result = rawRoutes();
            if (result instanceof Promise) {
                // 异步加载：先设空路由表，异步加载完成后更新
                this.routes = [];
                this.notFound = resolvedOptions.notFound;
                this.defaultRoute = resolvedOptions.defaultRoute;

                this.host = typeof host === "string" ? document.querySelector(host) as HTMLElement : host;
                if (host instanceof HTMLElement) {
                    this.host.setAttribute("data-kylin-router", "");
                    (this.host as any).router = this;
                    this.attach();
                } else {
                    throw new Error("KylinRouter must be initialized with an HTMLElement as host");
                }

                // 异步加载完成后更新路由表并执行初始匹配
                result.then((loaded) => {
                    this.routes = normalizeRoutes(loaded);
                    this._matchCurrentLocation();
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

        this.notFound = resolvedOptions.notFound;
        this.defaultRoute = resolvedOptions.defaultRoute;

        this.host = typeof(host) ==='string' ? document.querySelector(host) as HTMLElement : host;
        if (host instanceof HTMLElement) {
            // 做个标识用于获取 router 实例
            this.host.setAttribute("data-kylin-router", "");
            (this.host as any).router= this;
            this.attach();

            // 执行初始路由匹配（初始化时 history.listen 不会触发回调）
            this._matchCurrentLocation();
        } else {
            throw new Error("KylinRouter must be initialized with an HTMLElement as host");
        }
    }
    get location() {
        return this.history.location;
    }

    /**
     * 路由更新回调 - 在 URL 变化时被调用
     * 执行路由匹配和参数提取
     */
    onRouteUpdate(location: Update) {
        // 设置导航状态
        this.isNavigating = true;

        const pathname = location.location.pathname;

        // 执行路由匹配
        const matched = matchRoute(pathname, this.routes);

        if (matched) {
            this.currentRoute = matched;
            this.params = matched.params;
        } else if (this.notFound) {
            // 未匹配时使用 404 配置（D-33: 通配符路由优先，notFound 作为后备）
            this.currentRoute = {
                route: this.notFound,
                params: {},
                remainingPath: pathname,
            };
            this.params = {};
        } else {
            this.currentRoute = null;
            this.params = {};
        }

        // 提取查询参数
        this.query = extractQueryParams(location.location.search);

        // 触发 route-change 事件（用于后续的组件渲染）
        this.host.dispatchEvent(
            new CustomEvent("route-change", {
                detail: {
                    route: this.currentRoute,
                    params: this.params,
                    query: this.query,
                    location: location,
                },
                bubbles: true,
            })
        );

        // 触发 navigation-end 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-end", {
                detail: {
                    location: location,
                    navigationType: this._pendingNavigationType || "pop",
                },
                bubbles: true,
            })
        );

        // 重置导航状态
        this.isNavigating = false;
        this._pendingNavigationType = undefined;

        // 默认路径重定向检测（D-41 到 D-44）
        // 当前路径为根路径且配置了 defaultRoute 时，自动重定向
        this._checkDefaultRedirect(pathname);
    }

    /**
     * 检查是否需要执行默认路径重定向
     * 当访问根路径（/ 或 hash 模式的 #/）且配置了 defaultRoute 时触发
     * 按照 D-42: 重定向触发完整导航流程、D-43: 循环重定向检测
     */
    private _checkDefaultRedirect(pathname: string): void {
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
        if (this._redirectCount > KylinRouter.MAX_REDIRECTS) {
            this._redirectCount = 0;
            throw new Error(`检测到循环重定向，已超过最大重定向次数 (${KylinRouter.MAX_REDIRECTS})`);
        }

        // 执行重定向
        this.push(this.defaultRoute);
    }

    /**
     * 执行初始路由匹配
     * 在构造函数中调用，匹配当前 URL 的路由
     */
    private _matchCurrentLocation(): void {
        const pathname = this.history.location.pathname;
        const search = this.history.location.search;

        // 设置导航状态
        this.isNavigating = true;

        // 执行路由匹配
        const matched = matchRoute(pathname, this.routes);

        if (matched) {
            this.currentRoute = matched;
            this.params = matched.params;
        } else if (this.notFound) {
            this.currentRoute = {
                route: this.notFound,
                params: {},
                remainingPath: pathname,
            };
            this.params = {};
        } else {
            this.currentRoute = null;
            this.params = {};
        }

        // 提取查询参数
        this.query = extractQueryParams(search);

        // 重置导航状态
        this.isNavigating = false;

        // 检查默认路径重定向
        this._checkDefaultRedirect(pathname);
    }

    /** 待处理的导航类型，用于在 onRouteUpdate 中判断导航来源 */
    private _pendingNavigationType?: "push" | "replace" | "pop";

    push(path: string, state?: unknown) {
        this._pendingNavigationType = "push";
        // 触发 navigation-start 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-start", {
                detail: {
                    path,
                    navigationType: "push",
                },
                bubbles: true,
            })
        );
        if (state !== undefined) {
            this.history.push(path, state);
        } else {
            this.history.push(path);
        }
    }
    replace(path: string, state?: unknown) {
        this._pendingNavigationType = "replace";
        // 触发 navigation-start 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-start", {
                detail: {
                    path,
                    navigationType: "replace",
                },
                bubbles: true,
            })
        );
        if (state !== undefined) {
            this.history.replace(path, state);
        } else {
            this.history.replace(path);
        }
    }
    back() {
        this._pendingNavigationType = "pop";
        // 触发 navigation-start 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-start", {
                detail: {
                    path: undefined,
                    navigationType: "pop",
                },
                bubbles: true,
            })
        );
        this.history.back();
    }
    forward() {
        this._pendingNavigationType = "pop";
        // 触发 navigation-start 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-start", {
                detail: {
                    path: undefined,
                    navigationType: "pop",
                },
                bubbles: true,
            })
        );
        this.history.forward();
    }
    go(delta: number) {
        this._pendingNavigationType = "pop";
        // 触发 navigation-start 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-start", {
                detail: {
                    path: undefined,
                    navigationType: "pop",
                },
                bubbles: true,
            })
        );
        this.history.go(delta);
    }
    /**
     * 动态添加路由到路由表
     * 如果 name 已存在则覆盖旧路由（后者覆盖策略）
     * 按照 D-11: 后者覆盖策略、D-38: 统一优先级规则
     */
    addRoute(route: RouteItem): void {
        // 检查是否已存在同名路由，存在则覆盖
        const existingIndex = this.routes.findIndex((r) => r.name === route.name);
        if (existingIndex !== -1) {
            this.routes[existingIndex] = route;
        } else {
            this.routes.push(route);
        }
    }

    /**
     * 动态删除指定名称的路由
     * 支持递归删除嵌套路由
     * 如果删除的是当前访问的路由，自动重定向到默认路由或 404
     * 按照 D-10: 静默处理不存在的路由、D-39: 当前路由删除后重定向
     */
    removeRoute(name: string): void {
        const removed = removeRouteByName(this.routes, name);

        // 如果删除了路由且当前正在访问该路由，触发重定向
        if (removed && this.currentRoute && this.currentRoute.route.name === name) {
            this._redirectToDefaultOrNotFound();
        }
    }

    /**
     * 动态加载远程路由表并合并到现有路由表
     * 支持 RouteItem[]、函数、异步函数格式
     * 按照 D-17: 统一格式转换
     */
    async loadRemoteRoutes(source: RouteItem[] | RouteItem | (() => KylinRoutes | Promise<KylinRoutes>)): Promise<void> {
        let loaded: KylinRoutes;

        if (typeof source === "function") {
            loaded = source();
            if (loaded instanceof Promise) {
                loaded = await loaded;
            }
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
     * 当当前路由被删除或不可访问时，重定向到默认路由或 404
     * 优先重定向到 defaultRoute，其次到 notFound
     */
    private _redirectToDefaultOrNotFound(): void {
        if (this.defaultRoute) {
            this.push(this.defaultRoute);
        } else if (this.notFound) {
            this.currentRoute = {
                route: this.notFound,
                params: {},
                remainingPath: this.history.location.pathname,
            };
            this.params = {};
        }
    }

    detach() {
        this._cleanups.forEach((unsubscribe) => unsubscribe());
        this._cleanups = [];
        this.removeContextProvider();
        // 清理存储在 host 上的 router 实例
        if (this.host instanceof HTMLElement) {
            delete (this.host as any).router;
        }
    }
    attach() {
        this._cleanups.push(this.history.listen(this.onRouteUpdate.bind(this)));
        this.attachContextProvider();
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
 * 支持嵌套路由的递归查找和删除
 * @returns 是否成功删除
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
