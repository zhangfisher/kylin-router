/**
 * 路由匹配算法
 *
 * 实现混合匹配策略：
 * - 叶子节点完全匹配
 * - 父节点支持前缀匹配以支持嵌套路由
 *
 * 匹配优先级：具体路径 > 参数化路径 > 通配符
 *
 * 按照 CONTEXT.md 决策 D-01 到 D-08 实现
 */

import type { RouteItem } from "@/types";

/**
 * 路由匹配结果
 */
export interface MatchedRoute {
    /** 匹配的路由配置 */
    route: RouteItem;
    /** 提取的路径参数 */
    params: Record<string, string>;
    /** 剩余未匹配的路径，用于嵌套路由 */
    remainingPath: string;
    /** 匹配的路由链（从根到叶子节点，用于守卫执行） */
    matchedRoutes: Array<{
        route: RouteItem;
        params: Record<string, string>;
        remainingPath: string;
    }>;
}

/**
 * 单个路由匹配器的匹配结果
 */
interface RouteMatchResult {
    /** 是否匹配 */
    matched: boolean;
    /** 提取的参数 */
    params: Record<string, string>;
    /** 剩余路径（相对于匹配部分） */
    remainingPath: string;
}

/**
 * 编译后的路径模式
 */
interface CompiledPattern {
    regex: RegExp;
    paramNames: string[];
}

/**
 * 路由匹配优先级评分
 * 数值越高优先级越高
 */
const WILDCARD_PRIORITY = 0;
const PARAMETRIC_BASE = 10;
const STATIC_BASE = 20;

/**
 * 规范化路径
 * 移除末尾斜杠并转换为小写
 *
 * 按照 D-07: 路径规范化自动移除末尾斜杠
 * 按照 D-08: 路径匹配不区分大小写
 */
function normalizePath(path: string): string {
    let normalized = path.replace(/\/+$/, "");
    if (normalized === "") {
        normalized = "/";
    }
    return normalized.toLowerCase();
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str: string): string {
    return str.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * 分析路径段是静态、参数化还是通配符
 */
function classifySegment(segment: string): "static" | "param" | "wildcard" {
    if (segment === "*") return "wildcard";
    if (segment.startsWith(":") || segment.startsWith("<")) return "param";
    return "static";
}

/**
 * 计算路由的匹配优先级分数
 * 按照 D-05: 具体路径优先于参数化路径，参数化路径优先于通配符
 */
function calculatePriority(route: RouteItem): number {
    const segments = route.path.split("/").filter(Boolean);
    if (segments.length === 0) return STATIC_BASE;

    const lastSegment = segments[segments.length - 1] || "";
    const classification = classifySegment(lastSegment);
    const staticCount = segments.filter(
        (s) => classifySegment(s) === "static"
    ).length;

    switch (classification) {
        case "wildcard":
            return WILDCARD_PRIORITY;
        case "param":
            return PARAMETRIC_BASE + staticCount;
        case "static":
            return STATIC_BASE + staticCount;
    }
}

/**
 * 将路径分割为段并逐段编译
 * 每个 segment 独立处理，避免正则转义冲突
 *
 * 支持语法：
 * - 静态段: "user" -> "user"
 * - 冒号参数: ":id" -> 捕获组
 * - 尖括号参数: "<id>" -> 捕获组
 * - 正则约束: ":id(\d+)" 或 "<id(\d+)>"
 */
function compileSegments(
    pattern: string,
    fullMatch: boolean
): CompiledPattern {
    const paramNames: string[] = [];
    // 先在原始 pattern 上提取参数名（保留大小写）
    // 然后对静态部分做规范化（小写 + 去末尾斜杠）
    const rawSegments = pattern.split("/").filter(Boolean);
    const regexParts: string[] = [];

    for (const rawSegment of rawSegments) {
        if (rawSegment === "*") {
            regexParts.push(".*");
            continue;
        }

        // 检查是否是冒号参数段 - 提取原始参数名，对正则约束做小写处理
        const colonMatch = rawSegment.match(/^:(\w+)(?:\((.+)\))?$/);
        if (colonMatch) {
            const name = colonMatch[1];
            const constraint = colonMatch[2];
            paramNames.push(name);
            regexParts.push(`(${constraint || "[^/]+"})`);
            continue;
        }

        // 检查是否是尖括号参数段
        const angleMatch = rawSegment.match(/^<(\w+)(?:\((.+)\))?>$/);
        if (angleMatch) {
            const name = angleMatch[1];
            const constraint = angleMatch[2];
            paramNames.push(name);
            regexParts.push(`(${constraint || "[^/]+"})`);
            continue;
        }

        // 静态段 - 规范化为小写并转义正则特殊字符
        regexParts.push(escapeRegex(rawSegment.toLowerCase()));
    }

    // 构建完整正则
    const regexBody = regexParts.map((p) => "/" + p).join("");
    let regexStr: string;

    if (fullMatch) {
        // 完全匹配（叶子节点）
        regexStr = `^${regexBody}/?$`;
    } else {
        // 前缀匹配（父节点 - 匹配自身或自身后有子路径）
        regexStr = `^${regexBody}(?:/(.*))?$`;
    }

    return {
        regex: new RegExp(regexStr),
        paramNames,
    };
}

/**
 * 创建单个路由的匹配函数
 *
 * 支持静态路径、动态参数（:param 和 <param>）、正则约束、通配符
 *
 * @param route - 路由配置
 * @returns 匹配函数，接受 pathname 返回匹配结果
 */
export function createRouteMatcher(
    route: RouteItem
): (pathname: string) => RouteMatchResult {
    const pattern = route.path;

    // 通配符路由始终匹配
    if (pattern === "*") {
        return (_pathname: string) => ({
            matched: true,
            params: {},
            remainingPath: "",
        });
    }

    const { regex, paramNames } = compileSegments(pattern, true);

    return (pathname: string) => {
        const normalized = normalizePath(pathname);
        const fullMatch = normalized.match(regex);

        if (fullMatch) {
            const params: Record<string, string> = {};
            paramNames.forEach((name, index) => {
                params[name] = fullMatch[index + 1] || "";
            });
            return {
                matched: true,
                params,
                remainingPath: "",
            };
        }

        return {
            matched: false,
            params: {},
            remainingPath: pathname,
        };
    };
}

/**
 * 主路由匹配函数
 *
 * 按照 CONTEXT.md 决策 D-01 到 D-08 实现匹配策略：
 * - D-01: 叶子节点完全匹配，父节点前缀匹配
 * - D-03: 支持通配符 * 匹配多层路径
 * - D-04: 子路由自动检测路径继承
 * - D-05: 匹配优先级：具体 > 参数化 > 通配符
 * - D-07: 路径规范化移除末尾斜杠
 * - D-08: 大小写不敏感匹配
 *
 * @param pathname - 当前 URL 路径
 * @param routes - 路由表配置
 * @param basePath - 基础路径前缀（用于递归）
 * @param parentMatched - 父路由链（用于递归）
 * @returns 匹配结果或 null
 */
export function matchRoute(
    pathname: string,
    routes: RouteItem[],
    basePath: string = "",
    parentMatched: Array<{ route: RouteItem; params: Record<string, string>; remainingPath: string }> = []
): MatchedRoute | null {
    const normalizedPathname = normalizePath(pathname);

    interface Candidate {
        route: RouteItem;
        params: Record<string, string>;
        remainingPath: string;
        priority: number;
        matchedRoutes: Array<{
            route: RouteItem;
            params: Record<string, string>;
            remainingPath: string;
        }>;
    }

    const candidates: Candidate[] = [];

    for (const route of routes) {
        const routePath = buildFullPath(basePath, route.path);

        // 通配符路由
        if (route.path === "*") {
            candidates.push({
                route,
                params: {},
                remainingPath: "",
                priority: WILDCARD_PRIORITY,
                matchedRoutes: [...parentMatched, { route, params: {}, remainingPath: "" }],
            });
            continue;
        }

        // 使用前缀匹配模式编译
        const { regex, paramNames } = compileSegments(routePath, false);
        const match = normalizedPathname.match(regex);

        if (!match) continue;

        // 提取参数
        const params: Record<string, string> = {};
        paramNames.forEach((name, index) => {
            params[name] = match[index + 1] || "";
        });

        // remainingPath 在前缀匹配中的索引 = paramNames.length + 1
        // 因为 match[0] 是完整匹配，match[1..n] 是参数捕获组，match[n+1] 是 remainingPath
        const remainingIndex = paramNames.length + 1;
        const remainingPart = match[remainingIndex] || "";

        // 当前路由的匹配信息
        const currentMatched = {
            route,
            params,
            remainingPath: remainingPart,
        };

        // 完全匹配（叶子级别）
        if (!remainingPart) {
            candidates.push({
                route,
                params,
                remainingPath: "",
                priority: calculatePriority(route),
                matchedRoutes: [...parentMatched, currentMatched],
            });
        }

        // 有子路由且有剩余路径时，递归匹配子路由
        if (remainingPart && route.children && route.children.length > 0) {
            const childResult = matchRoute(
                "/" + remainingPart,
                route.children,
                "",
                [...parentMatched, currentMatched]
            );

            if (childResult) {
                const mergedParams = { ...params, ...childResult.params };
                candidates.push({
                    route: childResult.route,
                    params: mergedParams,
                    remainingPath: childResult.remainingPath,
                    priority: calculatePriority(childResult.route),
                    matchedRoutes: childResult.matchedRoutes,
                });
            }
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    // 按 D-05 优先级排序：高优先级优先，优先级相同时保持配置顺序
    candidates.sort((a, b) => {
        if (b.priority !== a.priority) {
            return b.priority - a.priority;
        }
        return 0;
    });

    const best = candidates[0];
    return {
        route: best.route,
        params: best.params,
        remainingPath: best.remainingPath,
        matchedRoutes: best.matchedRoutes,
    };
}

/**
 * 构建完整路径
 * 按照 D-04: 以 / 开头为绝对路径，否则为相对路径
 */
function buildFullPath(basePath: string, routePath: string): string {
    if (routePath.startsWith("/")) {
        return routePath;
    }
    if (!basePath || basePath === "/") {
        return "/" + routePath;
    }
    const cleanBase = basePath.replace(/\/+$/, "");
    return cleanBase + "/" + routePath;
}
