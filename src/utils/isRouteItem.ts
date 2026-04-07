import type { RouteItem } from "@/types";

/**
 * 类型守卫：检查对象是否为 RouteItem
 */
export function isRouteItem(obj: unknown): obj is RouteItem {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const route = obj as Record<string, unknown>;
    return typeof route.name === "string" && typeof route.path === "string";
}
