import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("kylin-loading")
export class KylinLoadingElement extends LitElement {
    createRenderRoot() {
        return this;
    }

    @property({ type: String, reflect: true })
    path?: string;
    render() {
        return html`<div>Loading...</div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-loading": KylinLoadingElement;
    }
}
