import type { KylinMatchedRouteItem, ErrorPageHandler } from "@/types";

/**
 * 默认的 404 错误页面处理器
 * 使用 kylin-feedback 组件显示
 */
export const default404Handler: ErrorPageHandler = (
    error: any,
    route: KylinMatchedRouteItem[]
): HTMLElement => {
    const el = document.createElement("kylin-feedback");
    el.type = "error";
    el.message = "404";
    el.description = "页面未找到，请检查 URL 是否正确";
    el.backable = true;
    return el;
};

/**
 * 默认的 500 错误页面处理器
 */
export const default500Handler: ErrorPageHandler = (
    error: any,
    route: KylinMatchedRouteItem[]
): HTMLElement => {
    const el = document.createElement("kylin-feedback");
    el.type = "error";
    el.message = "500";
    el.description = error?.message || "服务器内部错误";
    el.retryable = true;
    el.backable = true;
    return el;
};

/**
 * 默认的通用错误页面处理器（兜底）
 */
export const defaultErrorHandler: ErrorPageHandler = (
    error: any,
    route: KylinMatchedRouteItem[]
): HTMLElement => {
    const statusCode = error?.status || error?.statusCode || 500;
    const message = error?.message || "未知错误";

    const el = document.createElement("kylin-feedback");
    el.type = "error";
    el.message = String(statusCode);
    el.description = message;
    el.retryable = true;
    el.backable = true;
    return el;
};

/**
 * 获取默认的 errorPages 配置
 */
export function getDefaultErrorPages(): Record<string, ErrorPageHandler> {
    return {
        "404": default404Handler,
        "500": default500Handler,
        "*": defaultErrorHandler,
    };
}
