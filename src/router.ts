import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns, RouteItem } from "./types/index";
import { HookTypeValues, type HookType } from "./types/index";
import { Mixin } from "ts-mixer";
import {
    Context,
    KeepAlive,
    Transition,
    Preload,
    Render,
    DataLoader,
    Model,
    Redirect,
} from "./features";
import { HookManager } from "./features/hooks";
import { RouteRegistry } from "./features/routes";
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
    KeepAlive,
    Transition,
    DataLoader,
    Preload,
    Render,
    Model,
    Redirect,
) {
    // 用于存储一需要清理的副作用函数，比如 history.listen 返回的取消监听函数
    protected _cleanups: Array<() => void> = [];
    /** 宿主元素，在 attach() 方法调用后设置 */
    host!: HTMLElement;
    history: ReturnType<typeof createBrowserHistory>;

    outlets?: OutletRefs;

    /** 路由表注册器 */
    public routes: RouteRegistry;

    /** 钩子管理器 */
    public hooks: HookManager;

    /** 是否正在导航 */
    isNavigating: boolean = false;

    /** 是否启用调试模式 */
    debug: boolean = false;

    /** 上一个路由，用于 afterLeave 守卫 */
    protected previousRoute?: (RouteItem & {
        matchedRoutes?: Array<{
            route: RouteItem;
            params: Record<string, string>;
            remainingPath: string;
        }>;
        params?: Record<string, string>;
        query?: Record<string, string>;
    });

    /** 解析后的最终配置选项 */
    public options: KylinRouterOptiopns;

    /** 是否已绑定到 DOM */
    public attached: boolean = false;

    /**
     * 构造函数 - 仅负责配置初始化，不操作 DOM
     * @param host - 宿主元素
     * @param options - 路由配置选项
     */
    constructor(host: HTMLElement, options: KylinRouterOptiopns | KylinRouterOptiopns["routes"] = []) {
        super();

        // 规范化 options 参数（D-17: 支持多种路由配置格式）
        let resolvedOptions: KylinRouterOptiopns;

        if (Array.isArray(options)) {
            // 情况1: 数组格式的路由配置
            resolvedOptions = { routes: options, host };
        } else if (typeof options === "string") {
            // 情况2: 字符串格式的路由配置（URL路径）
            resolvedOptions = { routes: options, host };
        } else if (typeof options === "function") {
            // 情况3: 函数格式的路由配置（异步加载）
            resolvedOptions = { routes: options, host };
        } else if (isRouteItem(options)) {
            // 情况4: 单个 RouteItem 对象
            resolvedOptions = { routes: [options], host };
        } else if (isKylinRouterOptions(options)) {
            // 情况5: 完整的 KylinRouterOptiopns 对象
            resolvedOptions = { ...options, host };
        } else {
            // 情况6: 其他情况，作为空路由配置处理
            resolvedOptions = { routes: [], host };
        }

        // 存储解析后的最终配置
        this.options = resolvedOptions;

        // 根据 mode 创建对应的 History 实例（D-29 到 D-32）
        const mode = this.options.mode || "history";
        const base = this.options.base;
        this.history = mode === "hash" ? createHashHistoryFromLib(base) : createBrowserHistory();

        // 初始化路由表注册器
        this.routes = new RouteRegistry();
        this.routes.setCallbacks({
            push: this.push.bind(this),
            getLocation: () => ({ pathname: this.history.location.pathname, search: this.history.location.search }),
            setIsNavigating: (value) => { this.isNavigating = value; },
        });
        this.routes.initRoutes(
            this.options.routes,
            this.options.notFound,
            this.options.defaultRoute,
        );

        // 初始化钩子管理器
        this.hooks = new HookManager(this);

        // 设置调试模式
        this.debug = this.options.debug || false;
    }

    /**
     * 调试日志输出方法
     * @param message - 日志消息
     * @param data - 附加数据（可选）
     */
    private log(message: string, data?: any): void {
        if (this.debug) {
            console.log(`[KylinRouter] ${message}`, data || '');
        }
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
            this.routes._redirectCount = 0;
        }

        const pathname = location.location.pathname;
        const search = location.location.search;

        // 调试日志：导航开始
        this.log(`导航开始: from=${this.routes.current.route?.name || '(initial)'} to=${pathname}`);

        // 保存当前路由状态（用于 from 参数和 afterLeave 守卫）
        const fromRoute = this.routes.current.route || { name: '', path: '', params: {}, query: {} };
        // 保存完整的当前路由状态（包括 matchedRoutes）
        this.previousRoute = this.routes.current.route ? {
            ...this.routes.current.route,
            matchedRoutes: [...this.routes.current.matchedRoutes],
            params: { ...this.routes.current.params },
            query: { ...this.routes.current.query }
        } : undefined;

        // 先执行路由匹配，获取目标路由信息
        this.routes.matchAndUpdateState(pathname, search);

        // 调试日志：路由匹配结果
        this.log(`路由匹配: name=${this.routes.current.route?.name || '(not found)'} params=`, this.routes.current.params);

        // 构造目标路由对象（用于 to 参数）
        const toRoute = this.routes.current.route || { name: '', path: pathname, params: {}, query: {} };

        // 将匹配的参数和查询参数合并到目标路由对象
        if (toRoute !== this.routes.current.route && this.routes.current.route) {
            toRoute.params = this.routes.current.params;
            toRoute.query = this.routes.current.query;
        } else if (this.routes.current.route) {
            toRoute.params = this.routes.current.params || {};
            toRoute.query = this.routes.current.query || {};
        }

        // 执行 beforeEach 钩子
        this.log('钩子执行: beforeEach');
        try {
            const beforeEachResult = await this.hooks.executeHooks(
                HookTypeValues.BEFORE_EACH as HookType,
                toRoute,
                fromRoute
            );

            if (beforeEachResult === false) {
                // 取消导航
                this.log('钩子结果: beforeEach 取消导航');
                this.isNavigating = false;
                return;
            }

            if (typeof beforeEachResult === 'string') {
                // 重定向
                this.log(`钩子结果: beforeEach 重定向到 ${beforeEachResult}`);
                this.routes._redirectCount++;
                if (this.routes._redirectCount > 10) {
                    console.error('Maximum redirect limit reached. Possible infinite loop.');
                    this.isNavigating = false;
                    this.routes._redirectCount = 0;
                    return;
                }
                this.replace(beforeEachResult);
                return;
            }
        } catch (error) {
            console.error('Error in beforeEach hooks:', error);
            this.log('钩子错误: beforeEach 执行出错', error);
            // 钩子出错时取消导航
            this.isNavigating = false;

            // 回退到之前的路由或默认路由
            const fallback = this.previousRoute?.path || this.routes.defaultRoute || '/';
            if (this.location.pathname !== fallback) {
                this.replace(fallback);
            }
            return;
        }

        // 获取匹配的路由链（包含嵌套路由）
        const matchedRoutes = this.routes.current.matchedRoutes || [];

        // 执行路由级 beforeEnter 守卫（父优先）
        if (this.routes.current.route && matchedRoutes.length > 0) {
            const beforeEnterResult = await this.hooks.executeRouteGuards(
                matchedRoutes,
                this.routes.current.route,
                fromRoute,
                'beforeEnter'
            );

            if (beforeEnterResult === false) {
                // 取消导航，不触发 afterEach
                this.log('守卫结果: beforeEnter 取消导航');
                this.isNavigating = false;
                this._pendingNavigationType = undefined;
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
        if (this.routes.current.route) {
            this.log('钩子执行: renderEach');
            const renderData = await this.hooks.executeRenderEach(
                this.routes.current.route,
                fromRoute
            );

            // 将预加载的数据存储到 route.data
            // 遵循 D-20: 通过 route.data 传递给组件
            if (renderData) {
                this.log('钩子结果: renderEach 返回数据', renderData);
                (this.routes.current.route as any).data = renderData;
            }
        }

        // 触发 route-change 事件（用于后续的组件渲染）
        this.host.dispatchEvent(
            new CustomEvent("route-change", {
                detail: {
                    route: this.routes.current.route,
                    params: this.routes.current.params,
                    query: this.routes.current.query,
                    location: location,
                },
                bubbles: true,
            }),
        );

        // 执行 afterEach 钩子
        this.log('钩子执行: afterEach');
        try {
            await this.hooks.executeHooks(
                HookTypeValues.AFTER_EACH as HookType,
                toRoute,
                fromRoute
            );
        } catch (error) {
            console.error('Error in afterEach hooks:', error);
            this.log('钩子错误: afterEach 执行出错', error);
            // afterEach 钩子出错不影响导航流程
        }

        // 执行 afterLeave 守卫（异步执行，不阻塞导航）
        if (this.previousRoute && this.previousRoute.matchedRoutes) {
            this.hooks.executeRouteGuards(
                this.previousRoute.matchedRoutes,
                toRoute,
                this.previousRoute,
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

        // 调试日志：导航完成
        this.log(`导航完成: route=${this.routes.current.route?.name || '(not found)'} path=${pathname}`);

        // 默认路径重定向检测（D-41 到 D-44）
        // 当前路径为根路径且配置了 defaultRoute 时，自动重定向
        this.routes.checkDefaultRedirect(pathname);
    }

    /** 待处理的导航类型，用于在 onRouteUpdate 中判断导航来源 */
    private _pendingNavigationType?: "push" | "replace" | "pop";

    /**
     * 确保 router 已 attached，否则抛出错误
     * @throws {Error} - 如果 router 未 attached
     */
    private _ensureAttached(): void {
        if (!this.attached) {
            throw new Error("[KylinRouter] Cannot navigate: router is not attached to a host element. Call attach() first.");
        }
    }

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
            const fallback = this.routes.defaultRoute || '/';
            this.replace(fallback);
        }
    }

    push(path: string, state?: unknown) {
        this._ensureAttached();
        this._pendingNavigationType = "push";
        this.log(`导航方法: push(${path})`);
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
        this._ensureAttached();
        this._pendingNavigationType = "replace";
        this.log(`导航方法: replace(${path})`);
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
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log('导航方法: back()');
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
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log('导航方法: forward()');
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
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log(`导航方法: go(${delta})`);
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

    /**
     * 解除 router 与 host 的绑定并清理所有监听器
     */
    detach(): void {
        if (!this.attached) {
            return; // 或抛出警告
        }

        // 清理所有副作用
        this._cleanups.forEach((unsubscribe) => unsubscribe());
        this._cleanups = [];

        // 移除 context provider
        this.removeContextProvider();

        // 清理 host 引用
        if (this.host instanceof HTMLElement) {
            this.host.removeAttribute("data-kylin-router");
            delete (this.host as any).router;
        }

        // 标记为未绑定
        this.attached = false;
    }

    /**
     * 将 router 绑定到 host 元素并开始监听路由变化
     * @throws {Error} - 如果已 attached 或 host 无效
     */
    attach(): void {
        if (this.attached) {
            throw new Error("[KylinRouter] Already attached to a host element");
        }

        // 从 options 中获取 host
        const targetHost = this.options.host;

        // 检查是否提供了有效的 host
        if (!targetHost) {
            throw new Error("[KylinRouter] Host element is required. Provide it in the constructor.");
        }

        // 设置 host 元素
        this.host = typeof targetHost === "string"
            ? (document.querySelector(targetHost) as HTMLElement)
            : targetHost;

        if (!(this.host instanceof HTMLElement)) {
            throw new Error("[KylinRouter] Host must be a valid HTMLElement");
        }

        // 标记 host 元素
        this.host.setAttribute("data-kylin-router", "");
        (this.host as any).router = this;

        // 开始监听路由变化
        this._cleanups.push(this.history.listen(this.onRouteUpdate.bind(this)));

        // 设置 context provider
        this.attachContextProvider();

        // 标记为已绑定
        this.attached = true;

        // 执行初始路由匹配
        this.routes.matchCurrentLocation();
    }
}
