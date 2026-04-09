import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns, RouteItem, ModalConfig, ModalState, ModalStackItem, ModalOptions } from "./types/index";
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
    ViewLoader,
    Emitter,
    Redirect,
} from "./features";
import { createHashHistoryFromLib } from "@/utils/hashUtils";

import { HookManager } from "./features/hooks";
import { RouteRegistry } from "./features/routes";
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
    Preload,
    Render,
    Model,
    Redirect,
    Emitter,
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

    /** 组件加载器 */
    private viewLoader: ViewLoader;

    /** 数据加载器 */
    private dataLoader: DataLoader;

    /** 是否正在导航 */
    isNavigating: boolean = false;

    /** 是否启用调试模式 */
    debug: boolean = false;

    /** 上一个路由，用于 afterLeave 守卫 */
    protected previousRoute?: RouteItem & {
        matchedRoutes?: Array<{
            route: RouteItem;
            params: Record<string, string>;
            remainingPath: string;
        }>;
        params?: Record<string, string>;
        query?: Record<string, string>;
    };

    /** 解析后的最终配置选项 */
    public options: KylinRouterOptiopns;

    /** 是否已绑定到 DOM */
    public attached: boolean = false;

    /** 当前导航版本号（D-23） */
    public currentNavVersion: number = 0;

    /** AbortController 用于取消进行中的请求（D-24） */
    private abortController: AbortController = new AbortController();

    /** 模态容器元素 */
    private modalContainer: HTMLElement | null = null;

    /** 模态状态管理 */
    private modalState: ModalState = {
        stack: [],
        current: null
    };

    /** 最大模态层数，防止无限堆叠 */
    private maxModals: number = 10;

    /**
     * 构造函数 - 仅负责配置初始化，不操作 DOM
     * @param host - 宿主元素
     * @param options - 路由配置选项
     */
    constructor(
        host: HTMLElement,
        options: KylinRouterOptiopns | KylinRouterOptiopns["routes"] = [],
    ) {
        super();

        // 验证 host 参数
        if (!(host instanceof HTMLElement)) {
            throw new Error("[KylinRouter] Host must be a valid HTMLElement");
        }

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
            getLocation: () => ({
                pathname: this.history.location.pathname,
                search: this.history.location.search,
            }),
            setIsNavigating: (value) => {
                this.isNavigating = value;
            },
        });
        this.routes.initRoutes(
            this.options.routes,
            this.options.notFound,
            this.options.defaultRoute,
        );

        // 初始化钩子管理器
        this.hooks = new HookManager(this);

        // 初始化组件加载器
        this.viewLoader = new ViewLoader(this);

        // 初始化数据加载器
        this.dataLoader = new DataLoader(this);

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
            console.log(`[KylinRouter] ${message}`, data || "");
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
        // 递增导航版本号（D-23）
        this.currentNavVersion++;
        const currentVersion = this.currentNavVersion;

        // 取消旧请求，创建新的 AbortController（D-24）
        this.abortController.abort();
        this.abortController = new AbortController();

        // 设置导航状态
        this.isNavigating = true;

        // 在导航开始时重置重定向计数（仅针对非重定向触发的导航）
        if (this._pendingNavigationType !== "replace") {
            this.routes._redirectCount = 0;
        }

        const pathname = location.location.pathname;
        const search = location.location.search;

        // 调试日志：导航开始
        this.log(`导航开始: from=${this.routes.current.route?.name || "(initial)"} to=${pathname}`);

        // 保存当前路由状态（用于 from 参数和 afterLeave 守卫）
        const fromRoute = this.routes.current.route || {
            name: "",
            path: "",
            params: {},
            query: {},
        };
        // 保存完整的当前路由状态（包括 matchedRoutes）
        this.previousRoute = this.routes.current.route
            ? {
                  ...this.routes.current.route,
                  matchedRoutes: [...this.routes.current.matchedRoutes],
                  params: { ...this.routes.current.params },
                  query: { ...this.routes.current.query },
              }
            : undefined;

        // 先执行路由匹配，获取目标路由信息
        this.routes.matchAndUpdateState(pathname, search);

        // 调试日志：路由匹配结果
        this.log(
            `路由匹配: name=${this.routes.current.route?.name || "(not found)"} params=`,
            this.routes.current.params,
        );

        // 检查是否为模态路由（D-16）
        const matchedRoute = this.routes.current.route;
        if (matchedRoute) {
            const modalConfig = this.getModalConfig(matchedRoute);
            if (modalConfig?.modal) {
                // 模态路由：使用模态容器渲染
                await this.openModal({
                    route: matchedRoute,
                    backdrop: modalConfig.backdrop
                });
                // 模态路由不继续执行普通导航流程
                this.isNavigating = false;
                return;
            }
        }

        // 构造目标路由对象（用于 to 参数）
        const toRoute = this.routes.current.route || {
            name: "",
            path: pathname,
            params: {},
            query: {},
        };

        // 将匹配的参数和查询参数合并到目标路由对象
        if (toRoute !== this.routes.current.route && this.routes.current.route) {
            toRoute.params = this.routes.current.params;
            toRoute.query = this.routes.current.query;
        } else if (this.routes.current.route) {
            toRoute.params = this.routes.current.params || {};
            toRoute.query = this.routes.current.query || {};
        }

        // 执行 beforeEach 钩子
        this.log("钩子执行: beforeEach");
        try {
            const beforeEachResult = await this.hooks.executeHooks(
                HookTypeValues.BEFORE_EACH as HookType,
                toRoute,
                fromRoute,
            );

            if (beforeEachResult === false) {
                // 取消导航
                this.log("钩子结果: beforeEach 取消导航");
                this.isNavigating = false;
                return;
            }

            if (typeof beforeEachResult === "string") {
                // 重定向
                this.log(`钩子结果: beforeEach 重定向到 ${beforeEachResult}`);
                this.routes._redirectCount++;
                if (this.routes._redirectCount > 10) {
                    console.error("Maximum redirect limit reached. Possible infinite loop.");
                    this.isNavigating = false;
                    this.routes._redirectCount = 0;
                    return;
                }
                this.replace(beforeEachResult);
                return;
            }
        } catch (error) {
            console.error("Error in beforeEach hooks:", error);
            this.log("钩子错误: beforeEach 执行出错", error);
            // 钩子出错时取消导航
            this.isNavigating = false;

            // 回退到之前的路由或默认路由
            const fallback = this.previousRoute?.path || this.routes.defaultRoute || "/";
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
                "beforeEnter",
            );

            if (beforeEnterResult === false) {
                // 取消导航，不触发 afterEach
                this.log("守卫结果: beforeEnter 取消导航");
                this.isNavigating = false;
                this._pendingNavigationType = undefined;
                return;
            }

            if (typeof beforeEnterResult === "string") {
                // 重定向
                this.replace(beforeEnterResult);
                return;
            }
        }

        // 组件加载步骤（在 renderEach 钩子前执行）
        // 遵循导航流程：路由匹配 → 守卫执行 → 组件加载 → renderEach → 渲染
        if (this.routes.current.route?.view) {
            this.log("组件加载: 开始加载组件");
            const view = this.routes.current.route.view;

            // 处理不同类型的 view
            if (typeof view === "string" || typeof view === "function") {
                // string 或 function 类型，使用 Loader 加载
                const loadResult = await this.viewLoader.loadView(
                    view,
                    (this.routes.current.route as any).remoteOptions,
                );

                // 检查导航版本号（D-23）
                if (currentVersion !== this.currentNavVersion) {
                    this.log("组件加载: 导航版本号已变更，丢弃结果");
                    return;
                }

                if (loadResult.success) {
                    this.log("组件加载: 成功", loadResult.content);
                    // 将加载的内容存储到 route.viewContent
                    (this.routes.current.route as any).viewContent = loadResult.content;
                } else {
                    this.log("组件加载: 失败", loadResult.error);

                    // 组件加载失败，不继续后续流程
                    this.isNavigating = false;
                    return;
                }
            } else {
                // HTMLElement 类型，直接存储
                this.log("组件加载: HTMLElement 类型，直接使用");
                (this.routes.current.route as any).viewContent = view;
            }
        }

        // 数据加载步骤（在 renderEach 钩子前执行）
        // 如果路由配置了 data，则加载数据到 route.data
        if (this.routes.current.route?.data) {
            this.log("数据加载: 开始加载路由数据");
            try {
                const dataResult = await this.dataLoader.loadData(
                    this.routes.current.route,
                    { signal: this.abortController.signal }
                );

                // 检查导航版本号（D-23）
                if (currentVersion !== this.currentNavVersion) {
                    this.log("数据加载: 导航版本号已变更，丢弃结果");
                    return;
                }

                if (dataResult.success && dataResult.data) {
                    this.log("数据加载: 成功", dataResult.data);
                    // 将加载的数据存储到 route.data
                    (this.routes.current.route as any).data = dataResult.data;
                } else {
                    this.log("数据加载: 失败", dataResult.error);
                    // 数据加载失败不阻塞导航流程，继续使用空数据
                    (this.routes.current.route as any).data = {};
                }
            } catch (error) {
                console.error("数据加载异常:", error);
                // 数据加载异常不阻塞导航流程
                (this.routes.current.route as any).data = {};
            }
        }

        // 执行 renderEach 钩子（数据预加载）
        // 遵循 D-18: 在组件加载后、渲染前执行
        // 遵循 D-19: 失败时继续渲染组件
        if (this.routes.current.route) {
            this.log("钩子执行: renderEach");
            const renderData = await this.hooks.executeRenderEach(
                this.routes.current.route,
                fromRoute,
            );

            // 检查导航版本号（D-23）
            if (currentVersion !== this.currentNavVersion) {
                this.log("钩子执行: 导航版本号已变更，丢弃结果");
                return;
            }

            // 将预加载的数据合并到 route.data
            // 遵循 D-20: 通过 route.data 传递给组件
            if (renderData) {
                this.log("钩子结果: renderEach 返回数据", renderData);
                // 合并数据：route.data = loadDataResult ∪ renderData
                const currentData = (this.routes.current.route as any).data || {};
                (this.routes.current.route as any).data = { ...currentData, ...renderData };
            }
        }

        // 执行渲染步骤（Task 5：集成渲染流程）
        // 导航流程：路由匹配 → 守卫执行 → 组件加载 → renderEach → 渲染 → 完成
        if (this.routes.current.route) {
            this.log("渲染流程: 开始渲染组件");
            try {
                await this.renderToOutlets();
                this.log("渲染流程: 渲染完成");
            } catch (error) {
                console.error("渲染流程失败:", error);
                this.log("渲染流程: 渲染失败", error);
                // 渲染失败不阻塞导航流程
            }
        }

        // 触发 route-change 事件（用于后续的组件渲染）
        this.emit("route-change", {
            route: this.routes.current.route || undefined,
            params: this.routes.current.params,
            query: this.routes.current.query,
            location: location,
        });

        // 执行 afterEach 钩子
        this.log("钩子执行: afterEach");
        try {
            await this.hooks.executeHooks(
                HookTypeValues.AFTER_EACH as HookType,
                toRoute,
                fromRoute,
            );
        } catch (error) {
            console.error("Error in afterEach hooks:", error);
            this.log("钩子错误: afterEach 执行出错", error);
            // afterEach 钩子出错不影响导航流程
        }

        // 执行 afterLeave 守卫（异步执行，不阻塞导航）
        if (this.previousRoute && this.previousRoute.matchedRoutes) {
            this.hooks
                .executeRouteGuards(
                    this.previousRoute.matchedRoutes,
                    toRoute,
                    this.previousRoute,
                    "afterLeave",
                )
                .catch((error) => {
                    console.error("Error in afterLeave guards:", error);
                    // afterLeave 出错不影响导航流程
                });
        }

        // 触发 navigation-end 事件
        this.emit("navigation-end", {
            location: location,
            navigationType: this._pendingNavigationType || "pop",
        });

        // 重置导航状态
        this.isNavigating = false;
        this._pendingNavigationType = undefined;

        // 调试日志：导航完成
        this.log(
            `导航完成: route=${this.routes.current.route?.name || "(not found)"} path=${pathname}`,
        );

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
            throw new Error(
                "[KylinRouter] Cannot navigate: router is not attached to a host element. Call attach() first.",
            );
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
            const fallback = this.routes.defaultRoute || "/";
            this.replace(fallback);
        }
    }

    push(path: string, state?: unknown) {
        this._ensureAttached();
        this._pendingNavigationType = "push";
        this.log(`导航方法: push(${path})`);
        // 触发 navigation-start 事件
        this.emit("navigation-start", {
            path,
            navigationType: "push",
        });
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
        this.emit("navigation-start", {
            path,
            navigationType: "replace",
        });
        if (state !== undefined) {
            this.history.replace(path, state);
        } else {
            this.history.replace(path);
        }
    }
    back() {
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log("导航方法: back()");

        // 如果有打开的模态，先关闭模态（D-20）
        if (this.modalState.stack.length > 0) {
            this.closeTopModal();
            return;
        }

        // 触发 navigation-start 事件
        this.emit("navigation-start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.back();
    }
    forward() {
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log("导航方法: forward()");
        // 触发 navigation-start 事件
        this.emit("navigation-start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.forward();
    }
    go(delta: number) {
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log(`导航方法: go(${delta})`);
        // 触发 navigation-start 事件
        this.emit("navigation-start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.go(delta);
    }

    /**
     * 渲染到所有匹配的 outlet（Task 5：集成渲染流程）
     * 支持并行渲染策略（D-05）
     */
    private async renderToOutlets(): Promise<void> {
        const route = this.routes.current.route;
        if (!route) return;

        // 查找所有 outlet 元素
        const outlets = this.findOutlets();
        if (outlets.length === 0) {
            this.log("渲染流程: 未找到 outlet 元素");
            return;
        }

        // 获取组件加载结果
        const loadResult = (route as any).viewContent;
        if (!loadResult) {
            this.log("渲染流程: 无组件内容可渲染");
            return;
        }

        // 并行渲染到所有匹配的 outlet（D-05）
        const renderPromises = outlets.map(async (outlet) => {
            // 检查 outlet 是否匹配当前路由
            if (outlet.path && !this._outletMatchesRoute(outlet, route)) {
                return;
            }

            try {
                // 使用 Render 类渲染组件
                await this.renderToOutlet(loadResult, outlet, route);
            } catch (error) {
                console.error(`渲染 outlet [${outlet.path || "default"}] 失败:`, error);
            }
        });

        // 等待所有渲染完成（并行渲染）
        await Promise.all(renderPromises);
    }

    /**
     * 检查 outlet 是否匹配当前路由
     */
    private _outletMatchesRoute(outlet: any, route: RouteItem): boolean {
        if (!outlet.path) return true;
        return route.path === outlet.path || route.path.startsWith(outlet.path + "/");
    }

    /**
     * 渲染组件到指定 outlet
     */
    private async renderToOutlet(loadResult: any, outlet: any, route: RouteItem): Promise<void> {
        // 调用 Render 类的 renderToOutlet 方法（Render 是通过 Mixin 继承的）
        await (this as any).renderToOutlet(loadResult, outlet, {
            mode: (route as any).renderMode,
        });
    }

    /**
     * 查找所有 outlet 元素
     */
    findOutlets(): any[] {
        return Array.from(this.host.querySelectorAll("kylin-outlet"));
    }

    /**
     * 查找指定路径的 outlet
     */
    findOutletByPath(path: string): any | null {
        const outlets = this.findOutlets();
        return outlets.find((outlet: any) => outlet.path === path) || null;
    }

    /**
     * 获取当前渲染上下文（公共方法）
     */
    get renderContext(): any | null {
        if (!this.routes.current.route) return null;
        // 调用 Render 类的 createRenderContext 方法（Render 是通过 Mixin 继承的）
        return (this as any).createRenderContext(this.routes.current.route);
    }

    /**
     * 显示加载状态（D-10, D-11）
     * @param outlet - 目标 outlet 元素
     */
    private showLoading(outlet: HTMLElement): void {
        const route = this.routes.current.route;
        if (!route) return;

        // 获取加载配置：路由级 > 全局
        const loadingConfig = (route as any).loadingConfig || this.options.defaultLoadingTemplate;

        const loadingElement = document.createElement("kylin-loading");
        if (loadingConfig?.template) {
            loadingElement.template = loadingConfig.template;
        }

        outlet.innerHTML = "";
        outlet.appendChild(loadingElement);

        // 触发 loading-start 事件（使用 Emit mixin）
        (this as any).emit?.("loading-start", { route, outlet });
    }

    /**
     * 隐藏加载状态
     * @param outlet - 目标 outlet 元素
     */
    private hideLoading(outlet: HTMLElement): void {
        const loading = outlet.querySelector("kylin-loading");
        if (loading) {
            loading.remove();
        }

        // 触发 loading-end 事件（使用 Emit mixin）
        (this as any).emit?.("loading-end", { outlet });
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

        // 清理 Loader 资源
        this.viewLoader.cleanup();

        // 清理 DataLoader 资源
        this.dataLoader.cleanup();

        // 清理 AbortController
        this.abortController.abort();

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
            throw new Error(
                "[KylinRouter] Host element is required. Provide it in the constructor.",
            );
        }

        // 设置 host 元素
        this.host =
            typeof targetHost === "string"
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

        // 初始化模态容器
        this.initModals();
    }

    /**
     * 初始化模态容器（D-17）
     * 创建模态容器并设置事件监听
     */
    private initModals(): void {
        this.createModalContainer();
        this.setupModalEventListeners();
        this.injectModalStyles();
    }

    /**
     * 创建模态容器（D-17）
     * 如果容器不存在则创建，并返回容器元素
     */
    private createModalContainer(): HTMLElement {
        let container = this.host.querySelector('.kylin-modals') as HTMLElement;
        if (!container) {
            container = document.createElement('div');
            container.className = 'kylin-modals';
            this.host.appendChild(container);
        }
        this.modalContainer = container;
        return container;
    }

    /**
     * 设置模态事件监听
     * 监听 ESC 键关闭模态
     */
    private setupModalEventListeners(): void {
        // ESC 键关闭模态
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalState.current) {
                const config = this.getModalConfig(this.modalState.current.route);
                if (config?.closeOnEsc !== false) {
                    this.closeTopModal();
                }
            }
        });
    }

    /**
     * 获取模态配置
     * 从路由配置中提取模态配置
     */
    private getModalConfig(route: RouteItem): ModalConfig | null {
        if (typeof route.modal === 'boolean') {
            return route.modal ? { modal: true } : null;
        }
        return route.modal || null;
    }

    /**
     * 注入模态样式
     * 添加模态容器和背景遮罩的默认样式
     */
    private injectModalStyles(): void {
        // 检查是否已注入样式
        if (document.querySelector('#kylin-modal-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'kylin-modal-styles';
        style.textContent = `
            .kylin-modals {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999;
                pointer-events: none;
            }
            .kylin-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                pointer-events: auto;
            }
            .kylin-modal-content {
                position: relative;
                pointer-events: auto;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 打开模态（D-16）
     * @param options - 模态选项
     */
    async openModal(options: ModalOptions): Promise<void> {
        // 解析路由配置
        const route = this.resolveModalRoute(options);
        if (!route) {
            throw new Error('Invalid modal route');
        }

        // 检查模态配置
        const modalConfig = this.getModalConfig(route);
        if (!modalConfig?.modal) {
            throw new Error('Route is not configured as modal');
        }

        // 检查模态栈限制
        if (this.modalState.stack.length >= this.maxModals) {
            console.warn('Maximum modal stack depth reached');
            return;
        }

        // 创建模态元素
        const modalElement = await this.createModalElement(route, modalConfig);

        // 创建背景遮罩（D-18）
        let backdropElement: HTMLElement | undefined;
        if (modalConfig.backdrop !== false) {
            backdropElement = this.createBackdrop(modalConfig);
        }

        // 添加到模态栈（D-19）
        const stackItem: ModalStackItem = {
            route,
            element: modalElement,
            backdrop: backdropElement,
            timestamp: Date.now()
        };
        this.modalState.stack.push(stackItem);
        this.modalState.current = stackItem;

        // 渲染模态内容
        await this.renderModal(stackItem);

        // 触发事件
        this.emit('modal-open', {
            route,
            stackItem
        });

        // 更新 URL（不影响主页面的历史记录）
        this.updateModalURL(route);
    }

    /**
     * 关闭顶层模态（D-20）
     */
    async closeTopModal(): Promise<void> {
        if (this.modalState.stack.length === 0) {
            return;
        }

        const stackItem = this.modalState.stack.pop();
        if (!stackItem) return;

        // 移除模态元素和遮罩
        stackItem.element.remove();
        stackItem.backdrop?.remove();

        // 更新当前模态
        this.modalState.current = this.modalState.stack[this.modalState.stack.length - 1] || null;

        // 触发事件
        this.emit('modal-close', {
            route: stackItem.route,
            stackItem
        });

        // 恢复 URL
        this.restoreModalURL();
    }

    /**
     * 关闭所有模态
     */
    async closeAllModals(): Promise<void> {
        while (this.modalState.stack.length > 0) {
            await this.closeTopModal();
        }
    }

    /**
     * 创建模态元素
     */
    private async createModalElement(route: RouteItem, config: ModalConfig): Promise<HTMLElement> {
        const element = document.createElement('div');
        element.className = 'kylin-modal-content';

        // 加载组件
        if (route.view) {
            const loadResult = await this.viewLoader.loadView(
                route.view,
                (route as any).remoteOptions
            );

            if (loadResult.success && loadResult.content) {
                // 渲染组件到模态元素
                await this.render.renderToOutlet(loadResult.content, element, {
                    mode: 'replace'
                });
            }
        }

        return element;
    }

    /**
     * 创建背景遮罩（D-18）
     */
    private createBackdrop(config: ModalConfig): HTMLElement {
        const backdrop = document.createElement('div');
        backdrop.className = 'kylin-modal-backdrop';

        // 点击遮罩关闭模态
        if (config.closeOnBackdropClick !== false) {
            backdrop.addEventListener('click', () => {
                this.closeTopModal();
            });
        }

        return backdrop;
    }

    /**
     * 渲染模态
     */
    private async renderModal(stackItem: ModalStackItem): Promise<void> {
        const container = this.modalContainer!;

        // 添加背景遮罩
        if (stackItem.backdrop) {
            container.appendChild(stackItem.backdrop);
        }

        // 添加模态内容
        container.appendChild(stackItem.element);
    }

    /**
     * 解析模态路由
     */
    private resolveModalRoute(options: ModalOptions): RouteItem | null {
        if (options.route) {
            if (typeof options.route === 'string') {
                // 通过路径查找路由
                return this.routes.match(options.route)?.route || null;
            } else {
                // 直接使用路由配置
                return options.route;
            }
        }
        return null;
    }

    /**
     * 更新模态 URL
     */
    private updateModalURL(route: RouteItem): void {
        // 使用 replaceState 更新 URL，不影响历史记录
        if (route.path) {
            this.history.replace(route.path);
        }
    }

    /**
     * 恢复模态 URL
     */
    private restoreModalURL(): void {
        // 恢复到主路由的 URL
        if (this.routes.current.route?.path) {
            this.history.replace(this.routes.current.route.path);
        }
    }

    /**
     * 关闭模态（D-20）
     * @param route - 可选，指定要关闭的模态路由
     */
    async closeModal(route?: RouteItem | string): Promise<void> {
        if (route) {
            // 关闭指定模态
            let targetRoute: RouteItem | null;
            if (typeof route === 'string') {
                // 通过路径查找路由
                const matched = this.routes.match(route);
                targetRoute = matched?.route || null;
            } else {
                targetRoute = route;
            }

            if (!targetRoute) return;

            const index = this.modalState.stack.findIndex(
                item => item.route === targetRoute
            );
            if (index !== -1) {
                // 关闭该模态及上面的所有模态
                while (this.modalState.stack.length > index) {
                    await this.closeTopModal();
                }
            }
        } else {
            // 关闭顶层模态
            await this.closeTopModal();
        }
    }

    /**
     * 检查是否有打开的模态
     */
    get hasOpenModals(): boolean {
        return this.modalState.stack.length > 0;
    }

    /**
     * 获取当前打开的模态数量
     */
    get modalCount(): number {
        return this.modalState.stack.length;
    }

    /**
     * 获取当前活动的模态
     */
    get currentModal(): ModalStackItem | null {
        return this.modalState.current;
    }
}
