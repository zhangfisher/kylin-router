import type { KylinMatchedRouteItem } from "@/types";

/**
 * 从路由匹配项中提取并合并所有路由相关的变量
 * @param {KylinMatchedRouteItem} route - 路由匹配项对象
 * @returns {Object} 包含路由名称、哈希、路径、URL以及合并后的参数、查询和元数据的对象
 */
export function getRouteVars(route: KylinMatchedRouteItem) {
    return {
        name: route.route.name,
        hash: route.hash,
        path: route.path,
        url: route.url,
        ...route.route.params,
        ...route.route.query,
        ...route.route.meta,
        ...route.params,
        ...route.query,
        ...route.state,
    };
}
