/**
 * 路由器配置相关类型定义
 */

import type { KylinRoutes, RouteItem } from './routes';
import type { BeforeEachHook, RenderEachHook } from './hooks';
import type { TemplateResult } from 'lit';
import type { RouteViewOptions } from './routes';
import type { RouteDataOptions } from './hooks';

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
    template?: TemplateResult | string;
    /** 加载超时时间，单位毫秒 */
    timeout?: number;
    /** 错误时是否显示加载状态（默认 false） */
    showOnError?: boolean;
}

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
    /** 全局错误组件：字符串路径或动态导入函数 */
    defaultErrorComponent?: string | (() => Promise<any>);
    /** 全局加载模板 */
    defaultLoadingTemplate?: TemplateResult | string;
    /** 全局视图加载配置 */
    viewOptions?: Omit<RouteViewOptions, 'form'>;
    /** 全局数据加载配置 */
    dataOptions?: Omit<RouteDataOptions, 'from'>;
};
