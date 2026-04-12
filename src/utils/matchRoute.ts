/**
 * 路由匹配算法 v2.0
 *
 * 实现混合匹配策略：
 * - 严格匹配(strict=true): 完全匹配路径
 * - 非严格匹配(strict=false): 前缀匹配，支持嵌套路由
 *
 * 匹配优先级：具体路径 > 参数化路径 > 通配符
 *
 * 返回首个匹配分支上所有嵌套路由项
 */

import type { KylinRouteItem, KylinMatchedRouteItem } from "@/types";
import { generateRouteHash } from "./hash";
import { params } from "./params";
import { joinPath } from "./joinPath";

/**
 * 匹配选项
 */
export interface MatchOptions {
    /**
     * 严格匹配模式
     * - true: 完全匹配路径，不允许超余路径
     * - false: 前缀匹配，允许超余路径（用于嵌套路由）
     * @default true
     */
    strict?: boolean;
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
    return normalized.replace(/\/\/$/, "/").toLowerCase();
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str: string): string {
    return str.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从 pathname 中移除 hash 部分
 */
function stripHash(pathname: string): string {
    const hashIndex = pathname.indexOf("#");
    return hashIndex >= 0 ? pathname.slice(0, hashIndex) : pathname;
}

/**
 * 解析 URL 查询参数
 */
function parseQueryString(pathname: string): { pathname: string; query: Record<string, string> } {
    const cleaned = stripHash(pathname);
    const [path, search = ""] = cleaned.split("?", 2);
    const query: Record<string, string> = {};

    if (search) {
        new URLSearchParams(search).forEach((value, key) => {
            query[key] = value;
        });
    }

    return { pathname: path, query };
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
 * 将路径分割为段并逐段编译
 * 每个 segment 独立处理，避免正则转义冲突
 *
 * 支持语法：
 * - 静态段: "user" -> "user"
 * - 冒号参数: ":id" -> 捕获组
 * - 尖括号参数: "<id>" -> 捕获组
 * - 正则约束: ":id(\d+)" 或 "<id(\d+)>"
 */
function compileSegments(pattern: string, fullMatch: boolean): CompiledPattern {
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
 * @param isPrefix - 是否使用前缀匹配（用于嵌套路由）
 * @returns 匹配函数，接受 pathname 返回匹配结果
 */
export function createRouteMatcher(
    route: KylinRouteItem,
    isPrefix: boolean = false,
): (pathname: string) => RouteMatchResult {
    const rawPattern = route.path;

    // 通配符路由始终匹配
    if (rawPattern === "*") {
        return (_pathname: string) => ({
            matched: true,
            params: {},
            remainingPath: "",
        });
    }

    // 忽略 route.path 开头的 /，因为路由表中的 path 应该不以 / 开头
    const cleanedPattern = rawPattern === "/" ? "/" : rawPattern.replace(/^\/+/, "");
    const absolutePattern = cleanedPattern.startsWith("/") ? cleanedPattern : "/" + cleanedPattern;

    const { regex, paramNames } = compileSegments(absolutePattern, !isPrefix);

    return (pathname: string) => {
        const normalized = normalizePath(parseQueryString(pathname).pathname);
        const fullMatch = normalized.match(regex);

        if (fullMatch) {
            const params: Record<string, string> = {};
            paramNames.forEach((name, index) => {
                params[name] = fullMatch[index + 1] || "";
            });

            // 对于前缀匹配，remainingPath 来自最后的捕获组
            let remainingPath = "";
            if (isPrefix) {
                const remainingIndex = paramNames.length + 1;
                remainingPath = fullMatch[remainingIndex] || "";
            }

            return {
                matched: true,
                params,
                remainingPath,
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
 * 递归匹配路由的内部函数
 *
 * @param path - 规范化后的路径
 * @param routes - 当前路由表
 * @param parentMatchedRoute - 父路由的匹配结果，用于继承 path 和 params
 * @param inputQuery - 输入 URL 的 query 参数
 * @param options - 匹配选项
 * @returns 匹配的路由项数组
 */
function _matchRoutesInternal(
    path: string,
    routes: KylinRouteItem[],
    parentMatchedRoute: KylinMatchedRouteItem | null,
    inputQuery: Record<string, string> = {},
    options: Required<MatchOptions>,
): KylinMatchedRouteItem[] {
    const { strict } = options;
    const parentPath = parentMatchedRoute?.path || "";
    const parentParams = parentMatchedRoute?.params || {};
    const parentUrl = parentMatchedRoute?.url || "";
    for (const route of routes) {
        const isLeaf = !route.children || route.children.length === 0;

        // 通配符路由始终匹配
        if (route.path === "*") {
            const fullPath = normalizePath(parentPath + path);
            const query = { ...route.query, ...inputQuery };
            const match: KylinMatchedRouteItem = {
                route,
                params: Object.assign({}, route.params, parentParams),
                query,
                state: {},
                path: fullPath || "/",
                hash: generateRouteHash(route, fullPath, parentParams, query),
            };
            return [match];
        }

        const matcher = createRouteMatcher(route, true);
        const matchResult = matcher(path);
        if (!matchResult.matched) continue;

        const matchedUrl = path.slice(0, path.length - (matchResult.remainingPath?.length || 0));
        const fullUrl = joinPath(parentUrl, matchedUrl);

        const fullPath = joinPath(parentPath, route.path);

        const mergedParams = Object.assign({}, route.params, parentParams, matchResult.params);
        const routeQuery = route.query || {};
        const mergedQuery = { ...routeQuery, ...inputQuery };
        const hashVars = {
            name: route.name || "",
            timestamp: String(Date.now()),
            path: route.path,
            fullPath: fullPath,
            url: fullUrl,
            query: new URLSearchParams(inputQuery).toString(),
            fullQuery: new URLSearchParams(mergedQuery).toString(),
            ...mergedParams,
        };
        const hash = generateRouteHash(route.hash, hashVars);

        const currentMatch: KylinMatchedRouteItem = {
            route,
            params: mergedParams,
            query: { ...routeQuery },
            state: {},
            path: fullUrl,
            url: fullUrl,
            hash,
        };

        if (!matchResult.remainingPath) {
            if (strict && route.children && route.children.length > 0) {
                continue;
            }

            currentMatch.query = mergedQuery;
            return [currentMatch];
        }

        if (route.children && route.children.length > 0) {
            const childPath = "/" + matchResult.remainingPath;
            const childMatches = _matchRoutesInternal(
                childPath,
                route.children,
                currentMatch,
                inputQuery,
                options,
            );

            if (childMatches.length > 0) {
                return [currentMatch, ...childMatches];
            }

            if (!strict) {
                currentMatch.query = { ...route.query, ...inputQuery };
                return [currentMatch];
            }
            continue;
        }

        if (!isLeaf && matchResult.remainingPath) {
            continue;
        }

        if (!strict) {
            currentMatch.query = { ...route.query, ...inputQuery };
            return [currentMatch];
        }
    }

    return [];
}

/**
 * 主路由匹配函数 - 新版实现
 *
 * 支持严格/非严格匹配，支持返回单个或多个匹配项
 *
 * @param path - 当前 URL 路径
 * @param routes - 路由表配置
 * @param options - 匹配选项 { strict?: boolean }
 * @returns 匹配的路由项数组，包含匹配分支上的所有 KylinMatchedRouteItem
 *
 * @example
 * // 严格匹配（默认），返回完整的匹配分支
 * matchRoute("/user/123", routes);
 *
 * // 非严格匹配，允许路径前缀匹配
 * matchRoute("/user", routes, { strict: false });
 */
export function matchRoute(
    path: string,
    routes: KylinRouteItem[],
    options?: MatchOptions,
): KylinMatchedRouteItem[] {
    const { pathname: pathWithoutQuery, query: inputQuery } = parseQueryString(path);
    const normalizedPath = normalizePath(pathWithoutQuery);

    const opts = Object.assign(
        {
            strict: true,
        },
        options,
    );

    return _matchRoutesInternal(normalizedPath, routes, null, inputQuery, opts);
}
