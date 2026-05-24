/**
 * Render 特性 - 路由渲染系统
 *
 * 提供完整的路由渲染功能，包括：
 * - 逐级嵌套路由渲染
 * - beforeRender/afterRender 钩子集成
 * - viewContainer 管理
 * - 错误处理和降级
 * - Outlet 查找和创建辅助方法
 *
 * @module features/render
 */

import { findOutlet } from "@/utils/findOutlet";
import type { KylinRouter } from "@/router";
import type { KylinMatchedRouteItem, KylinRouteItem } from "@/types";
import type { KylinOutlet } from "@/components/outlet";
import type { IAsyncSignal } from "asyncsignal";
import { KylinRouterError } from "@/errors";
import type { ViewContainer } from "@/components/outlet/viewContainer";
import Alpine from "alpinejs";

type RouteSignalReuslt<T = any> = {
    value: T;
    error?: KylinRouterError;
    hash: string;
};

export class Render {
    private async _loadSignal(signal: IAsyncSignal | null) {
        if (!signal) {
            return;
        }
        const data: Record<string, any> = {};
        try {
            const result = await signal();
            data.value = result;
            data.hash = signal.meta.hash;
        } catch (e: any) {
            data.error = new KylinRouterError((e as Error).message, e.status || 500);
        }
        return data as RouteSignalReuslt;
    }
    private async _loadView(matched: KylinMatchedRouteItem) {
        const route = matched.route as Required<KylinRouteItem>;
        return (await this._loadSignal(route._getView)) as RouteSignalReuslt;
    }
    private async _loadData(matched: KylinMatchedRouteItem) {
        const route = matched.route as Required<KylinRouteItem>;
        return await this._loadSignal(route._getData);
    }
    private _routeReject(
        this: KylinRouter,
        error: any,
        viewContainer: ViewContainer,
        toRoute: KylinMatchedRouteItem[],
    ) {
        this.hooks.runRouteError({
            error,
            to: toRoute,
        });
        viewContainer.reject(error, this._getErrorPage(error, toRoute));
    }
    /**
     * 执行渲染步骤 - 新的渲染系统
     * 支持逐级嵌套路由渲染、beforeRender/afterRender 钩子、layout 布局等
     * 包含并发控制，防止快速导航时渲染混乱
     */
    protected async _renderRoutes(
        this: KylinRouter,
        toRoute: KylinMatchedRouteItem[],
        fromRoute: KylinMatchedRouteItem[] | undefined,
    ): Promise<void> {
        // 取消之前的渲染操作
        if (this._currentRenderAbortController) {
            this._currentRenderAbortController.abort();
        }

        // 递增渲染版本号并创建新的取消控制器
        ++this._renderVersion;
        const abortController = new AbortController();
        this._currentRenderAbortController = abortController;

        try {
            let currentOutlet: KylinOutlet | null = null;
            // 存储当前迭代创建的 viewContainer，用于取消时清理
            let pendingViewContainer: ViewContainer | null = null as ViewContainer | null;
            this.logger.debug(
                "{} -> 开始渲染: {}",
                toRoute[0].id,
                toRoute[toRoute.length - 1].url,
                toRoute,
            );

            // 找出 fromRoute 和 toRoute 的公共路由层级
            // 公共路由不需要重新渲染，直接激活已存在的视图容器即可
            let commonRouteIndex = 0;
            if (fromRoute && fromRoute.length > 0) {
                for (let i = 0; i < Math.min(fromRoute.length, toRoute.length); i++) {
                    if (fromRoute[i].hash === toRoute[i].hash) {
                        commonRouteIndex = i + 1;
                    } else {
                        break;
                    }
                }
            }
            this.logger.debug("{} -> 公共路由层数: {}", toRoute[0].id, commonRouteIndex);

            for (let i = 0; i < toRoute.length; i++) {
                this.logger.debug(
                    "{} -> 准备渲染 {}/{} {} -> {}",
                    () => [
                        toRoute[0].id,
                        i + 1,
                        toRoute.length,
                        toRoute[i].url || "",
                        toRoute[i].route?.path || "",
                    ],
                    toRoute[i],
                );
                // 检查是否已被新渲染取消
                if (abortController.signal.aborted) {
                    this.logger.debug("{} -> 渲染被新导航取消", toRoute[0].id);
                    // 清理已创建但未完成的视图容器
                    if (pendingViewContainer) {
                        pendingViewContainer.abort();
                    }
                    return;
                }

                const matched = toRoute[i];
                const curRouteItem = matched.route;

                const viewHash = matched.hash;
                const dataHash = curRouteItem?._getData?.meta?.hash;

                // 公共路由跳过逻辑：直接跳过，currentOutlet 保持不变
                if (i < commonRouteIndex) {
                    this.logger.debug("{} -> 跳过公共路由 {}/{}", () => [toRoute[0].id, i + 1]);
                    continue;
                }

                // 查找或创建outlet
                const searchContext = currentOutlet || this.host;
                currentOutlet = this._findOutlet(searchContext);

                // 调试：查找失败时的详细信息
                if (!currentOutlet) {
                    const foundInHost = this._findOutlet(this.host);
                    this.logger.debug(
                        "{} -> 未找到{} outlet，搜索上下文标签: {}, host中数量: {}",
                        () => [
                            toRoute[0].id,
                            matched.url,
                            searchContext.tagName.toLowerCase(),
                            foundInHost ? "在host中找到了" : "0",
                        ],
                    );
                    continue;
                }

                // keepAlive 缓存逻辑：如果视图容器已存在，则跳过渲染
                // keepAlive 默认为 true，除非显式设置为 false
                if (curRouteItem.keepAlive !== false) {
                    const viewContainer = currentOutlet.getViewContainer(viewHash);
                    if (viewContainer) {
                        currentOutlet.view = viewHash;
                        // 使用 view 属性指向的视图容器来查找子 outlet
                        const childOutlets = findOutlet(viewContainer);
                        if (childOutlets.length > 0) {
                            currentOutlet = childOutlets[0] as KylinOutlet;
                        }
                        this.logger.debug(
                            "{} -> 使用缓存视图 {}/{} {} -> {}",
                            () => [
                                toRoute[0].id,
                                i + 1,
                                toRoute.length,
                                toRoute[i].url || "",
                                toRoute[i].route?.path || "",
                            ],
                            toRoute[i],
                        );
                        continue;
                    }
                }

                // 创建空的视图容器: 用于插入视图内容或错误页或404页
                const viewContainer = currentOutlet.createViewContainer(matched, {
                    viewHash: viewHash,
                    dataHash: dataHash,
                    keepAlive: curRouteItem.keepAlive !== false,
                });
                pendingViewContainer = viewContainer;

                try {
                    const data = await this._loadData(matched);
                    const view = await this._loadView(matched);
                    this.logger.debug("{} -> 路由数据加载完成 {}/{} data={}({}) view={}", () => [
                        toRoute[0].id,
                        i + 1,
                        toRoute.length,
                        data,
                        data?.hash,
                        view,
                    ]);
                    // 调试：如果 view 为 null/undefined，输出详细信息
                    if (!view) {
                        this.logger.error("{} -> 视图加载返回空值，路由信息: {}", () => [
                            toRoute[0].id,
                            JSON.stringify({
                                path: matched.route?.path,
                                name: matched.route?.name,
                                hasGetView: !!matched.route?._getView,
                                getViewType: typeof matched.route?._getView,
                            }),
                        ]);
                        throw new KylinRouterError("视图加载失败", 500);
                    }
                    if (view.error) {
                        this._routeReject(view.error, viewContainer, toRoute);
                        break;
                    } else {
                        await this._runBeforeRender(
                            fromRoute || [],
                            toRoute,
                            viewContainer.container,
                            data?.value,
                        );
                        viewContainer.resolve(view.value, data?.value);
                        // 在刚解析的 viewContainer 中查找子 outlet
                        const childOutlets = findOutlet(viewContainer.container);
                        if (childOutlets.length > 0) {
                            currentOutlet = childOutlets[0] as KylinOutlet;
                        }
                        this._runAfterRender(fromRoute || [], toRoute, viewContainer.container);
                    }
                } catch (loadingError) {
                    this.logger.error("视图或数据加载失败", loadingError);
                    this._routeReject(loadingError, viewContainer, toRoute);
                    break;
                } finally {
                    viewContainer.finally();
                    pendingViewContainer = null;
                }
            }
        } catch (error: any) {
            this.logger.error(`渲染失败: ${error.message}`, error);
        } finally {
            // 清理：只有当前渲染操作的控制器才清理
            if (this._currentRenderAbortController === abortController) {
                this._currentRenderAbortController = null;
            }
            // 渲染完成后，从渲染根开始重新初始化 Alpine
            // 这样可以让 Alpine 处理动态插入的子路由内容
            Alpine.initTree(this.host);
        }
    }

    /**
     * 执行 beforeRender 钩子
     *
     * 渲染之前的钩子可以修改视图容器
     *
     * @param from - 来源路由
     * @param to - 目标路由
     * @param view - 视图容器
     * @param data - 路由数据
     */
    protected async _runBeforeRender(
        this: KylinRouter,
        from: KylinMatchedRouteItem[],
        to: KylinMatchedRouteItem[],
        view: HTMLElement,
        data?: Record<string, any>,
    ): Promise<void> {
        try {
            await this.hooks.runBeforeRender({
                from,
                to,
                view,
                data,
            });
        } catch (hookError) {
            this.logger.error("渲染流程: beforeRender 钩子执行失败", hookError);
        }
    }

    /**
     * 执行 afterRender 钩子（异步，不等待）
     * @param from - 来源路由
     * @param to - 目标路由
     * @param el - 视图元素
     */
    protected _runAfterRender(
        this: KylinRouter,
        from: KylinMatchedRouteItem[],
        to: KylinMatchedRouteItem[],
        el: HTMLElement,
    ): void {
        this.hooks
            .runAfterRender({
                from,
                to,
                el,
            })
            .catch((hookError) => {
                this.logger.error("渲染流程: afterRender 钩子执行失败", hookError);
            });
    }

    /**
     * 根据错误对象获取对应的错误页面元素
     * @param error - 错误对象
     * @param route - 完整的目标路由数组（用于错误页面处理器获取路由上下文）
     * @returns 错误页面 HTMLElement
     */
    protected _getErrorPage(
        this: KylinRouter,
        error: KylinRouterError,
        route: KylinMatchedRouteItem[],
    ): HTMLElement {
        const statusCode = String(error.status || 500);

        // 查找对应的错误页面处理器（errorPages 在初始化时已设置，必定存在）
        const errorPages = this.options.errorPages!;
        const errorHandler = errorPages[statusCode] || errorPages["*"];

        try {
            if (typeof errorHandler === "function") {
                return errorHandler(error, route);
            }
            return errorHandler!;
        } catch (handlerError) {
            // 错误处理器本身出错，使用兜底的 * 处理器
            this.logger.error("错误处理器执行失败", handlerError);
            const fallbackHandler = errorPages["*"]!;
            return typeof fallbackHandler === "function"
                ? fallbackHandler(handlerError, route)
                : fallbackHandler;
        }
    }

    /**
     * 在指定路由的 viewContainer 内部查找下一级 outlet
     * @param parentOutlet - 父 outlet 元素
     * @param currentHash - 当前路由的 hash（用于定位对应的 viewContainer）
     * @returns 找到的子 outlet，如果未找到返回 null
     */
    protected _findNextLevelOutlet(
        this: KylinRouter,
        parentOutlet: KylinOutlet,
        currentHash: string,
    ): KylinOutlet | null {
        // 1. 先找到当前路由对应的 viewContainer
        const currentViewContainer = parentOutlet.querySelector(
            `[id="${currentHash}"]`,
        ) as HTMLElement;

        if (!currentViewContainer) {
            return null;
        }
        // 2. 在该 viewContainer 内部查找 kylin-outlet
        const childOutlets = findOutlet(currentViewContainer);
        if (childOutlets.length === 0) {
            return null;
        }
        // 返回第一个找到的 outlet
        return childOutlets[0] as KylinOutlet;
    }

    /**
     * 在父元素内部查找 outlet
     * @param parent - 父元素
     * @returns 找到的第一个 outlet 元素，未找到返回 null
     */
    protected _findOutlet(this: KylinRouter, parent: HTMLElement): KylinOutlet | null {
        const outlets = findOutlet(parent);
        return outlets[0] || null;
    }

    /**
     * 确保 host 元素内部有至少一个 outlet
     * 如果没有，自动创建并插入一个默认 outlet
     */
    protected _ensureDefaultOutlet(this: KylinRouter): void {
        const outlets = findOutlet(this.host);
        if (outlets.length > 0) {
            return;
        }
        const defaultOutlet = document.createElement("kylin-outlet");
        this.host.appendChild(defaultOutlet);
    }
}
