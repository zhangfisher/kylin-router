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
import { KylinRouterHttpError } from "@/errors";

type RouteSignalReuslt<T = any> = {
    value: T;
    error: Error;
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
        } catch (error) {
            data.error = error;
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
    /**
     * 执行渲染步骤 - 新的渲染系统
     * 支持逐级嵌套路由渲染、beforeRender/afterRender 钩子、layout 布局等
     */
    protected async _renderRoutes(
        this: KylinRouter,
        toRoute: KylinMatchedRouteItem[],
        fromRoute: KylinMatchedRouteItem[] | undefined,
    ): Promise<void> {
        try {
            let currentOutlet: KylinOutlet | null = null;
            for (let i = 0; i < toRoute.length; i++) {
                const matched = toRoute[i];

                // 查找 outlet（404 和正常渲染都需要）
                currentOutlet = this._findOutlet(currentOutlet || this.host, matched.hash);

                if (!currentOutlet) {
                    this.logger.debug(`未找到${matched.url} outlet，跳过渲染`);
                    break;
                }
                const curRouteItem = matched.route as Required<KylinRouteItem>;
                const viewHash = matched.hash;
                const dataHash = matched.route._getData?.meta?.hash;

                // 如果当前路由启用 keepAlive，且视图容器已经存在，则跳过渲染，使用缓存的视图
                if (curRouteItem && curRouteItem.keepAlive) {
                    const viewContainer = currentOutlet.getViewContainer(viewHash);
                    if (viewContainer) {
                        currentOutlet.view = viewHash;
                        break;
                    }
                }

                // 创建空的视图容器: 用于插入视图内容或错误页或404页
                const viewContainer = currentOutlet.createViewContainer({
                    viewHash: viewHash,
                    dataHash: dataHash,
                    keepAlive: curRouteItem.keepAlive,
                    cssVars: matched.route._getView?.meta?.vBindVars || [],
                });

                // 处理未匹配的路由（404）
                if (!matched.route) {
                    await this._renderError(
                        currentOutlet,
                        matched.hash,
                        new KylinRouterHttpError("Route not found", 404),
                        toRoute,
                        fromRoute,
                        i,
                        undefined,
                    );
                    break;
                } else {
                }

                try {
                    const data = await this._loadData(matched);
                    const view = await this._loadView(matched)!;

                    if (view.error) {
                        await this._renderError(
                            currentOutlet,
                            viewHash,
                            view.error,
                            toRoute,
                            fromRoute,
                            i,
                            data?.value,
                            viewContainer,
                        );
                    } else {
                        await this._runBeforeRender(
                            fromRoute || [],
                            toRoute.slice(0, i + 1),
                            viewContainer.container,
                            data?.value,
                        );
                        viewContainer.resolve(view.value, data?.value);
                        this._runAfterRender(
                            fromRoute || [],
                            toRoute.slice(0, i + 1),
                            viewContainer.container,
                        );
                    }
                } catch (loadingError) {
                    await this._renderError(
                        currentOutlet,
                        viewHash,
                        loadingError,
                        toRoute,
                        fromRoute,
                        i,
                        undefined,
                        viewContainer,
                    );
                } finally {
                    viewContainer.finally();
                }
            }
        } catch (error) {
            this.logger.debug("渲染失败", error);
        }
    }

    /**
     * 渲染错误页面
     */
    protected async _renderError(
        this: KylinRouter,
        outlet: KylinOutlet,
        viewHash: string,
        error: any,
        toRoute: KylinMatchedRouteItem[],
        fromRoute: KylinMatchedRouteItem[] | undefined,
        index: number,
        data?: any,
        existingViewTask?: ReturnType<KylinOutlet["createViewContainer"]>,
    ): Promise<void> {
        const viewTask =
            existingViewTask ||
            outlet.createViewContainer({
                viewHash: viewHash,
                dataHash: undefined,
                keepAlive: false,
                cssVars: [],
            });

        const errorElement = this._getErrorPageElement(error, toRoute);

        await this._runBeforeRender(
            fromRoute || [],
            toRoute.slice(0, index + 1),
            viewTask.container,
            data,
        );

        viewTask.reject(error, errorElement);

        this._runAfterRender(fromRoute || [], toRoute.slice(0, index + 1), viewTask.container);

        if (!existingViewTask) {
            viewTask.finally();
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
    protected _getErrorPageElement(
        this: KylinRouter,
        error: any,
        route: KylinMatchedRouteItem[],
    ): HTMLElement {
        const statusCode = String(error?.status || error?.statusCode || 500);

        // 查找对应的错误页面处理器（errorPages 在初始化时已设置，必定存在）
        const errorPages = (this as unknown as KylinRouter).options?.errorPages;
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
     * 将视图容器插入到 outlet
     * 处理容器的新增或替换逻辑，并根据 layout 属性显示/隐藏
     * @param outlet - 目标 outlet 元素
     * @param viewContainer - 要插入的视图容器
     * @param hash - 路由哈希（用作容器 id）
     */
    protected _renderViewToOutlet(
        this: KylinRouter,
        outlet: KylinOutlet,
        view: HTMLElement,
        hash: string,
    ): void {
        // 查找现有容器
        const viewContainer = outlet.querySelector(`[id="${hash}"]`) as HTMLElement;

        if (viewContainer) {
            // 已存在容器：替换内容
            viewContainer.replaceWith(viewContainer);
        } else {
            // 新容器：追加到 outlet
            outlet.appendChild(viewContainer);
        }
    }

    /**
     * 在父元素内部查找或创建 outlet
     * @param parent - 父元素
     * @param allowCreate - 是否允许自动创建 outlet（仅根路由为 true）
     * @returns 找到或创建的 outlet 元素
     */
    protected _findOutlet(
        this: KylinRouter,
        parent: HTMLElement,
        viewHash: string | undefined,
    ): KylinOutlet | null {
        // 先尝试查找现有的 outlet
        const outlets = findOutlet(parent);

        if (outlets.length > 0) {
            outlets.forEach((outlet) => {
                if (outlet.view === viewHash) {
                    return outlet;
                }
            });

            return outlets[0] as KylinOutlet;
        }
        return null;
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
