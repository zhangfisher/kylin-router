import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles";
import { KylinRouterElementBase } from "../base";

@customElement("kylin-outlet")
export class KylinOutletElement extends KylinRouterElementBase {
    static styles = styles;

    @property({ type: String, reflect: true })
    path?: string;
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
    renderMode?: 'replace' | 'append';

    /**
     * 子 Outlet 列表，供 Router 组件使用
     */
    outlets?: KylinOutletElement[];

    connectedCallback() {
        super.connectedCallback();
        this._setupRouteListener();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // 清理路由监听器
        this.removeEventListener('route-change', this._handleRouteChange.bind(this));
    }

    /**
     * 设置路由变化监听
     */
    private _setupRouteListener() {
        // 监听 route-change 事件
        this.addEventListener('route-change', this._handleRouteChange.bind(this));
    }

    /**
     * 处理路由变化事件
     */
    private async _handleRouteChange(event: Event) {
        const customEvent = event as CustomEvent;
        const { route } = customEvent.detail;

        // 检查是否匹配当前 outlet 的 path
        if (this.path && !this._matchesPath(route.path)) {
            return;
        }

        // 检查 router 实例是否可用
        if (!this.router) {
            this._renderError('Router not available');
            return;
        }

        // 获取组件加载结果
        const loadResult = (this.router.routes.current.route as any).componentContent;
        if (!loadResult) {
            this._renderLoading();
            return;
        }

        // 渲染组件（Task 5 中会集成 Render 类）
        try {
            // TODO: 在 Task 5 中启用以下代码
            // await this.router.render.renderToOutlet(loadResult, this, {
            //     mode: this.renderMode || (route as any).renderMode,
            //     outlet: this
            // });

            // 临时占位：显示加载的内容信息
            this.innerHTML = `<div class="kylin-outlet-placeholder">Outlet: ${this.path || 'default'} - Route: ${route.name}</div>`;
        } catch (error) {
            this._renderError(error instanceof Error ? error.message : 'Render failed');
        }
    }

    /**
     * 检查路由路径是否匹配当前 outlet
     */
    private _matchesPath(routePath: string): boolean {
        if (!this.path) return true;
        // 支持精确匹配和前缀匹配
        return routePath === this.path || routePath.startsWith(this.path + '/');
    }

    /**
     * 渲染加载状态
     */
    private _renderLoading() {
        this.innerHTML = '<kylin-loading></kylin-loading>';
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

    render() {
        return html`<slot></slot>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-outlet": KylinOutletElement;
    }
}
