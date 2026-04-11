import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles";
import { KylinRouterElementBase } from "../base";

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
     * 路由加载超时时间，单位毫秒，默认 5000ms
     */
    @property({ type: Number })
    timeout: number = 5000;
    /**
     * 是否启用缓存，默认为 true。
     * 启用后，路由组件在第一次加载后会被缓存起来，
     * 下次访问相同路径时会直接使用缓存的组件实例，而不是重新创建一个新的实例。这可以提高性能，但可能会导致某些状态无法正确更新。如果你的组件需要在每次访问时都重新渲染，可以将 cacheable 设置为 false。
     */
    @property({ type: Boolean })
    cacheable: boolean = true;

    /**
     * 渲染模式，覆盖默认的渲染模式
     */
    @property({ type: String, reflect: true })
    renderMode?: "replace" | "append";

    /**
     * 启用 keepalive 缓存
     * 当启用时，视图会被缓存而不是销毁
     */
    @property({ type: Boolean, reflect: true })
    keepalive: boolean = false;

    /**
     * 子 Outlet 列表，供 Router 组件使用
     */
    outlets?: KylinOutletElement[];

    /** Alpine.js store 名称 */
    private _currentStoreName?: string;

    /** 缓存的视图容器 */
    private _viewCache: Map<string, HTMLElement> = new Map();

    /** 当前激活的视图 hash */
    private _activeHash?: string;

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
        this._setupRouteListener();

        // 如果是模态 outlet，设置特殊行为
        if (this.isModal) {
            this.setupModalBehavior();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // 清理路由监听器
        this.removeEventListener("route-change", this._handleRouteChange.bind(this));

        // 清理所有缓存
        this._viewCache.clear();

        // 清理 Alpine.data（Alpine.js 会自动清理）
        this._currentStoreName = undefined;
    }

    /**
     * 设置路由变化监听
     */
    private _setupRouteListener() {
        // 监听 route-change 事件
        this.addEventListener("route-change", this._handleRouteChange.bind(this));
    }

    /**
     * 处理路由变化事件
     * 注意：渲染现在由 Router 的 _renderRouteHierarchy 控制
     * 此方法主要用于数据更新等场景
     */
    private async _handleRouteChange(event: Event) {
        const customEvent = event as CustomEvent;
        const { route } = customEvent.detail;

        // 检查是否为模态路由
        const isModalRoute = (this.router as any).getModalConfig?.(route)?.modal;

        if (isModalRoute && !this.isModal) {
            // 模态路由但不是模态 outlet，不处理
            return;
        }

        if (!isModalRoute && this.isModal) {
            // 普通路由但是模态 outlet，不处理
            return;
        }

        // 检查 router 实例是否可用
        if (!this.router) {
            this._renderError("Router not available");
            return;
        }

        // 注意：实际的渲染由 Router 的 _renderRouteHierarchy 方法控制
        // 这里不再主动触发渲染，只处理数据更新等逻辑（如果需要）
    }

    /**
     * 渲染加载状态
     */
    private _renderLoading() {
        this.innerHTML = "<kylin-loading></kylin-loading>";
    }

    /**
     * 渲染错误状态
     */
    private _renderError(message: string) {
        this.innerHTML = `
            <div class="kylin-outlet-error">
                <h3>Outlet Error</h3>
                <p>${message}</p>
            </div>
        `;
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
     * 添加 Alpine.js store
     * @param name - store 名称
     * @param data - store 数据
     */
    addStore(name: string, data: Record<string, any>): void {
        // 注册 Alpine.data
        if (typeof window !== "undefined" && (window as any).Alpine) {
            (window as any).Alpine.data(name, () => data);
            this._currentStoreName = name;

            // 设置 x-data 属性
            this.setAttribute("x-data", name);
        }
    }

    /**
     * 渲染视图内容
     * @param content - 要渲染的内容
     * @param hash - 路由哈希
     * @param hasData - 是否有数据
     * @param data - 路由数据
     */
    async renderView(
        content: any,
        hash: string,
        hasData: boolean,
        data?: Record<string, any>
    ): Promise<void> {
        // 如果启用 keepalive，检查缓存
        if (this.keepalive && this._viewCache.has(hash)) {
            const cachedView = this._viewCache.get(hash)!;
            this._switchToView(hash, cachedView);
            return;
        }

        // 创建新的视图容器
        const viewContainer = document.createElement("div");
        viewContainer.setAttribute("data-hash", hash);

        // 根据 hasData 决定是否创建 Alpine.data
        if (hasData && data) {
            // 注册 Alpine.js store
            this.addStore(hash, data);
            viewContainer.setAttribute("x-data", hash);
        }

        // 渲染内容
        if (typeof content === "string") {
            viewContainer.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            viewContainer.appendChild(content);
        } else if (content?.template) {
            // lit 模板渲染 - 使用 renderToOutlet 的原有逻辑
            // 内容已经在 renderToOutlet 中处理好了
        }

        // 如果启用 keepalive，缓存视图
        if (this.keepalive) {
            this._viewCache.set(hash, viewContainer);
        }

        // 切换到新视图
        this._switchToView(hash, viewContainer);
    }

    /**
     * 切换到指定视图
     * @param hash - 视图哈希
     * @param view - 视图元素
     */
    private _switchToView(hash: string, view: HTMLElement): void {
        // 隐藏当前视图
        if (this._activeHash && this._activeHash !== hash) {
            const currentView = this.querySelector(`[data-hash="${this._activeHash}"]`) as HTMLElement;
            if (currentView) {
                currentView.style.display = "none";
            }
        }

        // 显示新视图
        view.style.display = "";

        // 如果视图还未添加到 DOM，添加它
        if (!view.parentElement) {
            this.appendChild(view);
        }

        this._activeHash = hash;

        // 如果未启用 keepalive，清理旧视图
        if (!this.keepalive) {
            this._cleanupInactiveViews(hash);
        }
    }

    /**
     * 清理非活动视图（未启用 keepalive 时）
     * @param activeHash - 当前活动的哈希
     */
    private _cleanupInactiveViews(activeHash: string): void {
        const views = this.querySelectorAll("[data-hash]");
        views.forEach((view) => {
            const hash = view.getAttribute("data-hash");
            if (hash !== activeHash) {
                view.remove();
                // 清理对应的 Alpine.data
                if (hash && typeof window !== "undefined" && (window as any).Alpine) {
                    // Alpine.js 会自动清理，但我们可以主动移除数据
                    // 注意：这里不需要手动删除，Alpine.js 会处理
                }
            }
        });
    }

    render() {
        return html`<slot></slot>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-outlet": KylinOutletElement;
    }
}
