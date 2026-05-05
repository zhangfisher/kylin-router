import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles";
import { KylinRouterElementBase } from "../base";
import { html } from "lit";
import { OutletViewLoader, type OutletViewLoaderOptions } from "./view";

@customElement("kylin-outlet")
export class KylinOutlet extends KylinRouterElementBase {
    static styles = styles;

    /**
     * 启用 keepalive 缓存
     * 当启用时，视图会被缓存而不是销毁
     *
     * - false: 视图将被缓存而不是销毁
     * - true: 视图缓存
     *
     *
     */
    @property({ type: Boolean, reflect: true })
    keepalive: boolean = false;

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
    layout: "stack" | "tabs" | "hori" | "vert" = "stack";

    private mutationObserver: MutationObserver | null = null;

    /**
     *  重写 createRenderRoot，使组件不使用 Shadow DOM，以便样式和事件能够穿透到组件内部
     * 这对于路由组件来说很重要，因为它们需要与外部的路由状态和事件进行交互。
     * @returns
     */
    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        // 设置 MutationObserver 监听 DOM 变化
        this._setupMutationObserver();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // 断开 MutationObserver
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
    }
    /**
     *
     * @param hash
     * @param options  {keeyAlive:boolean}
     * @returns
     */
    createView(options?: OutletViewLoaderOptions) {
        return new OutletViewLoader(this, options);
    }

    // 监听属性变化
    protected updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);
        if (changedProperties.has("loading")) {
            if (this.loading) {
                this._showLoading();
            } else {
                this._hideLoading();
            }
        }
        if (changedProperties.has("view")) {
            this.showViewContainer(this.view!);
        }
    }

    private _showLoading(): void {
        // 显示加载指示器
        const loadingElement = this.querySelector("kylin-loading");
        if (!loadingElement) {
            const indicator = document.createElement("kylin-loading");
            indicator.setAttribute("message", "Loading...");
            this.appendChild(indicator);
        }
    }

    private _hideLoading(): void {
        // 隐藏加载指示器
        const loadingElement = this.querySelector("kylin-loading");
        if (loadingElement) {
            loadingElement.remove();
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
    }
    /**
     * 根据 hash 获取 viewContainer
     * @param hash - viewContainer 的 hash
     * @returns viewContainer 元素
     */
    getViewContainer(hash: string): HTMLElement | null {
        return this.querySelector(`[id="${hash}"]`);
    }
    /**
     * 获取所有 viewContainer
     */
    getViewContainers(): HTMLElement[] {
        return Array.from(this.querySelectorAll(":scope > .kylin-view[id]")) as HTMLElement[];
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
