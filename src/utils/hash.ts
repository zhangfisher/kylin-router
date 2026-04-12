/**
 * 路由哈希生成工具
 * 用于生成唯一的路由标识符，支持字符串插值
 */

import type { KylinRouteItem } from "@/types/routes";
import { params as replaceParams } from "./params";

export type RouteHashVars =
    | "name" // 路由名称
    | "path" // 当前路由路径
    | "fullPath" // 当前完整路径
    | "url" // 当前完整路径
    | "query" // 路由查询字符串
    | "fullQuery" // 完整查询字符串，包括定义在路由中的所有查询
    | "timestamp";
/**
 *
 *
 *
 *
 * 生成路由哈希标识
 * @param route - 路由对象
 * @param fullPath - 当前完整路径
 * @param params - 当前路径参数
 * @param query - 当前查询参数
 * @returns 生成的哈希字符串
 */
export function generateRouteHash(hash: string | undefined, vars: Record<string, string>): string {
    // 使用默认值 "{path}" 如果未指定 hash
    const hashPattern = (hash || "{fullPath}").replace(/\s+/g, ""); // 移除所有空白字符

    // 使用插值函数生成 hash
    let result = replaceParams(hashPattern, vars);

    // 确保不以数字开头（Alpine.js store 名称限制）
    if (result && /^[0-9]/.test(result)) {
        result = "s_" + result;
    }
    // 转义特殊字符，确保是有效的 Alpine.js store 名称
    // 替换非字母数字字符为下划线（保留连字符和下划线）
    result = result.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (result.startsWith("_")) result = "h" + result;

    return result.replace(/__/g, "_");
}
