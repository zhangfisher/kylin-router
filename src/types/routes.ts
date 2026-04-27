/**
 * 路由配置相关类型定义
 */

import type { AfterRenderHook, AfterRouteHook, BeforeRenderHook, BeforeRouteHook } from "./hooks";
import type { KylinRouteDataOptions } from "./data";
import type { KylinRouteDataSource } from "./data";
import type { TemplateResult } from "lit";
import type { ErrorBoundaryConfig, RetryConfig } from "./config";
import type { ModalConfig } from "./modals";
import type { IAsyncSignal } from "asyncsignal";
import type { BaseLoaderOptions } from "@/features/baseLoader";
// 重新导出 RouteData 以保持向后兼容
export type { KylinRouteDataSource as RouteData };

// 重新导出模态相关类型以保持向后兼容
export type { ModalConfig, ModalState, ModalStackItem, ModalOptions } from "./modals";

// ============================================================================
// 渲染系统相关类型定义
// ============================================================================

/**
 * 渲染模式枚举
 * - replace: 替换模式，新内容替换 outlet 中的旧内容（默认）
 * - append: 追加模式，新内容添加到现有内容之后
 */
export type KylinRenderMode = "replace" | "append";

/**
 * 模板数据类型
 * 用于存储模板变量和对应的值
 */
export type TemplateData = Record<string, any>;

/**
 * 视图源类型
 *
 * - string: 视图URL，用于从远程加载HTML内容
 * - HTMLElement: 直接使用指定的HTMLElement元素作为视图内容
 * - () => Promise<any>: 通过函数动态加载视图，支持动态导入和异步加载
 */
export type KylinRouteViewSource =
    | string
    | HTMLElement
    | ((route: KylinMatchedRouteItem) => string | HTMLElement | Promise<string | HTMLElement>);
/**
 * 渲染上下文接口
 * 提供模板渲染时所需的上下文数据
 */
export interface KylinRouteViewContext {
    /**
     * 当前路由对象，包含预加载的数据
     */
    $route: KylinRouteItem;
    /**
     * 查询参数对象
     */
    $query: Record<string, string>;
    /**
     * 路由参数对象
     */
    $params: Record<string, string>;
    /**
     * route.data 的字段会被展开为局部变量
     * 允许通过键值对访问其他上下文数据
     */
    [key: string]: any;
}

/**
 * 渲染选项接口
 * 配置组件渲染行为
 */
export interface KylinRenderOptions {
    /**
     * 渲染模式（默认 replace）
     */
    mode?: KylinRenderMode;

    /**
     * 目标 outlet 元素
     */
    outlet?: HTMLElement;

    /**
     * lit 模板（可选）
     */
    template?: TemplateResult;
}

// ============================================================================
// 组件加载相关类型定义
// ============================================================================

/**
 * 视图加载配置选项
 * 当 view 需要特殊配置时使用
 */
export interface KylinRouteViewOptions extends BaseLoaderOptions<string | HTMLElement> {
    /**
     * 是否允许不安全的 HTML（如 script 标签）
     * 默认为 false，会移除潜在的危险内容
     */
    allowUnsafe?: boolean;

    /**
     * 自定义内容提取选择器
     * 如果提供，将从加载的 HTML 中提取匹配该选择器的内容
     */
    selector?: string;
}

/**
 * 路由配置项
 */
export interface KylinRouteItem {
    name?: string;

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

    fullPath?: string;
    /**
     * 指向渲染此路由的 outlet 元素的 WeakRef
     * 用于嵌套路由的递归渲染
     */
    el?: WeakRef<HTMLElement>;

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
     * 可以是以下两种类型之一：
     *
     * 1. ViewSource - 视图源：
     *    - string: 从此路径加载HTML内容，支持相对路径和绝对路径
     *    - HTMLElement: 使用指定的HTMLElement元素作为路由显示组件
     *    - () => Promise<any>: 通过动态导入函数加载组件，支持本地组件和远程HTML内容
     *
     * 2. ViewOptions - 视图配置：
     *    - form: ViewSource - 视图源
     *    - allowUnsafeHTML: 是否允许不安全的HTML（默认 false）
     *    - timeout: 加载超时时间（默认 5000ms）
     *    - selector: 自定义内容提取选择器
     */
    view?: KylinRouteViewSource | KylinRouteViewOptions;
    /**
     * 内部属性：视图模板缓存
     * 用于存储已加载的视图内容，避免重复加载
     * 包含缓存内容和缓存时间戳
     *
     * 同一视图的视图数据是一样的
     *
     * @internal
     */
    _getView?: IAsyncSignal | null;
    _viewOptions: Required<KylinRouteViewOptions>;
    /**
     *
     * 在导航到此路由时预加载的数据，可以是以下类型：
     *
     * 这些数据会被作为路由视图渲染时使用的变量
     */
    data?: KylinRouteDataSource | KylinRouteDataOptions;
    /**
     * 缓存数据
     *
     * 不同url可能数据是不同的，比如/posts/:id
     * 调用不同的id参数时，需要分别进行加载和缓存
     */
    _getData?: IAsyncSignal | null;
    _dataOptions: Required<KylinRouteDataOptions>;
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

    /**
     * 路由哈希标识，用于 Alpine.js store 的命名和视图缓存
     * 支持字符串插值，可用变量：
     * - {path}: 路由路径
     * - {basepath}: 基础路径
     * - {url}: 完整 URL
     * - {timestamp}: 时间戳
     * - {query.*}: 查询参数
     * - {params.*}: 路径参数
     * @default "{path}"
     * @example
     * hash: "user-{params.id}" // 生成类似 "user-123" 的哈希
     * hash: "posts-{query.category}" // 生成类似 "posts-tech" 的哈希
     */
    hash?: string;
    /**
     * 是否预加载视图
     *
     * - true: 在初始化时自动加载视图数据
     */
    preload?: boolean;

    roles?: string[];
    /**
     * 重定向到其他路由
     * 支持绝对路径和相对路径
     *
     */
    redirect?: string;
    children?: KylinRouteItem[];
    meta?: Record<string, any>;

    beforeRoute?: BeforeRouteHook | BeforeRouteHook[];
    afterRoute?: AfterRouteHook | AfterRouteHook[];
    beforeRender?: BeforeRenderHook | BeforeRenderHook[];
    afterRender?: AfterRenderHook | AfterRenderHook[];

    /**
     * 错误边界配置
     */
    errorBoundary?: ErrorBoundaryConfig;
    /**
     * 当导航到此出错进的回退路由
     */
    fallback?: string;
    /**
     * 重试策略配置
     */
    retry?: RetryConfig;

    /**
     * 模态路由配置
     * - boolean: true 表示为模态路由，使用默认配置
     * - ModalConfig: 自定义模态配置
     */
    modal?: boolean | ModalConfig;
}

/**
 * 路由配置类型
 * 支持多种配置形式
 * 路由配置类型
 * 支持多种配置形式：
 * - 对象：具有一个根路由的路由配置
 * - 数组：多个根路由 配置
 * - 字符串：URL路径，从该路径加载路由表
 * - 函数：动态返回路由配置
 */
export type KylinRoutes =
    | KylinRouteItem[]
    | KylinRouteItem
    | string
    | (() =>
          | KylinRouteItem[]
          | KylinRouteItem
          | Promise<KylinRouteItem>
          | Promise<KylinRouteItem[]>);

/**
 * 路由匹配结果
 */
export interface MatchedRoute {
    /** 匹配的路由配置 */
    route: KylinRouteItem;
    /** 提取的路径参数 */
    params: Record<string, string>;
    /** 提取的查询参数 */
    query: Record<string, string>;

    /** 剩余未匹配的路径，用于嵌套路由 */
    remainingPath: string;
}

export type KylinMatchedRouteItem = {
    /** 匹配的路由配置 */
    route: KylinRouteItem;
    /** 提取的路径参数 */
    params: Record<string, string>;
    /** 提取的查询参数 */
    query: Record<string, string>;
    state: Record<string, any>;
    /**
     * 完整路由路径
     * 保留路由参数
     * /user/:id/
     *
     *
     */
    path: string;
    /**
     * 经过路由参数处理的完整路由路径
     *
     * 如： route.path=/user/:id/
     * 时url=/user/123
     * 
     * path和url的区别是：

     * path是路由的原始路径， 包含路由参数

     * url是经过路由参数处理后的路径， 路由参数已经被替换为实际的值
     *
     */
    url: string;
    hash: string;
};
