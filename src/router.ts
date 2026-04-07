import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns, RouteItem } from "./types";
import { HookType } from "./types";
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
import { isRouteItem } from "./utils/isRouteItem";

/**
 * 类型守卫：检查对象是否为完整的 KylinRouterOptiopns
 */
function isKylinRouterOptions(obj: unknown): obj is KylinRouterOptiopns {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const options = obj as Record<string, unknown>;
    // 检查是否有 routes 属性
    return "routes" in options;
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
export class KylinRouter extends Mixin(
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
) {
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

    /** 上一个路由，用于 afterLeave 守卫 */
    protected previousRoute?: RouteItem;

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
        let resolvedOptions: KylinRouterOptiopns;

        if (Array.isArray(options)) {
            // 情况1: 数组格式的路由配置
            resolvedOptions = { routes: options };
        } else if (typeof options === "string") {
            // 情况2: 字符串格式的路由配置（URL路径）
            resolvedOptions = { routes: options };
        } else if (typeof options === "function") {
            // 情况3: 函数格式的路由配置（异步加载）
            resolvedOptions = { routes: options };
        } else if (isRouteItem(options)) {
            // 情况4: 单个 RouteItem 对象
            resolvedOptions = { routes: options };
        } else if (isKylinRouterOptions(options)) {
            // 情况5: 完整的 KylinRouterOptiopns 对象
            resolvedOptions = options;
        } else {
            // 情况6: 其他情况，作为空路由配置处理
            resolvedOptions = { routes: [] };
        }

        // 根据 mode 创建对应的 History 实例（D-29 到 D-32）
        const mode = resolvedOptions.mode || "history";
        const base = resolvedOptions.base;
        this.history = mode === "hash" ? createHashHistoryFromLib(base) : createBrowserHistory();

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
    async onRouteUpdate(location: Update) {
        // 设置导航状态
        this.isNavigating = true;

        // 在导航开始时重置重定向计数（仅针对非重定向触发的导航）
        if (this._pendingNavigationType !== 'replace') {
            this._redirectCount = 0;
        }

        const pathname = location.location.pathname;
        const search = location.location.search;

        // 保存当前路由状态（用于 from 参数和 afterLeave 守卫）
        const fromRoute = this.current.route || { name: '', path: '', params: {}, query: {} };
        this.previousRoute = this.current.route || undefined;

        // 先执行路由匹配，获取目标路由信息
        this._matchAndUpdateState(pathname, search);

        // 构造目标路由对象（用于 to 参数）
        const toRoute = this.current.route || { name: '', path: pathname, params: {}, query: {} };

        // 执行 beforeEach 钩子
        try {
            const beforeEachResult = await this.executeHooks(
                HookType.BEFORE_EACH,
                toRoute,
                fromRoute,
                this
            );

            if (beforeEachResult === false) {
                // 取消导航
                this.isNavigating = false;
                return;
            }

            if (typeof beforeEachResult === 'string') {
                // 重定向
                this._redirectCount++;
                if (this._redirectCount > 10) {
                    console.error('Maximum redirect limit reached. Possible infinite loop.');
                    this.isNavigating = false;
                    this._redirectCount = 0;
                    return;
                }
                this.replace(beforeEachResult);
                return;
            }
        } catch (error) {
            console.error('Error in beforeEach hooks:', error);
            // 钩子出错时取消导航
            this.isNavigating = false;
            return;
        }

        // 获取匹配的路由链（包含嵌套路由）
        // 简化实现：对于单个路由，包装在数组中
        const matchedRoutes = this.current.route ? [{ route: this.current.route, params: this.current.params, remainingPath: this.current.remainingPath }] : [];

        // 执行路由级 beforeEnter 守卫（父优先）
        if (this.current.route && matchedRoutes.length > 0) {
            const beforeEnterResult = await this.executeRouteGuards(
                this.getOrderedMatchedRoutes(matchedRoutes),
                this.current.route,
                fromRoute,
                this,
                'beforeEnter'
            );

            if (beforeEnterResult === false) {
                // 取消导航，回退到父路由或默认路由
                this.handleGuardFailure(matchedRoutes);
                this.isNavigating = false;
                return;
            }

            if (typeof beforeEnterResult === 'string') {
                // 重定向
                this.replace(beforeEnterResult);
                return;
            }
        }

        // 执行 renderEach 钩子（数据预加载）
        // 遵循 D-18: 在组件加载后、渲染前执行
        // 遵循 D-19: 失败时继续渲染组件
        if (this.current.route) {
            const renderData = await this.executeRenderEach(
                this.current.route,
                fromRoute,
                this
            );

            // 将预加载的数据存储到 route.data
            // 遵循 D-20: 通过 route.data 传递给组件
            if (renderData) {
                (this.current.route as any).data = renderData;
            }
        }

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

        // 执行 afterEach 钩子
        try {
            await this.executeHooks(
                HookType.AFTER_EACH,
                toRoute,
                fromRoute,
                this
            );
        } catch (error) {
            console.error('Error in afterEach hooks:', error);
            // afterEach 钩子出错不影响导航流程
        }

        // 执行 afterLeave 守卫（异步执行，不阻塞导航）
        if (this.previousRoute) {
            const previousMatched = [{ route: this.previousRoute, params: {}, remainingPath: '' }];
            this.executeRouteGuards(
                this.getOrderedMatchedRoutes(previousMatched),
                toRoute,
                this.previousRoute,
                this,
                'afterLeave'
            ).catch(error => {
                console.error('Error in afterLeave guards:', error);
                // afterLeave 出错不影响导航流程
            });
        }

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

    /**
     * 处理守卫失败时的回退逻辑
     * 按照 D-25: 子路由守卫失败时回退到父路由
     */
    protected handleGuardFailure(matchedRoutes: any[]): void {
        if (matchedRoutes.length > 1) {
            // 有父路由，回退到父路由
            const parentRoute = matchedRoutes[matchedRoutes.length - 2].route;
            this.replace(parentRoute.path);
        } else {
            // 无父路由，回退到默认路由或根路径
            const fallback = this.defaultRoute || '/';
            this.replace(fallback);
        }
    }

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
