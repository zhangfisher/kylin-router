/**
 * 路由器配置相关类型定义
 */

import type { KylinRoutes, RouteItem } from './routes';
import type { BeforeEachHook, RenderEachHook } from './hooks';

/**
 * 路由器配置选项
 */
export type KylinRouterOptiopns = {
    /** 路由模式：'history' 使用 BrowserHistory，'hash' 使用 HashHistory（默认 'history'） */
    mode?: "hash" | "history";
    /** 基础路径，用于 Hash 模式（默认 ''） */
    base?: string;
    /** 路由配置 */
    routes: KylinRoutes;
    /** 未匹配路由时的 404 路由配置 */
    notFound?: RouteItem;
    /** 默认路径重定向 */
    defaultRoute?: string;
    /** 导航解析前钩子 */
    onBeforeResolve?: BeforeEachHook;
    /** 全局前置守卫 */
    onBeforeEach?: BeforeEachHook;
    /** 全局后置钩子 */
    onAfterEach?: (to: RouteItem, from: RouteItem) => void | Promise<void>;
    /** 全局 renderEach 钩子，用于数据预加载 */
    onRenderEach?: RenderEachHook | RenderEachHook[];
    /** 是否启用调试模式，启用后会输出详细的导航日志（默认 false） */
    debug?: boolean;
    /** 宿主元素或选择器字符串（可选，用于 attach 方法） */
    host?: HTMLElement | string;
};
