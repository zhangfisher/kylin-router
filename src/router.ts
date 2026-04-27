import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory, createHashHistory } from "history";
import type { Update } from "history";
import type {
    KylinRouterOptions,
    KylinRouteItem,
    ModalState,
    KylinMatchedRouteItem,
} from "./types/index";
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
import { getBaseUrl } from "@/utils/getBaseUrl";

import { HookManager } from "./features/hooks";
import { RouteRegistry } from "./features/routes";
import { AlpineManager } from "./features/alpine";

import { matchRoute } from "./utils";
import { createLogger, type KylinRouterLogger } from "./logger";

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
    private _logger?: KylinRouterLogger;
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
    public options: KylinRouterOptions;

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
        options: KylinRouterOptions | KylinRouterOptions["routes"] = [],
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
    get logger() {
        if (!this._logger) {
            if (this.options.logger) {
                this._logger = this.options.logger;
            } else {
                this._logger = createLogger();
            }
        }
        return this._logger!;
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
        toRoute: KylinMatchedRouteItem[];
    } {
        const fromRoute = this.routes.current;
        const toRoute = matchRoute(pathname + "?" + search, this.routes.routes);
        return { fromRoute, toRoute };
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
        const shouldContinue = await this.hooks.runBeforeRoute({
            from: fromRoute,
            to: toRoute,
        });
        if (!shouldContinue) {
            return;
        }
        // 加载路由视图和数据
        this.viewLoader.loadViews(toRoute);
        this.dataLoader.loadDatas(toRoute);

        // 执行渲染步骤
        await this._renderRoute(toRoute, fromRoute);
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
        this.logger.debug(`导航方法: push(${path})`);

        // 检查是否为模态路由（! 前缀）
        if (path.startsWith("!")) {
            const modalPath = path.slice(1); // 移除 ! 前缀
            this.logger.debug(`检测到模态路由: ${modalPath}`);
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
        this.logger.debug(`导航方法: replace(${path})`);
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
        this.logger.debug("导航方法: back()");

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
        this.logger.debug("导航方法: forward()");
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
        this.logger.debug(`导航方法: go(${delta})`);
        // 触发 navigation/start 事件
        this.emit("navigation:start", {
            path: undefined,
            navigationType: "pop",
        });
        this.history.go(delta);
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
        this.viewLoader = new ViewLoader(this);

        // 初始化数据加载器，传递全局数据选项
        this.dataLoader = new DataLoader(this);

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
            this.logger.debug(`自动导航到 home 路径: ${fullPath}（当前路径: ${currentPath}）`);
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
