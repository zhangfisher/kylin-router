import { customElement, property } from "lit/decorators.js";
import { styles as commonStyles } from "./styles";
import { KylinRouterElementBase } from "../Base";
import { html } from "lit";
import { ViewContainer, type ViewContainerOptions } from "./viewContainer";
import type { KylinMatchedRouteItem } from "@/types";
import { OutletLayoutBase } from "./base.layout";
import { StackLayout } from "./stack.layout";
import { TabsLayout } from "./tabs.layout";
import { CollapseLayout } from "./collapse.layout";
import { findOutlet } from "@/utils/findOutlet";

@customElement("kylin-outlet")
export class KylinOutlet extends KylinRouterElementBase {
    /**
     * 启用 keepalive 缓存
     * 当启用时，视图会被缓存而不是销毁
     *
     * - false: 离开路由时销毁视图
     * - true: 保留视图以便复用（默认）
     */
    @property({ type: Boolean, reflect: true })
    keepalive: boolean = true;

    /**
     * 加载状态
     * 当为 true 时，显示加载指示器
     */
    @property({ type: Boolean, reflect: true })
    loading: boolean = false;

    @property({ type: String, reflect: true })
    view?: string;

    /**
     * 布局模式
     * 控制多个 viewContainer 的布局方式
     */
    @property({ type: String, reflect: true })
    layout: "stack" | "tabs" | "collapse" = "stack";

    /**
     * Tabs 布局方向
     * 控制 tabs 头部的显示位置
     */
    @property({ type: String, reflect: true })
    tabDirection: "top" | "left" | "right" | "bottom" = "top";

    private mutationObserver: MutationObserver | null = null;
    private _layoutInstance: OutletLayoutBase | null = null;

    /**
     * 重写 createRenderRoot，使组件不使用 Shadow DOM，以便样式和事件能够穿透到组件内部
     * 这对于路由组件来说很重要，因为它们需要与外部的路由状态和事件进行交互。
     * @returns
     */
    createRenderRoot() {
        return this;
    }

    /**
     * 获取当前布局实例
     */
    private _getLayout(): OutletLayoutBase | null {
        switch (this.layout) {
            case "stack":
                return new StackLayout(this);
            case "tabs":
                return new TabsLayout(this);
            case "collapse":
                return new CollapseLayout(this);
            default:
                return new StackLayout(this);
        }
    }

    /**
     * 切换布局时重新初始化
     */
    private _switchLayout(): void {
        // 清理旧布局
        if (this._layoutInstance) {
            this._layoutInstance.cleanup();
        }

        // 创建新布局
        this._layoutInstance = this._getLayout();
        this._layoutInstance?.init();
    }

    /**
     * 强制 keepalive 约束
     * 当 layout="tabs" 或 "collapse" 时，自动将 keepalive 设置为 true
     */
    override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
        // tabs 或 collapse 布局必须 keepalive=true
        if ((this.layout === "tabs" || this.layout === "collapse") && !this.keepalive) {
            this.keepalive = true;
        }

        super.requestUpdate(name, oldValue);
    }

    connectedCallback() {
        super.connectedCallback();
        this._injectStyles();
        this._setupMutationObserver();
        this._switchLayout();
    }

    /**
     * 注入样式到 document.head
     * 仅在首次初始化时注入，如果已存在则忽略
     */
    private _injectStyles(): void {
        const styleId = "kylin-outlet";

        // 如果 head 中已存在，忽略
        const existingStyle = document.head.querySelector(`#${styleId}`);
        if (existingStyle) {
            return;
        }

        // 合并所有样式
        const allStyles = [
            commonStyles.cssText,
            StackLayout.styles.cssText,
            TabsLayout.styles.cssText,
            CollapseLayout.styles.cssText,
        ].join("\n");

        // 创建 style 元素
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = allStyles;

        document.head.appendChild(style);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        if (this._layoutInstance) {
            this._layoutInstance.cleanup();
            this._layoutInstance = null;
        }
    }

    /**
     * 根据 hash 获取 viewContainer
     * @param hash - viewContainer 的 hash
     * @returns viewContainer 元素
     */
    getViewContainer(hash: string): HTMLElement | null {
        return this.querySelector(`[id="${hash}"]`);
    }
    private _injectRouteData(matched: KylinMatchedRouteItem, viewContainer: ViewContainer) {
        // 检测是否为参数变化导致的容器复用
        const existingContainer = this.getViewContainer(viewContainer.viewHash);
        const isReusedWithParamChange =
            existingContainer && existingContainer.dataset.url !== matched.url;

        const routeData: Record<string, any> = {};
        if (matched.params && Object.keys(matched.params).length) {
            routeData["$params"] = matched.params;
        }
        if (matched.query && Object.keys(matched.query).length > 0) {
            routeData["$query"] = matched.query;
        }
        if (Object.keys(routeData).length > 0) {
            viewContainer.container.setAttribute("x-inject-data", JSON.stringify(routeData));
            // 如果是参数变化导致的容器复用，直接更新 Alpine 组件数据
            if (isReusedWithParamChange) {
                this._updateAlpineComponentData(viewContainer.container, routeData);
            }
        }
    }
    /**
     *
     * @param hash
     * @param options  {keeyAlive:boolean}
     * @returns
     */
    createViewContainer(matched: KylinMatchedRouteItem, options?: ViewContainerOptions) {
        const viewContainer = new ViewContainer(this, options);
        // 记录
        viewContainer.container.setAttribute("data-url", matched.url);
        // 将路由参数、查询、状态注入视图模板
        this._injectRouteData(matched, viewContainer);
        return viewContainer;
    }

    /**
     * 直接更新 Alpine 组件的响应式数据
     * 用于参数变化时同步更新已初始化的组件状态
     */
    private _updateAlpineComponentData(container: HTMLElement, newData: Record<string, any>): void {
        try {
            const Alpine = (globalThis as any).Alpine;
            if (!Alpine) return;

            const componentData = Alpine.$data(container);
            if (componentData) {
                // 直接赋值即可触发 Alpine 的响应式更新
                Object.entries(newData).forEach(([key, value]) => {
                    if (key in componentData) {
                        componentData[key] = value;
                    }
                });
            }
        } catch (error) {
            console.warn("Failed to update Alpine component data:", error);
        }
    }

    // 监听属性变化
    protected updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        // 布局切换时重新初始化
        if (changedProperties.has("layout")) {
            this._switchLayout();
        }

        // 通知布局实例属性变化
        if (this._layoutInstance) {
            changedProperties.forEach((oldValue, name) => {
                this._layoutInstance!.onPropertyChanged(
                    name as string,
                    oldValue,
                    this[name as keyof this],
                );
            });
        }

        if (changedProperties.has("view")) {
            this.showViewContainer(this.view!);
        }
    }

    /**
     * 设置 MutationObserver 监听 DOM 变化
     */
    private _setupMutationObserver(): void {
        this.mutationObserver = new MutationObserver((mutations) => {
            this.onSlotChange(mutations);
        });
        // 配置观察选项 - 只观察直接子节点的变化
        const config = {
            childList: true, // 观察子节点的变化
            subtree: false, // 不观察后代节点，只观察直接子节点
            attributes: false, // 不观察属性变化
            characterData: false, // 不观察文本内容变化
        };
        // 开始观察
        this.mutationObserver.observe(this, config);
    }

    /**
     * Slot change 事件处理函数
     * 当插槽内容发生变化时调用
     * @param mutations - MutationRecord 数组，包含变化的详细信息
     */
    protected onSlotChange(mutations: MutationRecord[]): void {
        // 过滤掉无关的变化，只处理实际的子节点增删
        const relevantMutations = mutations.filter(
            (mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0,
        );
        if (relevantMutations.length === 0) {
            return; // 没有相关变化，不触发事件
        }

        // 通知布局实例
        this._layoutInstance?.onSlotChange(mutations);
    }
    /**
     * 获取所有 viewContainer
     */
    getViewContainers(): HTMLElement[] {
        return Array.from(this.querySelectorAll(":scope > .kylin-view[id]")) as HTMLElement[];
    }
    findOutlet(viewHash?: string): KylinOutlet {
        if (viewHash) {
            const viewContainer = this.getViewContainer(viewHash);
            if (viewContainer) {
                const outlet = findOutlet(viewContainer)[0];
                return outlet || this;
            }
        }
        return this;
    }
    /**
     * 根据 layout 属性显示指定的 viewContainer
     * @param hash - 要显示的 viewContainer 的 hash
     */
    showViewContainer(hash: string): void {
        // 获取所有 viewContainer
        const viewContainers = this.getViewContainers();
        if (viewContainers.length === 0) return;
        let hasActive: boolean = false;
        viewContainers.forEach((view) => {
            if (view.id === hash) {
                hasActive = true;
                view.classList.add("active");
            } else {
                view.classList.remove("active");
            }
        });
        if (!hasActive) {
            viewContainers[0].classList.add("active");
        }
    }

    /**
     * 渲染视图内容
     * @param template - 要渲染的内容
     * @param hash - 路由哈希
     * @param hasData - 是否有数据
     * @param data - 路由数据
     */
    async renderView(
        template: any,
        hash: string,
        hasData: boolean,
        data?: Record<string, any>,
        error?: Error,
    ): Promise<void> {
        // 创建新的视图容器
        const viewContainer = document.createElement("div");
        viewContainer.setAttribute("data-hash", hash);

        // 根据 hasData 决定是否创建 Alpine.data
        if (hasData && data) {
            viewContainer.setAttribute("x-data", hash);
        }

        // 渲染内容
        if (typeof template === "string") {
            viewContainer.innerHTML = template;
        } else if (template instanceof HTMLElement) {
            viewContainer.appendChild(template);
        }
    }
    render() {
        return html``;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-outlet": KylinOutlet;
    }
}
