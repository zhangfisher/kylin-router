/**
 * 路由表管理功能
 *
 * 负责：
 * - 路由表初始化和规范化
 * - 动态路由注册（addRoute/removeRoute）
 * - 远程路由表加载（loadRemoteRoutes）
 * - 路由匹配和参数提取
 */

import type { KylinRouter } from "@/router";
import type { KylinRouteItem, KylinMatchedRouteItem } from "@/types";
import { matchRoute } from "@/utils/matchRoute";

/** 导航回调函数类型 */
export interface NavigationCallbacks {
    push: (path: string) => void;
    getLocation: () => { pathname: string; search: string };
    setIsNavigating: (value: boolean) => void;
}

export class RouteRegistry {
    /** 路由表配置 */
    public routes!: KylinRouteItem[];

    /** 404 路由配置 */
    public notFound?: KylinRouteItem;

    /** 当前路由状态 */
    public current?: KylinMatchedRouteItem[];

    /** 导航回调函数 */
    private _callbacks?: NavigationCallbacks;
    router: KylinRouter;
    constructor(router: KylinRouter) {
        this.router = router;
    }
    /**
     * 设置导航回调函数
     */
    setCallbacks(callbacks: NavigationCallbacks): void {
        this._callbacks = callbacks;
    }

    /**
     * 初始化路由表
     *
     * 支持 RouteItem[]、单个 RouteItem、string（URL）、函数（同步/异步）格式
     * 按照 D-17: 支持多种路由配置格式
     */
    async load(): Promise<void> {
        const routeArgs = this.router.options.routes || [];
        const toArray = async (arg: any): Promise<KylinRouteItem[]> => {
            if (typeof arg === "function") {
                arg = await arg();
            } else if (typeof arg === "string") {
                arg = await fetch(arg).then((res) => res.json());
            }
            return Array.isArray(arg) ? arg : [arg];
        };

        this.routes = this._normalizeRoutes(await toArray(routeArgs));
        this.router.emit("routes:loaded", undefined);
    }

    /**
     * 动态添加路由到路由表
     * 如果 name 已存在则覆盖旧路由（后者覆盖策略）
     * 按照 D-11: 后者覆盖策略、D-38: 统一优先级规则
     */
    public add(route: KylinRouteItem): void {
        const existingIndex = this.routes.findIndex((r) => r.name === route.name);
        if (existingIndex !== -1) {
            this.routes[existingIndex] = route;
        } else {
            this.routes.push(route);
        }
    }

    /**
     * 匹配路径并返回匹配结果
     * @param pathname - 要匹配的路径
     * @returns 匹配结果或 null
     */
    public match(pathname: string): ReturnType<typeof matchRoute> {
        return matchRoute(pathname, this.routes) || null;
    }

    /**
     * 动态删除指定名称的路由
     * 支持递归删除嵌套路由
     * 如果删除的是当前访问的路由，自动重定向到默认路由或 404
     * 按照 D-10: 静默处理不存在的路由、D-39: 当前路由删除后重定向
     */
    public remove(name: string): void {
        function removeRouteByName(routes: KylinRouteItem[], name: string): boolean {
            for (let i = 0; i < routes.length; i++) {
                if (routes[i].name === name) {
                    routes.splice(i, 1);
                    return true;
                }
                // 递归检查子路由
                if (routes[i].children) {
                    const removed = removeRouteByName(routes[i].children!, name);
                    if (removed) return true;
                }
            }
            return false;
        }
        const removed = removeRouteByName(this.routes, name);
        // 如果删除了路由且当前正在访问该路由，触发重定向
        // if (removed && this.current.route && this.current.route.name === name) {
        //     this.redirectToDefaultOrNotFound();
        // }
    }

    /**
     * 将路由配置规范化为 RouteItem[]
     */
    private _normalizeRoutes(routes: KylinRouteItem[]): void {}
}
