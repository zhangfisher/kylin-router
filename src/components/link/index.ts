import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { KylinRouterElementBase } from "../base";

@customElement("kylin-link")
export class KylinLinkElement extends KylinRouterElementBase {
    handleClick: unknown;

    @property({ type: String })
    to = "";

    createRenderRoot() {
        return this;
    }

    render() {
        return html` <a href="#" @click=${this.handleClick}><slot></slot></a>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-link": KylinLinkElement;
    }
}
