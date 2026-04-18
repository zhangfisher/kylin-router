import type { KylinMatchedRouteItem } from "@/types";
import { getRouteVars } from "./getRouteVars";
import { params as replaceParams } from "./params";
import { quickHash } from "./quickHash";

export function getRouteHash(route: KylinMatchedRouteItem): string {
    const hash = (route.route.hash || "{fullPath}").replace(/\s+/g, ""); // 移除所有空白字符
    const vars = getRouteVars(route);
    // 使用插值函数生成 hash
    const result = quickHash(replaceParams(hash, vars));
    const isNotNumPreifx = isNaN(parseInt(result.substring(0, 1)));
    return isNotNumPreifx ? result : "h" + result;
}
