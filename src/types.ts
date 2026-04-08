export interface RouteItem {
    /**
     * 路由名称，必须同级唯一，
     *
     * 用于作为url的标识符，生成url路径，以及在路由导航中显示
     *
     */
    name: string;
    /**
     * 预加载的数据，由 renderEach 钩子填充
     * 组件可以通过 route.data 访问这些数据
     */
    data?: RouteData;
    /**
     * 路由路径，支持以下语法：
     * - 静态路径：/user、/about
     * - 动态参数：/user/:id、/user/<id>
     * - 正则约束：/user/:id(\d+)
     * - 通配符：* 匹配任意路径
     *
     * 子路由不以 / 开头时为相对路径，自动继承父路由路径
     */
    path: string;
    /**
     * 路由标题，通常用于显示在导航菜单或标签页上
     */
    title?: string;
    /**
     * 调用url加载HTML时传递的路由参数
     */
    query?: Record<string, any>;
    /**
     * 调用url加载HTML时传递的路由参数
     */
    params?: Record<string, any>;
    /**
     * 路由图标，通常用于显示在导航菜单上
     */
    icon?: string;
    /**
     *
     * 路由显示组件
     *
     * - string:  从此路径加载HTML内容，即lit模板，支持相对路径和绝对路径
     * - HTMLElement:  使用指定的HTMLElement元素作为路由显示组件
     *
     */
    view?: string | HTMLElement;
    /**
     * 是否缓存此路由对应的组件实例，默认为 false
     *
     * 当 keepAlive 为 true 时，路由组件实例会被缓存起来，即使用户离开了这个路由，组件实例也不会被销毁。
     * 当用户再次访问这个路由时，会复用之前的组件实例，而不是重新创建一个新的实例。
     * 这对于一些需要保持状态的页面非常有用，比如表单页面、数据列表页面等，
     * 可以避免用户离开后数据丢失或者需要重新加载的问题。
     */
    keepAlive?: boolean;
    /**
     * 在load(url)方法加载HTML时，是否显示全局Loading组件，默认为 true
     * - true：显示全局Loading组件，直到HTML内容加载完成后才隐藏
     * - false：不显示全局Loading组件，HTML内容加载过程中不会有任何加载提示
     * - string：显示自定义的HTML内容作为加载提示，直到HTML内容加载完成后才隐藏
     * - HTMLElement：显示指定的HTMLElement元素作为加载提示，直到HTML内容加载完成后才隐藏
     */
    loading?: boolean | string | HTMLElement;
    roles?: string[];
    redirect?: string;
    children?: RouteItem[];
    meta?: Record<string, any>;

    /**
     * 路由级守卫：在进入该路由前执行
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns boolean | Promise<boolean> - true 继续导航，false 取消导航
     * @returns string - 重定向路径
     */
    beforeEnter?: (to: RouteItem, from: RouteItem) => boolean | string | Promise<boolean | string>;
    /**
     * 路由级守卫：在离开该路由后执行
     * @param to - 目标路由
     * @param from - 来源路由（当前路由）
     */
    afterLeave?: (to: RouteItem, from: RouteItem) => void | Promise<void>;
    /**
     * 路由级 renderEach 钩子，用于数据预加载
     * 在组件加载后、渲染前执行
     * @param to - 目标路由
     * @param from - 来源路由
     * @param next - 控制钩子流程的回调函数，可以传递预加载的数据
     * @param router - 路由器实例
     */
    renderEach?: RenderEachHook | RenderEachHook[];
    /**
     * 错误边界配置
     */
    errorBoundary?: ErrorBoundaryConfig;
    /**
     * 加载状态配置
     */
    loadingConfig?: LoadingConfig;
    /**
     * 重试策略配置
     */
    retry?: RetryConfig;
}

export type KylinRoutes =
    | RouteItem[]
    | RouteItem
    | string
    | (() => KylinRoutes | Promise<KylinRoutes>);

/**
 * 路由匹配结果
 */
export interface MatchedRoute {
    /** 匹配的路由配置 */
    route: RouteItem;
    /** 提取的路径参数 */
    params: Record<string, string>;
    /** 剩余未匹配的路径，用于嵌套路由 */
    remainingPath: string;
}

/**
 * 钩子函数类型定义
 * @param to - 目标路由
 * @param from - 来源路由
 * @param next - 控制导航流程的回调函数
 * @param router - 路由器实例
 * @returns 可以返回 void 或 Promise<void>，通过 next 回调控制导航
 */
export type HookFunction = (
    to: RouteItem,
    from: RouteItem,
    next: (result?: boolean | string) => void,
    router: any,
) => void | Promise<void>;

/**
 * 钩子类型常量对象
 * 使用对象字面量替代 enum，以符合 erasableSyntaxOnly 配置
 */
export const HookType = {
    /** 导航前执行，可以取消导航或重定向 */
    BEFORE_EACH: "beforeEach",
    /** 渲染前执行，用于数据预取 */
    RENDER_EACH: "renderEach",
    /** 导航完成后执行 */
    AFTER_EACH: "afterEach",
} as const;

export type HookType = (typeof HookType)[keyof typeof HookType];

/**
 * 预加载的数据类型
 * 由 renderEach 钩子填充，组件可以通过 route.data 访问这些数据
 */
export type RouteData = Record<string, any>;

/**
 * renderEach 钩子函数类型
 * 在组件加载后、渲染前执行，用于数据预取
 * @param to - 目标路由
 * @param from - 来源路由
 * @param next - 控制钩子流程的回调函数，可以传递预加载的数据
 * @param router - 路由器实例
 * @returns 可以返回 void、Promise<void>、RouteData 或 Promise<RouteData>
 */
export type RenderEachHook = (
    to: RouteItem,
    from: RouteItem,
    next: (data?: RouteData) => void,
    router: any,
) => void | Promise<void> | RouteData | Promise<RouteData>;

/**
 * 重试策略配置
 */
export interface RetryConfig {
    /** 最大重试次数（默认 3） */
    max?: number;
    /** 重试延迟，单位毫秒（默认 1000） */
    delay?: number;
    /** 退避策略：'linear' 线性增长，'exponential' 指数增长（默认 linear） */
    backoff?: "linear" | "exponential";
    /** 重试回调函数，每次重试时调用 */
    onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 错误边界配置
 */
export interface ErrorBoundaryConfig {
    /** 错误组件：字符串路径或动态导入函数 */
    component?: string | (() => Promise<any>);
    /** 回退 UI：错误时显示的 HTML 字符串 */
    fallback?: string;
    /** 错误回调函数 */
    onError?: (error: Error, errorInfo: any) => void;
    /** 是否重试：true 表示使用默认重试策略，对象表示自定义重试策略 */
    retry?: boolean | RetryConfig;
}

/**
 * 加载状态配置
 */
export interface LoadingConfig {
    /** 自定义加载模板 */
    template?: any;
    /** 加载超时时间，单位毫秒 */
    timeout?: number;
    /** 错误时是否显示加载状态（默认 false） */
    showOnError?: boolean;
}

/**
 * 导航版本号类型
 */
export type NavigationVersion = number;

export type KylinRouterOptiopns = {
    /** 路由模式：'history' 使用 BrowserHistory，'hash' 使用 HashHistory（默认 'history'） */
    mode?: "hash" | "history";
    /** 基础路径，用于 Hash 模式（默认 ''） */
    base?: string;
    routes: KylinRoutes;
    /** 未匹配路由时的 404 路由配置 */
    notFound?: RouteItem;
    /** 默认路径重定向 */
    defaultRoute?: string;
    onBeforeResolve?: (to: RouteItem, from: RouteItem) => boolean | Promise<boolean>;
    onBeforeEach?: (to: RouteItem, from: RouteItem) => boolean | Promise<boolean>;
    onAfterEach?: (to: RouteItem, from: RouteItem) => void | Promise<void>;
    /** 全局 renderEach 钩子，用于数据预加载 */
    renderEach?: RenderEachHook | RenderEachHook[];
    /** 是否启用调试模式，启用后会输出详细的导航日志（默认 false） */
    debug?: boolean;
    /** 全局错误组件：字符串路径或动态导入函数 */
    defaultErrorComponent?: string | (() => Promise<any>);
    /** 全局加载模板 */
    defaultLoadingTemplate?: any;
};
