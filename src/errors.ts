import type { KylinMatchedRouteItem } from "./types";

export class KylinRouterError extends Error {
    status: number;
    route?: KylinMatchedRouteItem[];
    constructor(message: string, statusCode?: number, route?: KylinMatchedRouteItem[]) {
        super(message);
        this.status = statusCode || 0;
        this.route = route;
    }
}

// ============================================================================
// 路由匹配错误类型
// ============================================================================

/**
 * 路由匹配错误基类
 */
export class KylinRouteError extends Error {
    route?: KylinMatchedRouteItem;
    constructor(message: string, route?: KylinMatchedRouteItem) {
        super(message);
        this.route = route;
    }
}
export class KylinRouteNotFoundError extends KylinRouterError {}

/**
 * 最大重定向次数超出错误
 */
export class KylinRouteMaxRedirectError extends KylinRouteError {
    constructor(route: KylinMatchedRouteItem) {
        const chainStr = route.redirectFrom?.map((item) => item.url).join(" -> ");
        super(`Maximum redirect limit exceeded:${chainStr} -> ...`, route);
        this.name = "KylinRouteMaxRedirectError";
    }
}

/**
 * 重定向循环检测错误
 */
export class KylinRouteLoopExistedError extends KylinRouteError {
    constructor(route: KylinMatchedRouteItem) {
        const chainStr = route.redirectFrom?.map((item) => item.url).join(" -> ");
        super(`Redirect loop detected: ${chainStr} -> ${chainStr}`, route);
        this.name = "KylinRouteLoopExistedError";
    }
}
