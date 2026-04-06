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
     * 子 Outlet 列表，供 Router 组件使用
     */
    outlets?: KylinOutletElement[];

    render() {
        return html`<slot></slot>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-outlet": KylinOutletElement;
    }
}
