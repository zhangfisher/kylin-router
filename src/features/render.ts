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
import type { KylinMatchedRouteItem } from "@/types";

export class Render {
    // ============================================================================
    // 新渲染系统方法 - 支持 viewContainer 和嵌套路由
    // ============================================================================

    /**
     * 执行渲染步骤 - 新的渲染系统
     * 支持逐级嵌套路由渲染、beforeRender/afterRender 钩子、layout 布局等
     */
    protected async _renderRoute(
        this: KylinRouter,
        toRoute: KylinMatchedRouteItem[],
        fromRoute: KylinMatchedRouteItem[] | undefined,
    ): Promise<void> {
        this.logger.debug("渲染流程: 开始渲染组件");
        try {
            // 1. 找到根元素下的第一个 outlet
            let currentOutlet = this._findOrCreateOutlet(this.host, false);
            if (!currentOutlet) {
                this.logger.debug("渲染流程: 未找到 outlet，跳过渲染");
                return;
            }

            // 2. 逐级渲染路由
            for (let i = 0; i < toRoute.length; i++) {
                const matched = toRoute[i];
                const route = matched.route;

                // 获取异步信号
                const viewSignal = (route as any)._getView;
                const dataSignal = (route as any)._getData;

                if (!viewSignal) {
                    this.logger.debug(`渲染流程: 路由 ${matched.path} 缺少视图信号，跳过`);
                    continue;
                }

                try {
                    // 3. 显示加载状态
                    this._showLoadingInOutlet(currentOutlet);

                    // 4. 并发等待视图和数据加载完成
                    const loadResults = await Promise.allSettled([
                        viewSignal.promise,
                        dataSignal?.promise || Promise.resolve(undefined)
                    ]);

                    const viewResult = loadResults[0];
                    const dataResult = loadResults[1];

                    // 5. 处理视图加载结果
                    if (viewResult.status === "fulfilled") {
                        const view = viewResult.value;

                        // 6. 获取数据和 hash（如果有）
                        let data: Record<string, any> | undefined;
                        let hash = matched.hash;
                        if (dataSignal && dataResult?.status === "fulfilled" && dataResult.value) {
                            data = dataResult.value;
                            // 从 dataSignal.meta.hash 读取 hash
                            hash = dataSignal.meta.hash || matched.hash;
                        }

                        // 7. 创建或更新视图容器（还未插入到 DOM）
                        const viewContainer = this._createOrUpdateViewContainer(
                            currentOutlet,
                            view,
                            hash,
                            data
                        );

                        // 8. 执行 beforeRender 钩子（同步等待）
                        // 此时 viewContainer 已创建并填充内容，但还未插入 DOM
                        // 钩子函数有机会修改 viewContainer 和 data
                        try {
                            await this.hooks.runBeforeRender({
                                from: fromRoute || [],
                                to: toRoute.slice(0, i + 1),
                                view: viewContainer,
                                data: data,
                            });
                        } catch (hookError) {
                            this.logger.error("渲染流程: beforeRender 钩子执行失败", hookError);
                            // 钩子失败不阻止渲染流程
                        }

                        // 9. 将容器插入到 outlet（此时才真正渲染到 DOM）
                        const existingContainer = currentOutlet.querySelector(`[id="${hash}"]`) as HTMLElement;
                        if (!existingContainer) {
                            // 新容器：追加到 outlet
                            currentOutlet.appendChild(viewContainer);
                            this.logger.debug(`渲染流程: 创建并插入新视图容器 (id: ${hash})`);
                        } else {
                            // 已存在容器：替换内容
                            existingContainer.replaceWith(viewContainer);
                            this.logger.debug(`渲染流程: 更新现有视图容器 (id: ${hash})`);
                        }

                        // 10. 根据 layout 属性显示/隐藏 viewContainer
                        if (currentOutlet instanceof HTMLElement && "showViewContainer" in currentOutlet) {
                            (currentOutlet as any).showViewContainer(hash);
                        }

                        // 11. 隐藏加载状态
                        this._hideLoadingInOutlet(currentOutlet);

                        // 12. 异步执行 afterRender 钩子（不等待）
                        this.hooks.runAfterRender({
                            from: fromRoute || [],
                            to: toRoute.slice(0, i + 1),
                            el: viewContainer,
                        }).catch((hookError) => {
                            this.logger.error("渲染流程: afterRender 钩子执行失败", hookError);
                        });

                        // 13. 查找下一级 outlet
                        if (i < toRoute.length - 1) {
                            const nextOutlet = this._findNextLevelOutlet(currentOutlet, hash);
                            if (nextOutlet) {
                                currentOutlet = nextOutlet;
                            } else {
                                this.logger.debug(`渲染流程: 路由 ${matched.path} 未找到子 outlet，停止嵌套渲染`);
                                break;
                            }
                        }
                    } else if (viewResult.status === "rejected") {
                        // 14. 处理视图加载错误
                        await this._renderViewToOutlet(
                            currentOutlet,
                            matched.hash,
                            viewResult.reason
                        );
                    }
                } catch (error) {
                    this.logger.error(`渲染流程: 路由 ${matched.path} 渲染失败`, error);
                    await this._renderViewToOutlet(
                        currentOutlet,
                        matched.hash,
                        error as Error
                    );
                }
            }

            this.logger.debug("渲染流程: 渲染完成");
        } catch (error) {
            console.error("渲染流程失败:", error);
            this.logger.debug("渲染流程: 渲染失败", error);
            // 渲染失败不阻塞导航流程
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
        outlet: HTMLElement,
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
            this.logger.debug(`渲染流程: 创建新视图容器 (id: ${hash})`);
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
     * 在指定路由的 viewContainer 内部查找下一级 outlet
     * @param parentOutlet - 父 outlet 元素
     * @param currentHash - 当前路由的 hash（用于定位对应的 viewContainer）
     * @returns 找到的子 outlet，如果未找到返回 null
     */
    protected _findNextLevelOutlet(
        this: KylinRouter,
        parentOutlet: HTMLElement,
        currentHash: string
    ): HTMLElement | null {
        // 1. 先找到当前路由对应的 viewContainer
        const currentViewContainer = parentOutlet.querySelector(`[id="${currentHash}"]`) as HTMLElement;

        if (!currentViewContainer) {
            this.logger.debug(`渲染流程: 未找到当前路由的 viewContainer (hash: ${currentHash})`);
            return null;
        }

        // 2. 在该 viewContainer 内部查找 kylin-outlet
        const childOutlets = findOutlet(currentViewContainer);

        if (childOutlets.length === 0) {
            this.logger.debug(`渲染流程: viewContainer 内部未找到子 outlet (hash: ${currentHash})`);
            return null;
        }

        // 返回第一个找到的 outlet
        this.logger.debug(`渲染流程: 找到子 outlet (hash: ${currentHash})`);
        return childOutlets[0];
    }

    /**
     * 渲染错误视图到 outlet
     * @param outlet - 目标 outlet 元素
     * @param hash - 路由哈希（用作容器 id）
     * @param error - 错误信息
     */
    protected async _renderViewToOutlet(
        this: KylinRouter,
        outlet: HTMLElement,
        hash: string,
        error: Error,
    ): Promise<void> {
        // 隐藏加载状态
        this._hideLoadingInOutlet(outlet);

        // 处理错误情况
        this.logger.debug("渲染流程: 渲染错误视图", error);
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
    protected _showLoadingInOutlet(this: KylinRouter, outlet: HTMLElement): void {
        this.logger.debug("渲染流程: 显示 loading 状态");

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
    protected _hideLoadingInOutlet(this: KylinRouter, outlet: HTMLElement): void {
        this.logger.debug("渲染流程: 隐藏 loading 状态");

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
    protected _findOrCreateOutlet(
        this: KylinRouter,
        parent: HTMLElement,
        allowCreate: boolean = false,
    ): HTMLElement | null {
        // 先尝试查找现有的 outlet
        const outlets = findOutlet(parent);

        if (outlets.length > 0) {
            this.logger.debug("渲染流程: 找到现有 outlet");
            return outlets[0];
        }

        // 如果没有找到且允许创建，自动创建一个（仅根路由）
        if (allowCreate) {
            this.logger.debug("渲染流程: 未找到 outlet，自动创建");
            const newOutlet = document.createElement("kylin-outlet");
            parent.appendChild(newOutlet);
            return newOutlet;
        }

        // 子路由找不到 outlet，返回 null
        this.logger.debug("渲染流程: 未找到 outlet，且不允许自动创建");
        return null;
    }

    /**
     * 确保 host 元素内部有至少一个 outlet
     * 如果没有，自动创建并插入一个默认 outlet
     */
    protected _ensureDefaultOutlet(this: KylinRouter): void {
        const outlets = findOutlet(this.host);
        if (outlets.length > 0) {
            this.logger.debug("自动插入 outlet: host 内部已有 outlet，跳过创建");
            return;
        }

        this.logger.debug("自动插入 outlet: host 内部没有 outlet，自动创建");
        const defaultOutlet = document.createElement("kylin-outlet");
        this.host.appendChild(defaultOutlet);
        this.logger.debug("自动插入 outlet: 默认 outlet 已创建并插入");
    }
}
