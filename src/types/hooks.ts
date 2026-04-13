/**
 * 钩子系统相关类型定义
 */

import type { KylinRouter } from "@/router";
import type { KylinMatchedRouteItem, KylinRouteItem } from "./routes";
import type { KylinRouteDataSource } from "./data";

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
export type BeforeRouteHook = (
    from: KylinMatchedRouteItem[],
    to: KylinMatchedRouteItem[],
    next: (result?: boolean | string) => void,
    router: KylinRouter,
) => void | Promise<void>;

/**
 * afterEach 钩子函数类型
 * 在导航完成后执行
 * @param to - 目标路由
 * @param from - 来源路由
 * @param router - 路由器实例
 * @returns 可以返回 void 或 Promise<void>
 */
export type AfterRouteHook = (
    from: KylinMatchedRouteItem[],
    to: KylinMatchedRouteItem[],
    router: KylinRouter,
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
export type BeforeRenderHook = (
    from: KylinMatchedRouteItem[],
    to: KylinMatchedRouteItem[],
    view: string,
    data: KylinRouteDataSource | undefined,
    next: (result?: boolean | string) => void,
    router: KylinRouter,
) => void | Promise<void> | KylinRouteDataSource | Promise<KylinRouteDataSource>;

export type AfterRenderHook = (
    from: KylinMatchedRouteItem[],
    to: KylinMatchedRouteItem[],
    el: HTMLElement | undefined,
    next: (result?: boolean | string) => void,
    router: KylinRouter,
) => void | Promise<void> | KylinRouteDataSource | Promise<KylinRouteDataSource>;

/**
 * 钩子集合对象类型
 * 包含所有可用的全局钩子数组
 */
export type KylinRouterHooks = {
    beforeRoute: BeforeRouteHook[];
    afterRoute: AfterRouteHook[];
    beforeRender: BeforeRenderHook[];
    afterRender: AfterRenderHook[];
};

// ============================================================================
// 从 types.ts 扩展的类型
// ============================================================================

/**
 * 通用钩子函数类型
 * 与 BeforeEachHook 类似但更通用，可用于各种钩子场景
 * @param to - 目标路由
 * @param from - 来源路由
 * @param next - 控制导航流程的回调函数
 * @returns 可以返回 void 或 Promise<void>，通过 next 回调控制导航
 *
 * @remarks
 */
export type IHook = (
    from: KylinMatchedRouteItem[],
    to: KylinMatchedRouteItem[],
    next: (result?: boolean | string) => void,
) => void | Promise<void>;

/**
 * 钩子类型的键
 * 用于索引访问 KylinRouterHooks 对象
 */
export type KylinRouterHookType = keyof KylinRouterHooks;
