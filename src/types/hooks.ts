/**
 * 钩子系统相关类型定义
 */

import type { RouteItem } from './routes';

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
    to: RouteItem,
    from: RouteItem,
    next: (result?: boolean | string) => void,
    router: any
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
    to: RouteItem,
    from: RouteItem,
    next: (data?: RouteData) => void,
    router: any
) => void | Promise<void> | RouteData | Promise<RouteData>;

/**
 * afterEach 钩子函数类型
 * 在导航完成后执行
 * @param to - 目标路由
 * @param from - 来源路由
 * @param router - 路由器实例
 * @returns 可以返回 void 或 Promise<void>
 */
export type AfterEachHook = (
    to: RouteItem,
    from: RouteItem,
    router: any
) => void | Promise<void>;

/**
 * 钩子集合对象类型
 * 包含所有可用的全局钩子数组
 */
export type KylinRouterHooks = {
    beforeEach: BeforeEachHook[];
    renderEach: RenderEachHook[];
    afterEach: AfterEachHook[];
}

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
    to: RouteItem,
    from: RouteItem,
    next: (result?: boolean | string) => void,
    router: any
) => void | Promise<void>;

/**
 * 钩子类型常量对象
 * 使用对象字面量替代 enum，以符合 erasableSyntaxOnly 配置
 *
 * @remarks
 * 这些常量与 KylinRouterHookType 类型互补：
 * - KylinRouterHookType 是 TypeScript 类型，用于类型检查
 * - HookType 是运行时常量对象，用于实际值访问
 *
 * @example
 * ```ts
 * // 使用类型
 * const hookType: KylinRouterHookType = 'beforeEach';
 *
 * // 使用常量
 * const hookTypeValue = HookType.BEFORE_EACH; // 'beforeEach'
 * ```
 */
export const HookType = {
    /** 导航前执行，可以取消导航或重定向 */
    BEFORE_EACH: 'beforeEach',
    /** 渲染前执行，用于数据预取 */
    RENDER_EACH: 'renderEach',
    /** 导航完成后执行 */
    AFTER_EACH: 'afterEach'
} as const;

/**
 * 钩子类型的值类型
 * 从 HookType 常量对象提取的所有可能值的联合类型
 */
export type HookType = typeof HookType[keyof typeof HookType];

/**
 * 预加载的数据类型
 * 由 renderEach 钩子填充，组件可以通过 route.data 访问这些数据
 *
 * @remarks
 * 这是一个灵活的数据类型，允许存储任意结构的数据。
 * 建议在具体应用中定义更精确的数据类型以获得更好的类型安全性。
 */
export type RouteData = Record<string, any>;
