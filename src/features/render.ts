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
                const route = matched.route as Required<KylinRouteItem>;
                const viewHash = matched.hash;
                const dataHash = matched.route._getData?.meta?.hash;

                currentOutlet = this._findOutlet(currentOutlet || this.host, viewHash);

                if (!currentOutlet) {
                    this.logger.debug(`未找到${matched.url} outlet，跳过渲染`);
                    break;
                }
                // 如果当前路由启用keepAlive,且视图容器已经存在，则跳过渲染。避免重复渲染
                if (route.keepAlive) {
                    const viewContainer = currentOutlet.getViewContainer(viewHash);
                    if (viewContainer) {
                        // 切换视图
                        currentOutlet.view = viewHash;
                        continue;
                    }
                } // 如果没有启用KeepAlive,则每次路由时均创建新的视图容器

                const viewTask = currentOutlet.createView({
                    viewHash: viewHash,
                    dataHash: dataHash,
                    keepAlive: route.keepAlive,
                });

                try {
                    const data = await this._loadData(matched);
                    const view = await this._loadView(matched)!;

                    // 调试日志
                    this.logger.debug(`[渲染调试] 路由: ${matched.url}`);
                    this.logger.debug(`[渲染调试] viewHash: ${viewHash}`);
                    this.logger.debug(`[渲染调试] dataHash: ${dataHash}`);
                    this.logger.debug(`[渲染调试] data.value:{}`, JSON.stringify(data?.value));
                    this.logger.debug(`[渲染调试] data.error:{}`, JSON.stringify(data?.error));

                    if (view.error) {
                        viewTask.reject(view.error);
                    } else {
                        //  执行 beforeRender 钩子（同步等待）
                        await this._runBeforeRender(
                            fromRoute || [],
                            toRoute.slice(0, i + 1),
                            viewTask.container,
                            data?.value,
                        );
                        //  创建或更新视图容器插入到 DOM
                        viewTask.resolve(view.value, data?.value);
                        // 异步执行 afterRender 钩子（不等待）
                        this._runAfterRender(
                            fromRoute || [],
                            toRoute.slice(0, i + 1),
                            viewTask.container,
                        );
                    }
                } catch {
                } finally {
                    viewTask.finally();
                }
            }
        } catch (error) {
            this.logger.debug("渲染失败", error);
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
