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

export class Render {
    /**
     * 执行渲染步骤 - 新的渲染系统
     * 支持逐级嵌套路由渲染、beforeRender/afterRender 钩子、layout 布局等
     */
    protected async _renderRoute(
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

                // 获取异步信号
                const getView = route._getView;
                const getData = route._getData;

                if (!getView) {
                    continue;
                }

                try {
                    // 3. 显示加载状态
                    this._showLoadingInOutlet(currentOutlet!);

                    // 🔧 测试：检查 getView() 返回的是什么
                    const loadResults = await Promise.allSettled([
                        getView!(),
                        getData?.() || Promise.resolve(undefined),
                    ]);
                    const viewResult = loadResults[0];
                    const dataResult = loadResults[1];

                    // 5. 处理视图加载结果
                    if (viewResult.status === "fulfilled") {
                        const view = viewResult.value;

                        // 6. 获取数据和 hash（如果有）
                        let data: Record<string, any> | undefined;
                        let hash = matched.hash;
                        if (getData && dataResult?.status === "fulfilled" && dataResult.value) {
                            data = dataResult.value;
                            // 从 dataSignal.meta.hash 读取 hash
                            hash = getData.meta.hash || matched.hash;
                        }

                        // 7. 创建或更新视图容器（还未插入到 DOM）
                        const viewContainer = this._createOrUpdateViewContainer(
                            currentOutlet!,
                            view,
                            hash,
                            data,
                        );

                        // 8. 执行 beforeRender 钩子（同步等待）
                        await this._runBeforeRender(
                            fromRoute || [],
                            toRoute.slice(0, i + 1),
                            viewContainer,
                            data,
                        );

                        // 9. 将容器插入到 outlet（此时才真正渲染到 DOM）
                        this._renderViewToOutlet(currentOutlet!, viewContainer, hash);

                        // 10. 隐藏加载状态
                        this._hideLoadingInOutlet(currentOutlet!);

                        // 11. 异步执行 afterRender 钩子（不等待）
                        this._runAfterRender(
                            fromRoute || [],
                            toRoute.slice(0, i + 1),
                            viewContainer,
                        );

                        // 12. 查找下一级 outlet
                        if (i < toRoute.length - 1) {
                            const nextOutlet = this._findNextLevelOutlet(currentOutlet!, hash);
                            if (nextOutlet) {
                                currentOutlet = nextOutlet;
                            } else {
                                break;
                            }
                        }
                    } else if (viewResult.status === "rejected") {
                        // 14. 处理视图加载错误
                        await this._renderErrorViewToOutlet(
                            currentOutlet,
                            matched.hash,
                            viewResult.reason,
                        );
                    }
                } catch (error) {
                    await this._renderErrorViewToOutlet(
                        currentOutlet,
                        matched.hash,
                        error as Error,
                    );
                }
            }
        } catch (error) {
            this.logger.debug("渲染失败", error);
        }
    }

    /**
     * 创建或更新视图容器（不插入 DOM）
     * @param outlet - 父 outlet 元素
     * @param view - 视图内容（字符串或 HTMLElement）
     * @param hash - 路由哈希（用作容器 id）
     * @param data - 路由数据
     * @returns 视图容器元素（已创建或更新，但未插入 DOM）
     */
    protected _createOrUpdateViewContainer(
        this: KylinRouter,
        outlet: KylinOutlet,
        view: string | HTMLElement,
        hash: string,
        data?: Record<string, any>,
    ): HTMLElement {
        // 查找现有容器
        let viewContainer = outlet.querySelector(`[id="${hash}"]`) as HTMLElement;

        if (!viewContainer) {
            // 创建新容器
            viewContainer = document.createElement("div");
            viewContainer.id = hash;
        } else {
            // 将更新现有容器
            this.logger.debug(`渲染流程: 更新现有视图容器 (id: ${hash})`);
        }

        // 更新 x-data 属性
        if (data) {
            viewContainer.setAttribute("x-data", hash);
        } else {
            viewContainer.removeAttribute("x-data");
        }

        // 插入视图内容到容器
        if (typeof view === "string") {
            viewContainer.innerHTML = view;
        } else if (view instanceof HTMLElement) {
            viewContainer.innerHTML = "";
            viewContainer.appendChild(view);
        }

        return viewContainer;
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
        viewContainer: HTMLElement,
        hash: string,
    ): void {
        // 查找现有容器
        const existingContainer = outlet.querySelector(`[id="${hash}"]`) as HTMLElement;

        if (!existingContainer) {
            // 新容器：追加到 outlet
            outlet.appendChild(viewContainer);
        } else {
            // 已存在容器：替换内容

            existingContainer.replaceWith(viewContainer);
        }
    }

    /**
     * 渲染错误视图到 outlet
     * 仅在视图加载失败时调用
     * @param outlet - 目标 outlet 元素
     * @param hash - 路由哈希（用作容器 id）
     * @param error - 错误信息
     */
    protected async _renderErrorViewToOutlet(
        this: KylinRouter,
        outlet: KylinOutlet,
        hash: string,
        error: Error,
    ): Promise<void> {
        // 隐藏加载状态
        this._hideLoadingInOutlet(outlet);
        const errorView = this._createErrorView(error);
        // 查找或创建错误容器
        let errorContainer = outlet.querySelector(`[id="${hash}"]`) as HTMLElement;
        if (!errorContainer) {
            errorContainer = document.createElement("div");
            errorContainer.id = hash;
            outlet.appendChild(errorContainer);
        }
        errorContainer.innerHTML = errorView;
    }

    /**
     * 创建错误视图
     * @param error - 错误对象
     * @returns 错误视图 HTML
     */
    protected _createErrorView(this: KylinRouter, error: Error): string {
        const errorMessage = error?.message || "未知错误";
        return `
            <div style="padding: 20px; background: #fee; color: #c00; border-radius: 4px;">
                <h3>渲染错误</h3>
                <p>${errorMessage}</p>
            </div>
        `;
    }

    /**
     * 在 outlet 中显示 loading 状态
     * @param outlet - 目标 outlet 元素
     */
    protected _showLoadingInOutlet(this: KylinRouter, outlet: KylinOutlet): void {
        // 创建 loading 元素
        const loadingElement = document.createElement("kylin-loading");
        loadingElement.setAttribute("data-role", "loading-indicator");

        // 清空 outlet 并插入 loading
        outlet.innerHTML = "";
        outlet.appendChild(loadingElement);
    }

    /**
     * 隐藏 outlet 中的 loading 状态
     * @param outlet - 目标 outlet 元素
     */
    protected _hideLoadingInOutlet(this: KylinRouter, outlet: KylinOutlet): void {
        const loadingElement = outlet.querySelector("kylin-loading[data-role='loading-indicator']");
        if (loadingElement) {
            loadingElement.remove();
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
                // if (outlet.view === viewHash) {
                //     return outlet as KylinOutlet;
                // }
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
