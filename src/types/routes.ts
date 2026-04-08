/**
 * 路由配置相关类型定义
 */

import type { RenderEachHook, RouteData } from './hooks';

// 重新导出 RouteData 以保持向后兼容
export type { RouteData };

/**
 * 路由配置项
 */
export interface RouteItem {
    /**
     * 路由名称，必须同级唯一
     *
     * 用于作为url的标识符，生成url路径，以及在路由导航中显示
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
     * - 通则符：* 匹配任意路径
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
     * 路由显示组件
     *
     * - string:  从此路径加载HTML内容，支持相对路径和绝对路径
     * - HTMLElement:  使用指定的HTMLElement元素作为路由显示组件
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

    onBeforeEnter?: (to: RouteItem, from: RouteItem) => boolean | Promise<boolean>;
    onBeforeUpdate?: (to: RouteItem, from: RouteItem) => void;
    onBeforeLeave?: (to: RouteItem, from: RouteItem) => void;

    /**
     * 路由级守卫：在进入该路由前执行
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns boolean | Promise<boolean> - true 继续导航，false 取消导航
     * @returns string - 重定向路径
     */
    beforeEnter?: (
        to: RouteItem,
        from: RouteItem
    ) => boolean | string | Promise<boolean | string>;

    /**
     * 路由级守卫：在离开该路由后执行
     * @param to - 目标路由
     * @param from - 来源路由（当前路由）
     */
    afterLeave?: (
        to: RouteItem,
        from: RouteItem
    ) => void | Promise<void>;

    /**
     * 路由级 renderEach 钩子，用于数据预加载
     * 在组件加载后、渲染前执行
     * @param to - 目标路由
     * @param from - 来源路由
     * @param next - 控制钩子流程的回调函数，可以传递预加载的数据
     * @param router - 路由器实例
     */
    renderEach?: RenderEachHook | RenderEachHook[];
}

/**
 * 路由配置类型
 * 支持多种配置形式
 */
export type KylinRoutes = RouteItem[] | RouteItem | string | (() => KylinRoutes | Promise<KylinRoutes>);

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
