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
import { joinPath } from "./joinPath";
import { extractQueryParams } from "./extractQueryParams";
import { getRouteHash } from "./getRouteHash";

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
 * 复用 extractQueryParams 函数来提取查询参数
 */
function parseQueryString(pathname: string): { pathname: string; query: Record<string, string> } {
    const cleaned = stripHash(pathname);
    const [path, search = ""] = cleaned.split("?", 2);

    // 复用 extractQueryParams 来解析查询参数
    const query = search ? extractQueryParams("?" + search) : {};

    return { pathname: path, query };
}

/**
 * 将路径分割为段并逐段编译
 * 每个 segment 独立处理，避免正则转义冲突
 *
 * 支持语法：
 * - 静态段: "user" -> "user"
 * - 单段通配符: "*" -> 匹配单个段
 * - 多段通配符: "**" -> 匹配零个或多个段（仅在路径末尾）
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

    for (let i = 0; i < rawSegments.length; i++) {
        const rawSegment = rawSegments[i];

        // 检查是否是多段通配符（** 仅允许在末尾）
        if (rawSegment === "**") {
            if (i !== rawSegments.length - 1) {
                throw new Error("Multi-wildcard '**' can only appear at the end of a pattern");
            }
            // ** 匹配零个或多个段（包括斜杠）
            regexParts.push(".*");
            continue;
        }

        // 检查是否是单段通配符
        if (rawSegment === "*") {
            // * 匹配单个段（不包括斜杠）
            regexParts.push("[^/]+");
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
    let regexBody: string;

    // 检查是否有 ** 通配符在末尾
    const hasMultiWildcard = regexParts.length > 0 && regexParts[regexParts.length - 1] === ".*";

    if (hasMultiWildcard) {
        // 如果最后是 **，需要使其匹配零个或多个段
        // 即使没有任何内容，也应该匹配
        const beforeWildcard = regexParts
            .slice(0, -1)
            .map((p) => "/" + p)
            .join("");
        regexBody = beforeWildcard + "(?:/.*)?";
    } else {
        regexBody = regexParts.map((p) => "/" + p).join("");
    }

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
 * 判断路由是否为默认路由
 * 默认路由的判断标准（按优先级）：
 * 1. path 为 "" 或 "/" 或 "./" （高优先级）
 * 2. 或者显式设置 default: true （低优先级）
 * 3. 当有多个默认路由时，按配置顺序选择第一个
 */
function isDefaultRoute(route: KylinRouteItem): boolean {
    const path = route.path.trim();
    // 空路径优先
    if (path === "" || path === "/" || path === "./") return true;
    // 其次是 default: true
    return route.default === true;
}

/**
 * 在子路由中递归查找默认路由
 * 返回默认路由及其所有嵌套的默认子路由
 *
 * view/data 继承规则：
 * - 如果父路由的 view 为空且默认路由有 view，则使用默认路由的 view
 * - 如果父路由的 data 为空且默认路由有 data，则使用默认路由的 data
 *
 * 默认路由优先级：
 * 1. 空路径（""、"/"、"./"）优先级最高
 * 2. default: true 优先级较低
 * 3. 同优先级按配置顺序选择第一个
 */
function findDefaultRoute(
    routes: KylinRouteItem[],
    parentMatchedRoute: KylinMatchedRouteItem,
    inputQuery: Record<string, string>,
): KylinMatchedRouteItem[] | null {
    let bestRoute: KylinRouteItem | null = null;
    let bestPriority = -1;

    // 第一遍：查找空路径的默认路由（优先级 1）
    for (const route of routes) {
        const path = route.path.trim();
        if (path === "" || path === "/" || path === "./") {
            bestRoute = route;
            bestPriority = 1;
            break;
        }
    }

    // 第二遍：如果没有空路径路由，查找 default: true 的路由（优先级 0）
    if (bestRoute === null) {
        for (const route of routes) {
            if (route.default === true) {
                bestRoute = route;
                bestPriority = 0;
                break;
            }
        }
    }

    if (bestRoute === null) {
        return null;
    }

    const route = bestRoute;

        const fullPath = joinPath(parentMatchedRoute.path, route.path);
        const mergedParams = { ...parentMatchedRoute.params, ...route.params };
        const mergedQuery = { ...route.query, ...inputQuery };

        // view/data 继承逻辑：修改父路由的 view/data
        let parentRoute = parentMatchedRoute.route;
        if (parentRoute && !parentRoute.view && route.view) {
            parentRoute = { ...parentRoute, view: route.view };
        }
        if (parentRoute && !parentRoute.data && route.data) {
            parentRoute = { ...parentRoute, data: route.data };
        }

        const currentMatch: KylinMatchedRouteItem = {
            route,
            params: mergedParams,
            query: mergedQuery,
            state: {},
            path: fullPath,
            url: parentMatchedRoute.url,
            hash: "",
        };
        currentMatch.hash = getRouteHash(currentMatch);

        // 递归查找下一级默认路由
        if (route.children && route.children.length > 0) {
            const childDefaults = findDefaultRoute(
                route.children,
                currentMatch,
                inputQuery,
            );
            if (childDefaults && childDefaults.length > 0) {
                // 从子默认路由继承 view/data（包括间接继承）
                const childRoute = childDefaults[0].route;
                let currentRouteToUse = currentMatch.route;
                if (currentRouteToUse) {
                    // 只有当前路由没有该属性时才继承
                    if (!currentRouteToUse.view && childRoute.view) {
                        currentRouteToUse = { ...currentRouteToUse, view: childRoute.view };
                    }
                    if (!currentRouteToUse.data && childRoute.data) {
                        currentRouteToUse = { ...currentRouteToUse, data: childRoute.data };
                    }
                    currentMatch.route = currentRouteToUse;
                }
                // 递归更新子默认路由的继承
                for (let i = 0; i < childDefaults.length - 1; i++) {
                    const currentChild = childDefaults[i];
                    const nextChild = childDefaults[i + 1];
                    let childRouteToUse = currentChild.route;
                    if (childRouteToUse) {
                        if (!childRouteToUse.view && nextChild.route.view) {
                            childRouteToUse = { ...childRouteToUse, view: nextChild.route.view };
                        }
                        if (!childRouteToUse.data && nextChild.route.data) {
                            childRouteToUse = { ...childRouteToUse, data: nextChild.route.data };
                        }
                        currentChild.route = childRouteToUse;
                    }
                }
                return [currentMatch, ...childDefaults];
            }
        }

        return [currentMatch];
}

/**
 * 创建未匹配的路由项（用于 404 处理）
 */
function createUnmatchedRouteItem(
    unmatchedPath: string,
    parentMatchedRoute: KylinMatchedRouteItem | null,
    inputQuery: Record<string, string>,
): KylinMatchedRouteItem {
    const parentPath = parentMatchedRoute?.path || "";
    const parentUrl = parentMatchedRoute?.url || "";
    const parentParams = parentMatchedRoute?.params || {};

    const fullPath = joinPath(parentPath, unmatchedPath);
    const fullUrl = joinPath(parentUrl, unmatchedPath);

    return {
        route: undefined as any,
        params: parentParams,
        query: inputQuery,
        state: {},
        path: fullPath,
        url: fullUrl,
        hash: `unmatched-${fullPath.replace(/\//g, '-')}`,
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

    // 按优先级分组遍历：具体路径 > 参数化路径 > 通配符
    // 第一组：具体路径和参数化路径（非通配符）
    for (const route of routes) {
        if (route.path === "*" || route.path.includes("*")) continue;

        const isLeaf = !route.children || route.children.length === 0;
        const matcher = createRouteMatcher(route, true);
        const matchResult = matcher(path);
        if (!matchResult.matched) continue;

        const matchedUrl = path.slice(0, path.length - (matchResult.remainingPath?.length || 0));
        const fullUrl = joinPath(parentUrl, matchedUrl);
        const fullPath = joinPath(parentPath, route.path);

        const mergedParams = Object.assign({}, route.params, parentParams, matchResult.params);
        const routeQuery = route.query || {};

        const currentMatch: KylinMatchedRouteItem = {
            route,
            params: mergedParams,
            query: routeQuery, // 暂时不合并 inputQuery，只在叶子节点合并
            state: {},
            path: fullPath,
            url: fullUrl,
            hash: "",
        };

        currentMatch.hash = getRouteHash(currentMatch);

        if (!matchResult.remainingPath) {
            // 路径完全匹配当前路由
            if (route.children && route.children.length > 0) {
                // 【新增】首先查找默认路由
                const defaultMatches = findDefaultRoute(
                    route.children,
                    currentMatch,
                    inputQuery,
                );
                if (defaultMatches && defaultMatches.length > 0) {
                    // view/data 继承：如果父路由没有 view/data，从默认路由继承
                    const defaultRoute = defaultMatches[0].route;
                    let parentRouteToUse = currentMatch.route;
                    if (parentRouteToUse) {
                        if (!parentRouteToUse.view && defaultRoute.view) {
                            parentRouteToUse = { ...parentRouteToUse, view: defaultRoute.view };
                        }
                        if (!parentRouteToUse.data && defaultRoute.data) {
                            parentRouteToUse = { ...parentRouteToUse, data: defaultRoute.data };
                        }
                        currentMatch.route = parentRouteToUse;
                    }
                    return [currentMatch, ...defaultMatches];
                }

                // 【保留】尝试匹配空路径的子路由
                const childMatches = _matchRoutesInternal(
                    "/",
                    route.children,
                    currentMatch,
                    inputQuery,
                    options,
                );
                if (childMatches.length > 0) {
                    return [currentMatch, ...childMatches];
                }
                // 子路由无法匹配时的处理
                if (strict) {
                    // 严格模式下，如果子路由无法匹配，仍然返回父路由
                    // 因为路径已经完全匹配父路由
                    return [currentMatch];
                }
                // 非严格模式下，返回父路由
                return [currentMatch];
            }
            // 没有子路由，直接返回当前路由（叶子节点，合并 inputQuery）
            currentMatch.query = { ...routeQuery, ...inputQuery };
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

            // 【新增】子路由完全无法匹配，创建未匹配路由项
            const unmatchedItem = createUnmatchedRouteItem(
                matchResult.remainingPath,
                currentMatch,
                inputQuery,
            );
            return [currentMatch, unmatchedItem];
        }

        if (!isLeaf && matchResult.remainingPath) {
            continue;
        }

        if (!strict) {
            currentMatch.query = { ...route.query, ...inputQuery };
            return [currentMatch];
        }
    }

    // 第二组：通配符路由（优先级最低）
    for (const route of routes) {
        if (!route.path.includes("*")) continue;

        const isLeaf = !route.children || route.children.length === 0;
        const matcher = createRouteMatcher(route, true);
        const matchResult = matcher(path);
        if (!matchResult.matched) continue;

        const matchedUrl = path.slice(0, path.length - (matchResult.remainingPath?.length || 0));
        const fullUrl = joinPath(parentUrl, matchedUrl);
        const fullPath = joinPath(parentPath, route.path);

        const mergedParams = Object.assign({}, route.params, parentParams, matchResult.params);
        const routeQuery = route.query || {};

        const currentMatch: KylinMatchedRouteItem = {
            route,
            params: mergedParams,
            query: routeQuery,
            state: {},
            path: fullPath,
            url: fullUrl,
            hash: "",
        };
        currentMatch.hash = getRouteHash(currentMatch);

        if (!matchResult.remainingPath) {
            // 路径完全匹配当前路由
            if (route.children && route.children.length > 0) {
                // 【新增】首先查找默认路由
                const defaultMatches = findDefaultRoute(
                    route.children,
                    currentMatch,
                    inputQuery,
                );
                if (defaultMatches && defaultMatches.length > 0) {
                    // view/data 继承：如果父路由没有 view/data，从默认路由继承
                    const defaultRoute = defaultMatches[0].route;
                    let parentRouteToUse = currentMatch.route;
                    if (parentRouteToUse) {
                        if (!parentRouteToUse.view && defaultRoute.view) {
                            parentRouteToUse = { ...parentRouteToUse, view: defaultRoute.view };
                        }
                        if (!parentRouteToUse.data && defaultRoute.data) {
                            parentRouteToUse = { ...parentRouteToUse, data: defaultRoute.data };
                        }
                        currentMatch.route = parentRouteToUse;
                    }
                    return [currentMatch, ...defaultMatches];
                }

                // 【保留】尝试匹配空路径的子路由
                const childMatches = _matchRoutesInternal(
                    "/",
                    route.children,
                    currentMatch,
                    inputQuery,
                    options,
                );
                if (childMatches.length > 0) {
                    return [currentMatch, ...childMatches];
                }
                // 子路由无法匹配时的处理
                if (strict) {
                    // 严格模式下，如果子路由无法匹配，仍然返回父路由
                    // 因为路径已经完全匹配父路由
                    return [currentMatch];
                }
                // 非严格模式下，返回父路由
                return [currentMatch];
            }
            // 没有子路由，直接返回当前路由（叶子节点，合并 inputQuery）
            currentMatch.query = { ...routeQuery, ...inputQuery };
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

            // 【新增】子路由完全无法匹配，创建未匹配路由项
            const unmatchedItem = createUnmatchedRouteItem(
                matchResult.remainingPath,
                currentMatch,
                inputQuery,
            );
            return [currentMatch, unmatchedItem];
        }

        if (!isLeaf && matchResult.remainingPath) {
            continue;
        }

        if (!strict) {
            currentMatch.query = { ...route.query, ...inputQuery };
            return [currentMatch];
        }
    }

    // 【新增】顶层无匹配时，返回未匹配路由项
    if (parentMatchedRoute === null) {
        const unmatchedItem = createUnmatchedRouteItem(
            path,
            null,
            inputQuery,
        );
        return [unmatchedItem];
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
