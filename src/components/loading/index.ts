import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles";

@customElement("kylin-loading")
export class KylinLoading extends LitElement {
    static styles = styles;
    /**
     * 自定义加载模板（D-10）
     * 支持 lit 模板或 HTML 字符串
     */
    @property({ type: String })
    message?: string = "Loading...";

    connectedCallback() {
        super.connectedCallback();
    }

    render() {
        return html`
            <div class="spinner"></div>
            <div class="message">${this.message}</div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-loading": KylinLoading;
    }
}
