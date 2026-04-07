export interface RouteItem {
    /**
     * 路由名称，必须同级唯一，
     *
     * 用于作为url的标识符，生成url路径，以及在路由导航中显示
     *
     */
    name: string;
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
     * - string:  从此路径加载HTML内容，支持相对路径和绝对路径
     * - HTMLElement:  使用指定的HTMLElement元素作为路由显示组件
     * 
     */
    component?: string | HTMLElement;
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
    onBeforeEnter?:(to: RouteItem, from: RouteItem) => boolean | Promise<boolean>;
    onBeforeUpdate?:(to: RouteItem, from: RouteItem) => void;
    onBeforeLeave?:(to: RouteItem, from: RouteItem) => void;
}

export type KylinRoutes = RouteItem[] | RouteItem;

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
};
