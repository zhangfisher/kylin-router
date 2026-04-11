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

    @property({ type: String, reflect: true })
    layout?: "stack" | "tabs";

    /**
     * 启用 keepalive 缓存
     * 当启用时，视图会被缓存而不是销毁
     */
    @property({ type: Boolean, reflect: true })
    keepalive: boolean = false;

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
