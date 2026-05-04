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
            Object.assign(
                {
                    hash: "{url}",
                },
                router.options.dataOptions,
            ) as Required<Omit<KylinRouteDataOptions, "from">>,
        );
    }

    protected onHandleData(data: any, options: KylinRouteDataOptions, signal: IAsyncSignal) {
        const { store } = options;
        try {
            if (typeof store === "string") {
                Alpine.store(store, data);
            } else {
                Alpine.data(signal.meta.hash, () => data);
            }
        } catch (e: any) {
            this.router.logger.error(`Failed to create route dataObject : ${e.message}`);
        }
        return data;
    }
    /**
     * 当data=true时
     * @param matched
     * @param source
     * @returns
     */
    protected getAutoUrl(matched: KylinMatchedRouteItem, source: boolean): string | undefined {
        if (source === true) {
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
}
