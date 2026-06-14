import { customElement, property } from "lit/decorators.js";
import { styles as commonStyles } from "./styles";
import { KylinRouterElementBase } from "../Base";
import { html } from "lit";
import type { KylinSlot } from "../Slot";
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
     * 根据 hash 获取 routeSlot
     * @param hash - routeSlot 的 hash
     * @returns routeSlot 元素
     */
    getSlot(hash: string): HTMLElement | null {
        return this.querySelector(`kylin-slot[id="${hash}"]`);
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
    }

    /**
     * 获取所有 viewContainer (kylin-slot 元素)
     */
    getSlots(): HTMLElement[] {
        return Array.from(this.querySelectorAll(":scope > kylin-slot[id]")) as HTMLElement[];
    }
    findOutlet(viewHash?: string): KylinOutlet {
        if (viewHash) {
            const viewContainer = this.getSlot(viewHash);
            if (viewContainer) {
                const outlet = findOutlet(viewContainer)[0];
                return outlet || this;
            }
        }
        return this;
    }
    render() {
        return html``;
    }
}

export type { KylinSlot } from "../Slot";

declare global {
    interface HTMLElementTagNameMap {
        "kylin-outlet": KylinOutlet;
    }
}
