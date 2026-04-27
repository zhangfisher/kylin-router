import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles";
import { KylinRouterElementBase } from "../base";
import { html } from "lit";

@customElement("kylin-outlet")
export class KylinOutletElement extends KylinRouterElementBase {
    static styles = styles;

    /**
     * 是否为模态 outlet
     * 模态 outlet 用于渲染模态路由内容
     */
    @property({ type: Boolean, reflect: true })
    isModal: boolean = false;
    /**
     * 渲染模式，覆盖默认的渲染模式
     */
    @property({ type: String, reflect: true })
    mode?: "replace" | "append";

    /**
     * 启用 keepalive 缓存
     * 当启用时，视图会被缓存而不是销毁
     */
    @property({ type: Boolean, reflect: true })
    keepalive: boolean = false;

    /**
     * 加载状态
     * 当为 true 时，显示加载指示器
     */
    @property({ type: Boolean, reflect: true })
    loading: boolean = false;

    /**
     * 布局模式
     * 控制多个 viewContainer 的布局方式
     */
    @property({ type: String, reflect: true })
    layout: "stack" | "tabs" | "hori" | "vert" = "stack";

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
        // 如果是模态 outlet，设置特殊行为
        if (this.isModal) {
            this.setupModalBehavior();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    // 监听属性变化
    protected updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);

        if (changedProperties.has("loading")) {
            if (this.loading) {
                this._showLoadingIndicator();
            } else {
                this._hideLoadingIndicator();
            }
        }
    }

    private _showLoadingIndicator(): void {
        // 显示加载指示器
        const loadingElement = this.querySelector("kylin-loading");
        if (!loadingElement) {
            const indicator = document.createElement("kylin-loading");
            this.appendChild(indicator);
        }
    }

    private _hideLoadingIndicator(): void {
        // 隐藏加载指示器
        const loadingElement = this.querySelector("kylin-loading");
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    /**
     * 设置模态 outlet 的特殊行为
     */
    private setupModalBehavior() {
        // 模态 outlet 的特殊样式和定位
        this.style.position = "relative";
        this.style.zIndex = "1";

        // 设置模态关闭监听
        this._setupModalCloseListener();
    }

    /**
     * 设置模态关闭监听器
     */
    private _setupModalCloseListener() {
        this.addEventListener("close-modal", () => {
            if (this.router) {
                (this.router as any).closeModal();
            }
        });
    }

    /**
     * 根据 layout 属性显示指定的 viewContainer
     * @param hash - 要显示的 viewContainer 的 hash
     */
    showViewContainer(hash: string): void {
        // 获取所有 viewContainer
        const allContainers = Array.from(this.querySelectorAll("[id]")) as HTMLElement[];

        if (this.layout === "stack") {
            // stack 模式：只显示一个，隐藏其他
            allContainers.forEach(container => {
                if (container.id === hash) {
                    container.style.display = "";
                } else {
                    container.style.display = "none";
                }
            });
        } else if (this.layout === "tabs") {
            // tabs 模式：显示 tab 导航和内容区域
            // TODO: 实现 tabs 布局逻辑
        } else if (this.layout === "hori") {
            // hori 模式：水平排列
            allContainers.forEach(container => {
                container.style.display = container.id === hash ? "block" : "none";
            });
        } else if (this.layout === "vert") {
            // vert 模式：垂直排列
            allContainers.forEach(container => {
                container.style.display = container.id === hash ? "block" : "none";
            });
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
    private createViewPart(
        template: string | HTMLElement,
        data: Record<string, any> | undefined,
        hash: string,
    ) {
        // 创建新的视图容器
        const viewPart = document.createElement("div");
        viewPart.setAttribute("x-data", hash);
        viewPart.setAttribute("id", hash);
    }
    render() {
        return html``;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-outlet": KylinOutletElement;
    }
}
