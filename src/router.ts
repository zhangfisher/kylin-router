
import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory,createHashHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns, MatchedRoute, KylinRoutes, RouteItem } from "./types";
import { Mixin } from "ts-mixer";
import { Context,Hooks,ComponentLoader,KeepAlive,Transition ,Preload,Render,DataLoader,Model,Redirect} from "./features";
import { matchRoute } from "@/utils/matchRoute";
import { extractQueryParams } from "@/utils/parseParams";


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
    history = createBrowserHistory();

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

        // 初始化路由表（统一转换为 RouteItem[]）
        this.routes = normalizeRoutes(resolvedOptions.routes);

        this.notFound = resolvedOptions.notFound;
        this.defaultRoute = resolvedOptions.defaultRoute;

        this.host = typeof(host) ==='string' ? document.querySelector(host) as HTMLElement : host;
        if (host instanceof HTMLElement) {
            // 做个标识用于获取 router 实例
            this.host.setAttribute("data-kylin-router", "");
            (this.host as any).router= this;
            this.attach();
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
    }

    push(path: string) {
        this.history.push(path);
    }
    replace(path: string) {
        this.history.replace(path);
    }
    back() {
        this.history.back();
    }
    forward() {
        this.history.forward();
    }
    go(delta: number) {
        this.history.go(delta);
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
