/**
 * 钩子系统相关类型定义
 */

import type { KylinRouteItem } from "./routes";

// ============================================================================
// 现有钩子类型（保留原有结构和功能）
// ============================================================================

/**
 * beforeEach 钩子函数类型
 * 在导航执行前执行，可以取消导航或重定向
 * @param to - 目标路由
 * @param from - 来源路由
 * @param next - 控制导航流程的回调函数
 * @param router - 路由器实例
 * @returns 可以返回 void 或 Promise<void>，通过 next 回调控制导航
 */
export type BeforeEachHook = (
    to: KylinRouteItem,
    from: KylinRouteItem,
    next: (result?: boolean | string) => void,
    router: any,
) => void | Promise<void>;

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
    to: KylinRouteItem,
    from: KylinRouteItem,
    next: (data?: KylinRouteDataSource) => void,
    router: any,
) => void | Promise<void> | KylinRouteDataSource | Promise<KylinRouteDataSource>;

/**
 * afterEach 钩子函数类型
 * 在导航完成后执行
 * @param to - 目标路由
 * @param from - 来源路由
 * @param router - 路由器实例
 * @returns 可以返回 void 或 Promise<void>
 */
export type AfterEachHook = (
    to: KylinRouteItem,
    from: KylinRouteItem,
    router: any,
) => void | Promise<void>;

/**
 * 钩子集合对象类型
 * 包含所有可用的全局钩子数组
 */
export type KylinRouterHooks = {
    beforeEach: BeforeEachHook[];
    renderEach: RenderEachHook[];
    afterEach: AfterEachHook[];
};

/**
 * 钩子类型的键
 * 用于索引访问 KylinRouterHooks 对象
 */
export type KylinRouterHookType = keyof KylinRouterHooks;

// ============================================================================
// 从 types.ts 扩展的类型
// ============================================================================

/**
 * 通用钩子函数类型
 * 与 BeforeEachHook 类似但更通用，可用于各种钩子场景
 * @param to - 目标路由
 * @param from - 来源路由
 * @param next - 控制导航流程的回调函数
 * @param router - 路由器实例
 * @returns 可以返回 void 或 Promise<void>，通过 next 回调控制导航
 *
 * @remarks
 * 这是 HookFunction 的通用版本，与 BeforeEachHook 功能相同。
 * 保留 BeforeEachHook 是为了向后兼容性。
 * 新代码建议使用 BeforeEachHook 以获得更好的类型安全性。
 */
export type HookFunction = (
    to: KylinRouteItem,
    from: KylinRouteItem,
    next: (result?: boolean | string) => void,
    router: any,
) => void | Promise<void>;

/**
 * 钩子类型常量对象
 * 使用对象字面量替代 enum，以符合 erasableSyntaxOnly 配置
 *
 * @remarks
 * 这些常量与 HookType 类型互补：
 * - HookType 是 TypeScript 类型，用于类型检查
 * - HookTypeValues 是运行时常量对象，用于实际值访问
 *
 * @example
 * ```ts
 * // 使用类型
 * const hookType: HookType = 'beforeEach';
 *
 * // 使用常量
 * const hookTypeValue = HookTypeValues.BEFORE_EACH; // 'beforeEach'
 * ```
 */
export const HookTypeValues = {
    /** 导航前执行，可以取消导航或重定向 */
    BEFORE_EACH: "beforeEach",
    /** 渲染前执行，用于数据预取 */
    RENDER_EACH: "renderEach",
    /** 导航完成后执行 */
    AFTER_EACH: "afterEach",
};

/**
 * 钩子类型的值类型
 * 所有可能的钩子类型值的联合类型
 */
export type HookType = "beforeEach" | "renderEach" | "afterEach";

/**
 * 预加载的数据类型
 * 由 renderEach 钩子填充，组件可以通过 route.data 访问这些数据
 *
 * @remarks
 * 这是一个灵活的数据类型，允许存储任意结构的数据。
 * 建议在具体应用中定义更精确的数据类型以获得更好的类型安全性。
 *
 * @param string - 简单的url数据,从远程加载数据
 * @param Record<string, any> - 任意键值对数据
 * @param () => Record<string, any> | Promise<Record<string, any>> - 支持同步或异步函数返回数据
 */
export type KylinRouteDataSource =
    | string
    | Record<string, any>
    | (() => Record<string, any> | Promise<Record<string, any>>);

export type KylinRouteDataOptions = {
    /**
     * 数据来源
     *
     * - string: 一个URL地址，从该地址读取数据，返回一个{}
     * - {}: 静态数据
     * - Function: 返回{}的函数
     */
    from: KylinRouteDataSource;
    /**
     * 用于取消加载
     */
    signal?: AbortSignal;
    /**
     * 加载超时时间，单位毫秒
     * 默认：5000ms
     */
    timeout?: number;
    /**
     *
     * 默认情况下，data会被转为为所有outlet的x-data属性
     *
     * 如果scope=<string>，则在全局$store创建一个store
     *
     * 如scope="auth"
     *
     * 则会使用Alpine.store("auth",data)
     *
     * 这样在整个应用中，就可以使用$store.auth来访问数据了
     *
     */
    scope?: string;
    /**
     * 缓存
     *
     * - undefined: 不启用缓存
     * - string: 启用缓存数据时指定缓存键，支持字符串插值,可以用插值变量
     *    - path: 当前路由完整路径，保持路径中的参数，如path="/users/:id"
     *    - basepath: 当前路由完整路径，
     *    - url: 当前访问时的url，如path="/users/123d"
     *    - query和params中的所有成员值,如,path="/users/:id"时，"{id}"中的id就是该参数
     * - boolean: true代表启用默认的缓存策略，cacheKey="{path}"
     */
    cache?: string | boolean;
    /**
     * 当启用缓存时，缓存的过期时间
     * 默认0代表不过期。
     */
    expires?: number;
    /**
     * 当加载失败时提供一些默认值
     * 加载成功后可以使用Object.assign(default,data)合并，以避免加载数据的缺失
     */
    default?: Record<string, any>;
    /**
     * 是否预加载
     *
     * - true: 在路由实例创建时自动预加载进缓存，这可以加速数据加载
     * - false: 默认值，不预加载
     */
    preload?: boolean;
};
