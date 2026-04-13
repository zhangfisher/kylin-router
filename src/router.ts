import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory, createHashHistory } from "history";
import type { Update } from "history";
import type {
    KylinRouterOptiopns,
    KylinRouteItem,
    ModalState,
    KylinRouteViewSource,
    KylinRouteViewOptions,
    KylinMatchedRouteItem,
} from "./types/index";
import { HookTypeValues, type HookType } from "./types/index";
import { Mixin } from "ts-mixer";
import {
    Context,
    KeepAlive,
    Transition,
    Preload,
    Render,
    DataLoader,
    ViewLoader,
    Emitter,
    Redirect,
    Modal,
} from "./features";
import { createHashHistoryFromLib } from "@/utils/hashUtils";
import { findOutletInElement } from "@/utils/findOutletInElement";
import { getBaseUrl } from "@/utils/getBaseUrl";

/**
 * 类型守卫：检查 view 是否为 ViewOptions
 */
function isViewOptions(
    view: KylinRouteViewSource | KylinRouteViewOptions,
): view is KylinRouteViewOptions {
    return typeof view === "object" && view !== null && "form" in view;
}

import { HookManager } from "./features/hooks";
import { RouteRegistry } from "./features/routes";
import { AlpineManager } from "./features/alpine";
import { getRouteViewOptions } from "./utils/getRouteViewOptions";
import { matchRoute } from "./utils";

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
    Modal,
    Preload,
    Render,
    Redirect,
    Emitter,
) {
    // 用于存储一需要清理的副作用函数，比如 history.listen 返回的取消监听函数
    protected _cleanups: Array<() => void> = [];
    /** 宿主元素，在 attach() 方法调用后设置 */
    host!: HTMLElement;
    history!: ReturnType<typeof createBrowserHistory>;

    outlets?: OutletRefs;
    /** 路由表注册器 */
    public routes!: RouteRegistry;

    /** 钩子管理器 */
    public hooks!: HookManager;

    /** 组件加载器 */
    protected viewLoader!: ViewLoader;

    /** 数据加载器 */
    protected dataLoader!: DataLoader;

    /** 是否正在导航 */
    isNavigating: boolean = false;

    /** 待处理的导航类型，用于在 onRouteUpdate 中判断导航来源 */
    private _pendingNavigationType?: "push" | "replace" | "pop";

    /** 上一个路由，用于 afterLeave 守卫 */
    protected previous?: KylinRouteItem & {
        matchedRoutes?: Array<{
            route: KylinRouteItem;
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
    protected modalContainer: HTMLElement | null = null;

    /** 模态状态管理 */
    protected modalState: ModalState = {
        stack: [],
        current: null,
    };
    private _redirectCount: number = 0;

    /** 最大模态层数，防止无限堆叠 */
    protected maxModals: number = 10;

    /** Alpine.js 管理器 */
    protected alpineManager?: AlpineManager;

    /**
     * 构造函数 - 仅负责配置初始化，不操作 DOM
     * @param host - 宿主元素
     * @param options - 路由配置选项
     */
    constructor(
        host: HTMLElement | string,
        options: KylinRouterOptiopns | KylinRouterOptiopns["routes"] = [],
    ) {
        super();
        // 设置 host 元素
        this.host = typeof host === "string" ? (document.querySelector(host) as HTMLElement) : host;
        if (!(this.host instanceof HTMLElement)) {
            throw new Error("[KylinRouter] Host must be a valid HTMLElement");
        } // 标记 host 元素
        this.host.setAttribute("data-kylin-router", "");
        (this.host as any).router = this;

        // 存储解析后的最终配置
        this.options = Object.assign(
            {
                mode: "history",
                base: getBaseUrl(), // 自动检测 base URL
                debug: false,
                home: "/",
                data: {},
            },
            options && typeof options === "object" && "routes" in options
                ? options
                : {
                      routes: options,
                  },
        );

        this.attach();
    }
    /**
     * 获取路由模式
     * @returns 路由模式（history 或 hash）
     */
    get mode() {
        return this.options.mode;
    }
    /**
     * 获取基础路径
     * @returns 基础路径（例如：/app）
     */
    get base() {
        return this.options.base;
    }
    /**
     * 是否启用调试模式
     * */
    get debug() {
        return this.options.debug;
    }
    /**
     * 调试日志输出方法
     * @param message - 日志消息
     * @param data - 附加数据（可选）
     */
    protected log(message: string, data?: any): void {
        if (this.debug) {
            console.log(`[KylinRouter] ${message}`, data || "");
        }
    }

    get location() {
        return this.history.location;
    }

    /**
     * 执行路由匹配并构造导航上下文
     * @param pathname - 路径名称
     * @param search - 查询参数
     * @returns 导航上下文，包含 fromRoute、toRoute 等信息
     */
    protected _matchRoute(
        pathname: string,
        search: string,
    ): {
        fromRoute: KylinMatchedRouteItem[] | undefined;
        toRoute: KylinMatchedRouteItem[] | undefined;
    } {
        const fromRoute = this.routes.current;
        const toRoute = matchRoute(pathname + "?" + search, this.routes.routes);
        return { fromRoute, toRoute };
    }

    /**
     * 执行全局前置守卫（beforeEach）
     * @param toRoute - 目标路由
     * @param fromRoute - 来源路由
     * @returns 是否继续导航（false 表示取消）
     */
    protected async _executeBeforeEachHooks(
        toRoute: KylinRouteItem,
        fromRoute: KylinRouteItem,
    ): Promise<boolean> {
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
                return false;
            }

            if (typeof beforeEachResult === "string") {
                // 重定向
                this.log(`钩子结果: beforeEach 重定向到 ${beforeEachResult}`);
                this._redirectCount++;
                if (this._redirectCount > 10) {
                    console.error("Maximum redirect limit reached. Possible infinite loop.");
                    this.isNavigating = false;
                    this._redirectCount = 0;
                    return false;
                }
                this.replace(beforeEachResult);
                return false;
            }
        } catch (error) {
            console.error("Error in beforeEach hooks:", error);
            this.log("钩子错误: beforeEach 执行出错", error);
            // 钩子出错时取消导航
            this.isNavigating = false;

            // 回退到之前的路由或根路径
            const fallback = this.previous?.path || "/";
            if (this.location.pathname !== fallback) {
                this.replace(fallback);
            }
            return false;
        }

        return true;
    }

    /**
     * 执行路由级前置守卫（beforeEnter）
     * @param fromRoute - 来源路由
     * @returns 是否继续导航（false 表示取消）
     */
    protected async _executeBeforeEnterGuards(fromRoute: KylinRouteItem): Promise<boolean> {
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
                return false;
            }

            if (typeof beforeEnterResult === "string") {
                // 重定向
                this.replace(beforeEnterResult);
                return false;
            }
        }

        return true;
    }

    /**
     * 加载路由视图组件
     * @returns 是否继续导航（false 表示取消或版本过期）
     */
    protected async _loadRouteView(route: KylinRouteItem): Promise<boolean> {
        if (!this.routes.current.route?.view) {
            return true;
        }

        this.log("组件加载: 开始加载组件");
        const view = this.routes.current.route.view;

        // 判断 view 类型
        if (isViewOptions(view)) {
            // ViewOptions 类型：提取 form 作为实际视图源，使用配置的选项
            this.log("组件加载: ViewOptions 类型，使用配置选项");
            const loadResult = await this.viewLoader.loadView(
                typeof view.form === "string" || typeof view.form === "function"
                    ? view.form
                    : view.form, // HTMLElement 类型会在 loadView 中处理
                view,
            );

            if (loadResult.success) {
                this.log("组件加载: 成功", loadResult.content);
                (this.routes.current.route as any).viewContent = loadResult.content;
            } else {
                this.log("组件加载: 失败", loadResult.error);
                this.isNavigating = false;
                return false;
            }
        } else if (typeof view === "string" || typeof view === "function") {
            // ViewSource 类型：string 或 function，使用默认选项加载
            this.log("组件加载: ViewSource 类型（string/function）");
            const loadResult = await this.viewLoader.loadView(view, undefined);

            if (loadResult.success) {
                this.log("组件加载: 成功", loadResult.content);
                (this.routes.current.route as any).viewContent = loadResult.content;
            } else {
                this.log("组件加载: 失败", loadResult.error);
                this.isNavigating = false;
                return false;
            }
        } else {
            // HTMLElement 类型，直接存储
            this.log("组件加载: HTMLElement 类型，直接使用");
            (this.routes.current.route as any).viewContent = view;
        }

        return true;
    }

    /**
     * 加载路由数据
     * @returns 是否继续导航（false 表示版本过期）
     */
    protected async _loadRouteData(route: KylinRouteItem): Promise<boolean> {
        if (!this.routes.current.route?.data) {
            return true;
        }

        this.log("数据加载: 开始加载路由数据");
        try {
            const dataResult = await this.dataLoader.loadData(this.routes.current.route, {
                signal: this.abortController.signal,
            });

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

        return true;
    }

    /**
     * 并发加载路由资源（组件和数据）
     * 使用 Promise.allSettled 确保即使其中一个失败也能继续
     * @param currentVersion - 当前导航版本号
     * @returns 是否继续导航（false 表示版本过期或组件加载失败）
     */
    protected async _loadRouteResources(route: KylinRouteItem): Promise<boolean> {
        this.log("资源加载: 开始并发加载组件和数据");

        const results = await Promise.allSettled([
            this._loadRouteView(route),
            this._loadRouteData(route),
        ]);

        const [viewResult] = results;

        // 处理组件加载结果
        if (viewResult.status === "rejected" || !viewResult.value) {
            this.log("资源加载: 组件加载失败");
            return false;
        }

        return true;
    }

    /**
     * 执行 renderEach 钩子（数据预加载）
     * @param fromRoute - 来源路由
     * @param currentVersion - 当前导航版本号
     * @returns 是否继续导航（false 表示版本过期）
     */
    protected async _executeRenderEachHook(fromRoute: KylinRouteItem): Promise<boolean> {
        if (!this.routes.current.route) {
            return true;
        }

        this.log("钩子执行: renderEach");
        await this.hooks.executeRenderEach(this.routes.current.route, fromRoute);

        return true;
    }

    /**
     * 执行渲染步骤
     */
    protected async _renderRoute(): Promise<void> {
        if (!this.routes.current.route) {
            return;
        }
        this.log("渲染流程: 开始渲染组件");
        try {
            // 使用新的递归渲染逻辑
            const matchedRoutes = this.routes.current.matchedRoutes || [];
            if (matchedRoutes.length > 0) {
                await this._renderRouteHierarchy(matchedRoutes);
            }
            this.log("渲染流程: 渲染完成");
        } catch (error) {
            console.error("渲染流程失败:", error);
            this.log("渲染流程: 渲染失败", error);
            // 渲染失败不阻塞导航流程
        }
    }

    /**
     * 完成导航流程：触发事件、执行钩子、重置状态
     * @param location - 导航位置信息
     * @param pathname - 路径名称
     * @param toRoute - 目标路由
     * @param fromRoute - 来源路由
     */
    protected async _finalizeNavigation(
        location: Update,
        pathname: string,
        toRoute: KylinRouteItem,
        fromRoute: KylinRouteItem,
    ): Promise<void> {
        // 触发 route/change 事件（用于后续的组件渲染）
        this.emit("route/change", {
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
        if (this.previous && this.previous.matchedRoutes) {
            this.hooks
                .executeRouteGuards(
                    this.previous.matchedRoutes,
                    toRoute,
                    this.previous,
                    "afterLeave",
                )
                .catch((error) => {
                    console.error("Error in afterLeave guards:", error);
                    // afterLeave 出错不影响导航流程
                });
        }

        // 触发 navigation/end 事件
        this.emit("navigation/end", {
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
    }

    /**
     * 路由更新回调 - 在 URL 变化时被调用
     * 执行路由匹配和参数提取
     */
    async onRouteUpdate(location: Update) {
        const pathname = location.location.pathname;
        const search = location.location.search;

        // 执行路由匹配并获取导航上下文
        const { fromRoute, toRoute } = this._matchRoute(pathname, search);

        // 执行全局前置守卫（beforeEach）
        const shouldContinue = await this._executeBeforeEachHooks(toRoute, fromRoute);
        if (!shouldContinue) {
            return;
        }

        // 执行路由级前置守卫（beforeEnter）
        const shouldEnter = await this._executeBeforeEnterGuards(fromRoute);
        if (!shouldEnter) {
            return;
        }

        // 并发加载组件和数据（使用 Promise.allSettled）
        const resourcesLoaded = await this._loadRouteResources(toRoute);
        if (!resourcesLoaded) {
            return;
        }

        // 执行 renderEach 钩子（数据预加载）
        const renderEachCompleted = await this._executeRenderEachHook(fromRoute);
        if (!renderEachCompleted) {
            return;
        }

        // 执行渲染步骤
        await this._renderRoute();

        // 完成导航流程：触发事件、执行钩子、重置状态
        await this._finalizeNavigation(location, pathname, toRoute, fromRoute);
    }

    /**
     * 确保 router 已 attached，否则抛出错误
     * @throws {Error} - 如果 router 未 attached
     */
    protected _ensureAttached(): void {
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
            // 无父路由，回退到根路径
            this.replace("/");
        }
    }

    push(path: string, state?: unknown) {
        this._ensureAttached();
        this._pendingNavigationType = "push";
        this.log(`导航方法: push(${path})`);

        // 检查是否为模态路由（! 前缀）
        if (path.startsWith("!")) {
            const modalPath = path.slice(1); // 移除 ! 前缀
            this.log(`检测到模态路由: ${modalPath}`);
            // 直接触发模态路由，不进入 history
            this.openModal({ route: modalPath });
            return;
        }

        // 触发 navigation/start 事件
        this.emit("navigation:start", {
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
        // 触发 navigation/start 事件
        this.emit("navigation:start", {
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

        // 触发 navigation/start 事件
        this.emit("navigation:start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.back();
    }
    forward() {
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log("导航方法: forward()");
        // 触发 navigation/start 事件
        this.emit("navigation:start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.forward();
    }
    go(delta: number) {
        this._ensureAttached();
        this._pendingNavigationType = "pop";
        this.log(`导航方法: go(${delta})`);
        // 触发 navigation/start 事件
        this.emit("navigation:start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.go(delta);
    }

    /**
     * 渲染到所有匹配的 outlet（Task 5：集成渲染流程）
     * 支持并行渲染策略（D-05）
     * @deprecated 使用 _renderRouteHierarchy 替代
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
                // 使用 Render 类渲染组件（Render 是通过 Mixin 继承的）
                await super.renderToOutlet(loadResult, outlet, {
                    mode: (route as any).renderMode,
                });
            } catch (error) {
                console.error(`渲染 outlet [${outlet.path || "default"}] 失败:`, error);
            }
        });

        // 等待所有渲染完成（并行渲染）
        await Promise.all(renderPromises);
    }
    private _isViewExpires(route: KylinRouteItem) {}

    /**
     * 递归渲染路由层级结构
     * 按照路由分层逐层渲染，每层在父 outlet 内部查找或创建子 outlet
     */
    protected async _renderRouteHierarchy(
        this: KylinRouter,
        matchedRoutes: Array<{
            route: KylinRouteItem;
            params: Record<string, string>;
            remainingPath: string;
        }>,
    ): Promise<void> {
        if (!matchedRoutes || matchedRoutes.length === 0) {
            this.log("渲染流程: 无匹配路由需要渲染");
            return;
        }

        this.log(`渲染流程: 开始递归渲染 ${matchedRoutes.length} 层路由`);

        let parentElement = this.host;

        for (let i = 0; i < matchedRoutes.length; i++) {
            const match = matchedRoutes[i];
            const route = match.route;

            this.log(`渲染流程: 渲染第 ${i + 1} 层 - ${route.name} (${route.path})`);

            // 查找或创建 outlet（只有根路由才自动创建）
            const isRootRoute = i === 0;
            let outlet = this._findOrCreateOutlet(parentElement, isRootRoute);
            if (!outlet) {
                this.log(`渲染流程: 路由 ${route.name} 无法找到 <kylin-outlet>`);
                return;
            }

            // 设置 RouteItem.el 指向当前 outlet
            route.el = new WeakRef(outlet);

            // 检查当前层是否已加载组件
            const viewOptions = getRouteViewOptions(route, this);
            let viewTemplate = route._viewTemplate;

            if (viewTemplate) {
            }
            // 如果有 view 但还没有加载，先显示 loading
            if (!viewTemplate) {
                this.log(`渲染流程: 路由 ${route.name} 需要加载，先显示 loading`);
                this._showLoadingInOutlet(outlet);

                // 加载 view
                loadResult = await this._loadViewForRoute(route);

                if (!loadResult) {
                    this.log(`渲染流程: 路由 ${route.name} 加载失败`);
                    this._hideLoadingInOutlet(outlet);
                    continue;
                }
            }

            // 如果没有内容，跳过渲染
            if (!loadResult) {
                this.log(`渲染流程: 路由 ${route.name} 无组件内容，跳过渲染`);
                parentElement = outlet;
                continue;
            }

            // 渲染到 outlet（会自动替换 loading）
            try {
                await super.renderToOutlet(loadResult, outlet, {
                    mode: (route as any).renderMode,
                });
                this.log(`渲染流程: 路由 ${route.name} 渲染成功`);
            } catch (error) {
                console.error(`渲染流程: 路由 ${route.name} 渲染失败:`, error);
                this._hideLoadingInOutlet(outlet);
                return;
            }

            // 如果有数据，设置 x-data
            if (route.data) {
                const hash = this._generateRouteHash(route);
                (outlet as any).addStore(hash, route.data);
                this.log(`渲染流程: 路由 ${route.name} 数据已设置`);
            }

            // 下一层在当前 outlet 内部查找
            parentElement = outlet;
        }

        this.log("渲染流程: 递归渲染完成");
    }

    /**
     * 在 outlet 中显示 loading 状态
     */
    protected _showLoadingInOutlet(outlet: HTMLElement): void {
        this.log("渲染流程: 显示 loading 状态");

        // 创建 loading 元素
        const loadingElement = document.createElement("kylin-loading");
        loadingElement.setAttribute("data-role", "loading-indicator");

        // 清空 outlet 并插入 loading
        outlet.innerHTML = "";
        outlet.appendChild(loadingElement);
    }

    /**
     * 隐藏 outlet 中的 loading 状态
     */
    protected _hideLoadingInOutlet(outlet: HTMLElement): void {
        this.log("渲染流程: 隐藏 loading 状态");

        const loadingElement = outlet.querySelector("kylin-loading[data-role='loading-indicator']");
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    /**
     * 为单个路由加载 view
     * @param route - 路由项
     * @returns 加载的内容或 null
     */
    protected async _loadViewForRoute(route: KylinRouteItem): Promise<any> {
        if (!route.view) {
            return null;
        }

        this.log(`渲染流程: 加载路由 ${route.name} 的 view`);

        try {
            // 检查缓存
            const cache = this._getValidCache(route);
            if (cache !== null) {
                this.log(`渲染流程: 路由 ${route.name} 使用缓存内容`);
                (route as any).viewContent = cache;
                return cache;
            }

            // 无有效缓存，执行加载逻辑
            const view = route.view;
            let loadResult;
            let cacheDuration = 0; // 默认不缓存

            if (isViewOptions(view)) {
                // 提取缓存配置
                cacheDuration = view.cache || 0;

                loadResult = await this.viewLoader.loadView(
                    typeof view.form === "string" || typeof view.form === "function"
                        ? view.form
                        : view.form,
                    view,
                );
            } else if (typeof view === "string" || typeof view === "function") {
                loadResult = await this.viewLoader.loadView(view, undefined);
            } else {
                loadResult = { success: true, content: view };
            }

            if (loadResult.success) {
                this.log(`渲染流程: 路由 ${route.name} view 加载成功`);
                const content = loadResult.content;

                // 设置到 viewContent
                (route as any).viewContent = content;

                // 如果需要缓存，保存到 _viewTemplate
                if (cacheDuration > 0) {
                    this._setCache(route, content, cacheDuration);
                    this.log(`渲染流程: 路由 ${route.name} 内容已缓存 ${cacheDuration}ms`);
                }

                return content;
            } else {
                this.log(`渲染流程: 路由 ${route.name} view 加载失败`, loadResult.error);
                return null;
            }
        } catch (error) {
            console.error(`渲染流程: 路由 ${route.name} view 加载异常:`, error);
            return null;
        }
    }

    /**
     * 获取有效的缓存内容
     * @param route - 路由项
     * @returns 缓存内容，如果缓存无效或不存在则返回 null
     */
    protected _getValidCache(route: KylinRouteItem): any {
        const cache = (route as any)._viewTemplate;
        if (!cache) {
            return null;
        }

        const now = Date.now();
        const elapsed = now - cache.timestamp;

        // 检查缓存是否过期
        if (elapsed > cache.duration) {
            this.log(
                `渲染流程: 路由 ${route.name} 缓存已过期 (${elapsed}ms > ${cache.duration}ms)`,
            );
            return null;
        }

        return cache.content;
    }

    /**
     * 设置缓存
     * @param route - 路由项
     * @param content - 要缓存的内容
     * @param duration - 缓存有效期（毫秒）
     */
    protected _setCache(route: KylinRouteItem, content: any, duration: number): void {
        (route as any)._viewTemplate = {
            content: content,
            timestamp: Date.now(),
            duration: duration,
        };
    }

    /**
     * 在父元素内部查找或创建 outlet
     * @param parent - 父元素
     * @param allowCreate - 是否允许自动创建 outlet（仅根路由为 true）
     * @returns 找到或创建的 outlet 元素
     */
    protected _findOrCreateOutlet(
        parent: HTMLElement,
        allowCreate: boolean = false,
    ): HTMLElement | null {
        // 先尝试查找现有的 outlet
        let outlet = findOutletInElement(parent);

        if (outlet) {
            this.log("渲染流程: 找到现有 outlet");
            return outlet;
        }

        // 如果没有找到且允许创建，自动创建一个（仅根路由）
        if (allowCreate) {
            this.log("渲染流程: 未找到 outlet，自动创建");
            const newOutlet = document.createElement("kylin-outlet");
            parent.appendChild(newOutlet);
            return newOutlet;
        }

        // 子路由找不到 outlet，返回 null
        this.log("渲染流程: 未找到 outlet，且不允许自动创建");
        return null;
    }

    /**
     * 生成路由哈希标识
     * 用于 Alpine.js store 的命名
     */
    protected _generateRouteHash(route: KylinRouteItem): string {
        // 使用路由名称作为哈希
        return `route-${route.name}`;
    }

    /**
     * 确保 host 元素内部有至少一个 outlet
     * 如果没有，自动创建并插入一个默认 outlet
     */
    protected _ensureDefaultOutlet(): void {
        const existingOutlet = findOutletInElement(this.host);
        if (existingOutlet) {
            this.log("自动插入 outlet: host 内部已有 outlet，跳过创建");
            return;
        }

        this.log("自动插入 outlet: host 内部没有 outlet，自动创建");
        const defaultOutlet = document.createElement("kylin-outlet");
        this.host.appendChild(defaultOutlet);
        this.log("自动插入 outlet: 默认 outlet 已创建并插入");
    }

    /**
     * 检查 outlet 是否匹配当前路由
     */
    private _outletMatchesRoute(outlet: any, route: KylinRouteItem): boolean {
        if (!outlet.path) return true;
        return route.path === outlet.path || route.path.startsWith(outlet.path + "/");
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

    attach(): void {
        if (this.attached) {
            throw new Error("[KylinRouter] Already attached to a host element");
        }

        this.history = this.mode === "hash" ? createHashHistory() : createBrowserHistory();

        // 初始化路由表注册器
        this.routes = new RouteRegistry(this);
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
        this.routes.initRoutes(this.options.routes, this.options.notFound);

        // 初始化钩子管理器
        this.hooks = new HookManager(this);

        // 初始化组件加载器，传递全局视图选项
        this.viewLoader = new ViewLoader(this, this.options.viewOptions);

        // 初始化数据加载器，传递全局数据选项
        this.dataLoader = new DataLoader(this, this.options.dataOptions);

        // 开始监听路由变化
        this._cleanups.push(this.history.listen(this.onRouteUpdate.bind(this)));

        // 设置 context provider
        this.attachContextProvider();

        // 初始化模态容器
        this._initModals();

        // 初始化 Alpine.js
        this.alpineManager = new AlpineManager(this);

        // 自动插入默认 outlet（如果 host 内部没有 outlet）
        this._ensureDefaultOutlet();

        // 标记为已绑定
        this.attached = true;

        // 执行初始路由匹配
        this.routes.matchCurrentLocation();

        // 自动导航到 home 路径
        // 如果当前没有匹配到路由，或者当前路径是 base 路径本身，则导航到 home
        const currentPath = this.history.location.pathname;
        const hasMatchedRoute = this.routes.current.route !== null;

        if (!hasMatchedRoute && this.options.home) {
            // 构造完整的 home 路径（base + home）
            const fullPath = this.base + this.options.home;
            this.log(`自动导航到 home 路径: ${fullPath}（当前路径: ${currentPath}）`);
            this.replace(fullPath);
        }
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

        // 清理 Alpine.js
        if (this.alpineManager) {
            this.alpineManager.cleanup();
        }

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
}
