/**
 * 路由哈希生成工具
 * 用于生成唯一的路由标识符，支持字符串插值
 */

import type { RouteItem } from "@/types/routes";
import { params } from "./params";

/**
 * 生成路由哈希标识
 * @param route - 路由对象
 * @param currentPath - 当前完整路径
 * @param currentParams - 当前路径参数
 * @param currentQuery - 当前查询参数
 * @returns 生成的哈希字符串
 */
export function generateRouteHash(
    route: RouteItem,
    currentPath: string,
    currentParams: Record<string, string>,
    currentQuery: Record<string, string>
): string {
    // 使用默认值 "{path}" 如果未指定 hash
    const hashPattern = route.hash || "{path}";

    // 构建插值变量
    const interpolationVars = {
        path: route.path,
        basepath: route.path,
        url: currentPath,
        timestamp: Date.now(),
        ...currentQuery,
        ...currentParams,
    };

    // 使用插值函数生成 hash
    let hash = params(hashPattern, interpolationVars);

    // 转义特殊字符，确保是有效的 Alpine.js store 名称
    // 替换非字母数字字符为下划线（保留连字符和下划线）
    hash = hash.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 确保不以数字开头（Alpine.js store 名称限制）
    if (hash && /^[0-9]/.test(hash)) {
        hash = '_' + hash;
    }

    return hash;
}
