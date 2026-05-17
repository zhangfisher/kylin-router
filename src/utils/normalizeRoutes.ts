/**
 * 路由规范化工具
 * 将扁平路由声明转换为嵌套结构，确保根路由存在
 */

import type { KylinRouteItem } from "@/types/routes";

/**
 * 路由树节点 - 用于构建规范化过程中的临时结构
 */
interface RouteTreeNode {
    route: KylinRouteItem;
    children: Map<string, RouteTreeNode>;
}

/**
 * 将路径按 / 分割为数组
 * @param path - 原始路径
 * @returns 路径段数组
 *
 * @example
 * splitPath("a/b/c")    // ["a", "b", "c"]
 * splitPath("/a/b/c")   // ["a", "b", "c"]
 * splitPath("a")        // ["a"]
 * splitPath("/")        // ["/"]
 */
function splitPath(path: string): string[] {
    const trimmed = path.trim();
    if (trimmed === "/" || trimmed === "" || trimmed === "./") {
        return ["/"];
    }
    // 移除开头和结尾的斜杠，然后分割
    const cleaned = trimmed.replace(/^\/+|\/+$/g, "");
    if (!cleaned) {
        return ["/"];
    }
    return cleaned.split("/").filter(Boolean);
}

/**
 * 检查路由是否为根路由
 */
function isRootRoute(route: KylinRouteItem): boolean {
    const path = route.path.trim();
    return path === "" || path === "/" || path === "./";
}

/**
 * 在路由树中查找或创建节点
 * @param node - 当前节点
 * @param segment - 路径段
 * @returns 找到或创建的节点
 */
function getOrCreateNode(
    node: RouteTreeNode,
    segment: string,
): { node: RouteTreeNode; isNew: boolean } {
    const isNew = !node.children.has(segment);
    if (isNew) {
        node.children.set(segment, {
            route: { path: segment },
            children: new Map(),
        });
    }
    return { node: node.children.get(segment)!, isNew };
}

/**
 * 检查是否为默认路由（path="" 或 path="/"）
 */
function isDefaultRoute(route: KylinRouteItem): boolean {
    const path = route.path.trim();
    return path === "" || path === "/";
}

/**
 * 将路由树转换为路由数组，并处理默认路由
 */
function treeToArray(node: RouteTreeNode): KylinRouteItem[] {
    const result: KylinRouteItem[] = [];

    for (const [, childNode] of node.children) {
        // 从 childNode.route 复制属性，但排除 children（稍后会根据子节点重新构建）
        const { children: _, ...routeWithoutChildren } = childNode.route;
        let route: KylinRouteItem = { ...routeWithoutChildren };

        if (childNode.children.size > 0) {
            // 先递归处理子节点
            const children = treeToArray(childNode);

            // 查找默认路由（path="" 或 path="/"）
            const defaultRouteIndex = children.findIndex(isDefaultRoute);

            if (defaultRouteIndex !== -1) {
                const defaultRoute = children[defaultRouteIndex];

                // 将默认路由的属性合并到当前路由中（排除 path 和 children）
                const { path: _, children: defaultChildren, ...defaultProps } = defaultRoute;
                route = { ...route, ...defaultProps };

                // 构建新的 children 数组：移除默认路由项，添加其 children
                const otherChildren = children.filter((_, index) => index !== defaultRouteIndex);
                const newChildren =
                    defaultChildren && defaultChildren.length > 0
                        ? [...otherChildren, ...defaultChildren]
                        : otherChildren;

                // 只有当 children 非空时才设置
                if (newChildren.length > 0) {
                    route.children = newChildren;
                }
            } else {
                // 没有默认路由，直接使用原有的 children
                if (children.length > 0) {
                    route.children = children;
                }
            }
        }

        result.push(route);
    }

    return result;
}

/**
 * 处理单个路由，将其添加到路由树中
 * @param root - 根节点
 * @param route - 要处理的路由
 */
function processRoute(root: RouteTreeNode, route: KylinRouteItem): void {
    const segments = splitPath(route.path);

    // 如果是根路由（且不是默认路由），直接处理
    // 默认路由（path="" 或 path="/"）应该作为普通子路由处理
    if (segments.length === 1 && segments[0] === "/" && !isDefaultRoute(route)) {
        // 根路由：合并到根节点
        if (route.children) {
            for (const child of route.children) {
                processRoute(root, child);
            }
        }
        return;
    }

    // ** 通配符也应该像普通路径一样分解，但需要特殊处理其 children
    // ** 只能用于路径的最后一项
    const lastSegment = segments[segments.length - 1];
    const isWildcardLast = lastSegment === "**";

    let currentNode = root;

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLast = i === segments.length - 1;
        const { node: nextNode } = getOrCreateNode(currentNode, segment);
        currentNode = nextNode;

        if (isLast) {
            // 叶子节点：应用配置（后者覆盖前者）
            // 如果最后一段是 **，忽略其 children
            const routeToApply = isWildcardLast
                ? { ...route, path: segment, children: undefined }
                : { ...route, path: segment };
            currentNode.route = routeToApply;

            // 递归处理子路由（但如果最后一段是 **，不处理其 children）
            if (route.children && !isWildcardLast) {
                for (const child of route.children) {
                    processRoute(currentNode, child);
                }
            }
        }
    }
}

/**
 * 规范化路由配置
 *
 * - 确保根路由存在（始终返回单个根路由对象）
 * - 将扁平路径（如 "a/b"）转换为嵌套结构
 *
 * @param routes - 原始路由配置（单个对象、数组或 null/undefined）
 * @returns 规范化后的根路由对象（path 为 "/"）
 *
 * @example
 * // 单个路由对象
 * const result = normalizeRoutes({ path: "a/b", view: "B.html" })
 *
 * // 路由数组
 * const result = normalizeRoutes([
 *   { path: "a/b", view: "B.html" },
 *   { path: "a/c", view: "C.html" }
 * ])
 */
export function normalizeRoutes(routes?: KylinRouteItem | KylinRouteItem[] | null): KylinRouteItem {
    // 统一转换为数组处理
    const routesArray: KylinRouteItem[] = routes ? (Array.isArray(routes) ? routes : [routes]) : [];

    // 处理空数组
    if (routesArray.length === 0) {
        return { path: "/" };
    }

    // 检查是否已存在根路由
    const existingRoot = routesArray.find(isRootRoute);
    const nonRootRoutes = routesArray.filter((r) => !isRootRoute(r));

    // 创建路由树的根节点
    const rootNode: RouteTreeNode = {
        route: { path: "/" },
        children: new Map(),
    };

    // 处理现有的根路由
    if (existingRoot) {
        // 如果根路由有子路由，先处理它们
        if (existingRoot.children) {
            for (const child of existingRoot.children) {
                processRoute(rootNode, child);
            }
        }
    }

    // 处理非根路由
    for (const route of nonRootRoutes) {
        processRoute(rootNode, route);
    }

    // 构建最终结果
    const result: KylinRouteItem = {
        path: "/",
    };

    // 如果存在自定义根路由，保留其属性
    if (existingRoot) {
        const { path, children, ...rootProps } = existingRoot;
        Object.assign(result, rootProps);
    }

    // 转换树为数组，只有非空时才设置 children
    let children = treeToArray(rootNode);

    // 检查根节点的 children 中是否有默认路由
    const defaultRouteIndex = children.findIndex(isDefaultRoute);
    if (defaultRouteIndex !== -1) {
        const defaultRoute = children[defaultRouteIndex];

        // 将默认路由的属性合并到结果中（排除 path 和 children）
        const { path: _, children: defaultChildren, ...defaultProps } = defaultRoute;
        Object.assign(result, defaultProps);

        // 构建新的 children 数组：移除默认路由项，添加其 children
        const otherChildren = children.filter((_, index) => index !== defaultRouteIndex);
        children =
            defaultChildren && defaultChildren.length > 0
                ? [...otherChildren, ...defaultChildren]
                : otherChildren;
    }

    if (children.length > 0) {
        result.children = children;
    }

    return result;
}
