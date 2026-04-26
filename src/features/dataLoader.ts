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
import { isPlainObject } from "flex-tools/typecheck/isPlainObject";
import { RouteDataLoaderBase } from "./baseLoader";
import type { IAsyncSignal } from "asyncsignal";
import Alpine from "alpinejs";

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

    // ========================================
    // 实现抽象方法
    // ========================================

    /**
     * 处理远程加载的响应
     * DataLoader 使用 response.json() 解析 JSON 数据
     */
    protected async processRemoteResponse(
        _response: Response,
        _options: KylinRouteDataOptions,
        _signal: unknown,
    ): Promise<Record<string, any>> {
        return (_response as any).json();
    }

    protected onLoadSuccess(
        data: Record<string, any>,
        hash: string,
        options: KylinRouteDataOptions,
        _signal: IAsyncSignal,
    ) {
        const { store } = options;
        try {
            if (typeof store === "string") {
                Alpine.store(store, data);
            } else {
                Alpine.data(hash, () => data);
            }
        } catch (e: any) {
            this.router.logger.error(`Failed to create route dataObject : ${e.message}`);
        }
    }

    /**
     * 验证数据类型
     * DataLoader 接受 Record<string, any> 类型的数据
     */
    protected validateDataType(data: unknown): data is Record<string, any> {
        return isPlainObject(data);
    }

    /**
     * 判断是否应该缓存
     * DataLoader 缓存所有类型的数据
     */
    protected shouldCacheData(_data: Record<string, any>): boolean {
        return true;
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

    /**
     * 重写数据源解析以处理 undefined/null
     */
    protected resolveDataSource(
        _matched: KylinMatchedRouteItem,
        options: Required<KylinRouteDataOptions>,
    ): any {
        // 处理 undefined 或 null 的情况
        if (options.from === undefined || options.from === null) {
            return {};
        }

        const source = this.getDataSource(options);
        return typeof source === "function" ? source(_matched) : source;
    }
}
