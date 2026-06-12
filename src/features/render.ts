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
import type { KylinOutlet } from "@/components/Outlet";
import type { IAsyncSignal } from "asyncsignal";
import { KylinRouterError } from "@/errors";
import type { ViewContainer } from "@/components/Outlet/viewContainer";
import Alpine from "alpinejs";
import { isEmptyObject } from "es-toolkit";

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
    private _getCommonRouteIndex(
        this: KylinRouter,
        fromRoute: KylinMatchedRouteItem[] | undefined,
        toRoute: KylinMatchedRouteItem[],
    ): number {
        // 找出 fromRoute 和 toRoute 的公共路由层级
        // 公共路由不需要重新渲染，直接激活已存在的视图容器即可
        let commonRouteIndex = 0;
        if (fromRoute && fromRoute.length > 0) {
            for (let i = 0; i < Math.min(fromRoute.length, toRoute.length); i++) {
                if (fromRoute[i].url === toRoute[i].url) {
                    commonRouteIndex = i + 1;
                } else {
                    break;
                }
            }
        }
        this.logger.debug("{} -> 公共路由层数: {}", toRoute[0].id, commonRouteIndex);
        return commonRouteIndex;
    }
    private _getRootOutlet(this: KylinRouter): KylinOutlet {
        let outlet: KylinOutlet | null = findOutlet(this.host)[0];
        if (!outlet) {
            outlet = document.createElement("kylin-outlet");
            this.host.appendChild(outlet);
        }
        return outlet;
    }
    private _createDefaultData(matched: KylinMatchedRouteItem) {
        const mergedData = {
            $params: matched.params || {},
            $query: matched.query || {},
            $state: matched.state || {},
        };
        if (!isEmptyObject(mergedData)) {
            Alpine.data(matched.hash, () => mergedData);
        }
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
        let hasError: any;
        try {
            let currentOutlet: KylinOutlet | null = this._getRootOutlet();
            // 存储当前迭代创建的 viewContainer，用于取消时清理
            let pendingViewContainer: ViewContainer | null = null as ViewContainer | null;
            this.logger.debug(
                "{} -> 开始渲染: {}",
                toRoute[0].id,
                toRoute[toRoute.length - 1].url,
                toRoute,
            );
            this.emit("render:before", { route: toRoute });
            const commonRouteIndex: number = this._getCommonRouteIndex(fromRoute, toRoute);
            let preViewHash: string;
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

                if (curRouteItem) {
                    currentOutlet =
                        i === 0 ? this._getRootOutlet() : currentOutlet.findOutlet(preViewHash!);

                    const viewHash = matched.hash;
                    const dataHash = curRouteItem?._getData?.meta?.hash;
                    preViewHash = viewHash;

                    // 公共路由跳过逻辑：直接跳过，currentOutlet 保持不变
                    if (i < commonRouteIndex) {
                        continue;
                    }

                    // keepAlive 缓存逻辑：如果视图容器已存在，则跳过渲染
                    // keepAlive 默认为 true，除非显式设置为 false
                    if (curRouteItem?.keepAlive !== false) {
                        const viewContainer = currentOutlet.getViewContainer(viewHash);
                        if (viewContainer) {
                            // 相同的hash且需要url一致时才可以复用视图
                            // 如果url不一样，则只是复用视图容器
                            const url = viewContainer.dataset.url;
                            if (url === matched.url) {
                                currentOutlet.view = viewHash;
                                currentOutlet = currentOutlet.findOutlet(viewHash);
                                continue;
                            }
                        }
                    }

                    // 检查 currentOutlet 是否有效
                    if (!currentOutlet) {
                        this.logger.error("{} -> 无法找到 outlet，跳过渲染", toRoute[0].id);
                        continue;
                    }
                    // 是否指定了View参数，如果没有指定
                    const hasView = matched.route?.view;

                    // 创建空的视图容器: 用于插入视图内容或错误页或404页
                    // 重点： 无论是否加载成功均应该创建容器
                    //     加载前显示Loading/成功后显示视图/失败后显示错误
                    const viewContainer = hasView
                        ? currentOutlet.createViewContainer(matched, {
                              viewHash: viewHash,
                              dataHash: dataHash,
                              keepAlive: curRouteItem.keepAlive !== false,
                          })
                        : null;
                    // 提醒：没有view为什么还要继续？没有view但可能可以加载数据，数据可以供后续子路由访问
                    try {
                        pendingViewContainer = viewContainer;
                        const data = await this._loadData(matched);
                        const view = await this._loadView(matched);
                        this.logger.debug(
                            "{} -> 路由数据加载完成 {}/{} data={}({}) view={}",
                            () => [toRoute[0].id, i + 1, toRoute.length, data, data?.hash, view],
                        );
                        // 如果 view 为 null/undefined，即没有创建
                        if (view) {
                            if (view.error) {
                                this._routeReject(view.error, viewContainer!, toRoute);
                                break;
                            } else {
                                await this._runBeforeRender(
                                    fromRoute || [],
                                    toRoute,
                                    viewContainer!.container,
                                    data?.value,
                                );
                                viewContainer?.resolve(view.value, data?.value);
                                this._runAfterRender(
                                    fromRoute || [],
                                    toRoute,
                                    viewContainer!.container,
                                );
                            }
                        }
                    } catch (loadingError) {
                        this.logger.error("视图或数据加载失败", loadingError);
                        if (viewContainer) this._routeReject(loadingError, viewContainer, toRoute);
                        break;
                    } finally {
                        if (viewContainer) {
                            viewContainer.finally();
                            Alpine.initTree(viewContainer.container);
                        }
                        pendingViewContainer = null;
                    }
                }
            }
        } catch (error: any) {
            this.logger.error(`渲染失败: ${error.message}`, error);
            hasError = error;
        } finally {
            // 清理：只有当前渲染操作的控制器才清理
            if (this._currentRenderAbortController === abortController) {
                this._currentRenderAbortController = null;
            }
            // 渲染完成后，从渲染根开始重新初始化 Alpine
            // 这样可以让 Alpine 处理动态插入的子路由内容
            Alpine.initTree(this.host);
            this.emit("render:after", { route: toRoute, error: hasError });
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
