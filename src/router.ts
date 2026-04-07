import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns, MatchedRoute, KylinRoutes, RouteItem } from "./types";
import { Mixin } from "ts-mixer";
import {
    Context,
    Hooks,
    KeepAlive,
    Transition,
    Preload,
    Render,
    DataLoader,
    Model,
    Redirect,
    Routes,
} from "./features";
import { createHashHistoryFromLib } from "@/utils/hashUtils";

/**
 * 定义 Routes mixin 提供的接口
 * 这让 TypeScript 知道混合后的类会有这些方法
 */
interface RoutesMixin {
    addRoute(route: RouteItem): void;
    removeRoute(name: string): void;
    loadRemoteRoutes(
        source: RouteItem[] | RouteItem | (() => KylinRoutes | Promise<KylinRoutes>),
    ): Promise<void>;
}

/**
 *
 *
 *  const router = new KylinRouter("aa", {})
 *
 *  <
 *
 *
 */
export class KylinRouter
    extends Mixin(
        Context,
        Hooks,
        KeepAlive,
        Transition,
        DataLoader,
        Preload,
        Render,
        Model,
        Redirect,
        Routes,
    )
    implements RoutesMixin
{
    // 用于存储一需要清理的副作用函数，比如 history.listen 返回的取消监听函数
    protected _cleanups: Array<() => void> = [];
    host: HTMLElement;
    history: ReturnType<typeof createBrowserHistory>;

    outlets?: OutletRefs;

    // Routes mixin 提供的属性
    public routes!: RouteItem[];
    public notFound?: RouteItem;
    public defaultRoute?: string;
    public _redirectCount: number = 0;

    /** 是否正在导航 */
    isNavigating: boolean = false;

    /**
     *
     * @param host 元素或选择器字符串，指定 KylinRouter 的宿主元素
     * @param options
     */
    constructor(
        host: HTMLElement | string,
        options: KylinRouterOptiopns | KylinRouterOptiopns["routes"],
    ) {
        super();

        // 规范化 options 参数（D-17: 支持多种路由配置格式）
        const resolvedOptions: KylinRouterOptiopns =
            Array.isArray(options) || ("path" in options && "name" in options)
                ? { routes: options as KylinRoutes }
                : (options as KylinRouterOptiopns);

        // 根据 mode 创建对应的 History 实例（D-29 到 D-32）
        const mode = resolvedOptions.mode || "history";
        const base = resolvedOptions.base;
        this.history =
            mode === "hash"
                ? createHashHistoryFromLib(base)
                : createBrowserHistory({ basename: base || "" });

        // 设置 host 元素
        this.host = typeof host === "string" ? (document.querySelector(host) as HTMLElement) : host;
        if (host instanceof HTMLElement) {
            // 做个标识用于获取 router 实例
            this.host.setAttribute("data-kylin-router", "");
            (this.host as any).router = this;
            this.attach();
        } else {
            throw new Error("KylinRouter must be initialized with an HTMLElement as host");
        }

        // 初始化路由表（委托给 Routes mixin 的 initRoutes 方法）
        this.initRoutes(
            resolvedOptions.routes,
            resolvedOptions.notFound,
            resolvedOptions.defaultRoute,
        );

        // 执行初始路由匹配（初始化时 history.listen 不会触发回调）
        this._matchCurrentLocation();
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
        const search = location.location.search;

        // 执行路由匹配
        this._matchAndUpdateState(pathname, search);

        // 触发 route-change 事件（用于后续的组件渲染）
        this.host.dispatchEvent(
            new CustomEvent("route-change", {
                detail: {
                    route: this.current.route,
                    params: this.current.params,
                    query: this.current.query,
                    location: location,
                },
                bubbles: true,
            }),
        );

        // 触发 navigation-end 事件
        this.host.dispatchEvent(
            new CustomEvent("navigation-end", {
                detail: {
                    location: location,
                    navigationType: this._pendingNavigationType || "pop",
                },
                bubbles: true,
            }),
        );

        // 重置导航状态
        this.isNavigating = false;
        this._pendingNavigationType = undefined;

        // 默认路径重定向检测（D-41 到 D-44）
        // 当前路径为根路径且配置了 defaultRoute 时，自动重定向
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
            }),
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
            }),
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
            }),
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
            }),
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
            }),
        );
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
