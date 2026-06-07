/**
 * Loader 特性 - 数据加载系统
 *
 * 提供本地数据和远程数据的加载能力
 * 支持多种数据格式：JSON、对象、动态函数、远程 URL
 *
 * @module features/dataLoader
 */

import type { KylinRouter } from "@/router";
import type { KylinMatchedRouteItem } from "@/types/routes";
import type { KylinRouteDataOptions } from "@/types/data";
import { RouteDataLoaderBase } from "./baseLoader";
import Alpine from "alpinejs";
import { getJsonFileFromUrl } from "@/utils/getJsonFileFromUrl";
import type { IAsyncSignal } from "asyncsignal";
import { cloneDeep } from "es-toolkit/object";
import { isPlainObject } from "es-toolkit/predicate";

/**
 * DataLoader 类 - 负责加载路由数据
 * 继承自 RouteDataLoaderBase 基类
 */
export class DataLoader extends RouteDataLoaderBase<
    "data",
    KylinRouteDataOptions,
    Record<string, any>
> {
    constructor(router: KylinRouter) {
        super(
            router,
            "data", // loadType
            Object.assign({}, router.options.dataOptions) as Required<
                Omit<KylinRouteDataOptions, "from">
            >,
        );
    }

    protected onHandleData(
        data: Record<string, any>,
        signal: IAsyncSignal,
        matched: KylinMatchedRouteItem,
        options: KylinRouteDataOptions,
    ): any {
        const { store } = options;
        const hash = signal.meta.hash;
        // 将 $params 和 $query 添加到数据对象中，使模板可以访问
        const mergedData = {
            ...cloneDeep(data),
            $params: matched.params || {},
            $query: matched.query || {},
            $state: matched.state || {},
        };
        try {
            if (typeof store === "string") {
                Alpine.store(store, mergedData);
            } else {
                Alpine.data(hash, () => mergedData);
            }
        } catch (e: any) {
            this.router.logger.error(
                `{} -> Failed to create route dataObject : ${e.message}`,
                () => [matched.id, e],
            );
        }
        return data;
    }
    /**
     * 当data=true时
     * @param matched
     * @param source
     * @returns
     */
    protected getAutoUrl(matched: KylinMatchedRouteItem): string | undefined {
        if (matched.route) {
            const viewSrc = matched.route.view;
            const viewUrl = typeof viewSrc === "function" ? viewSrc(matched) : viewSrc;
            if (viewUrl === "string") {
                return getJsonFileFromUrl(viewUrl);
            }
        }
    }

    // ========================================
    // 保持公共 API
    // ========================================

    /**
     * 并发加载匹配路由的数据
     * @param routes - 匹配的路由数组
     */
    async loadDatas(routes: KylinMatchedRouteItem[]) {
        return this.loadRoutes(routes);
    }

    protected isValidData(content: any): boolean {
        return isPlainObject(content);
    }
}
