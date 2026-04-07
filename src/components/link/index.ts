import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { KylinRouterElementBase } from "../base";

@customElement("kylin-link")
export class KylinLinkElement extends KylinRouterElementBase {
    @property({ type: String })
    to = "";

    @property({ type: Boolean })
    replace = false;

    createRenderRoot() {
        return this;
    }

    /**
     * 判断目标路径是否为内部路由
     * 内部路由：以 / 开头且不包含 ://
     * 外部链接：包含 ://（如 https://、http://）
     */
    private isInternalLink(path: string): boolean {
        if (!path) return false;
        // 以 / 开头且不包含 :// 的路径视为内部路由
        return path.startsWith("/") && !path.includes("://");
    }

    /**
     * 检查路径是否为危险协议（javascript:、data:）
     * 按照 T-02-01 威胁缓解策略实现
     */
    private isDangerousProtocol(path: string): boolean {
        const trimmed = path.trim().toLowerCase();
        return trimmed.startsWith("javascript:") || trimmed.startsWith("data:");
    }

    /**
     * 处理点击事件
     * - 内部路由：阻止默认行为，使用 router 导航
     * - 外部链接：不阻止默认行为，允许浏览器直接跳转
     * - 危险协议：阻止默认行为，不执行任何导航
     * - 无 router 实例：降级为普通 <a> 标签
     */
    handleClick(event: Event) {
        const target = this.to;

        // 安全检查：拒绝危险协议
        if (this.isDangerousProtocol(target)) {
            event.preventDefault();
            return;
        }

        // 判断是否为内部路由
        if (!this.isInternalLink(target)) {
            // 外部链接 - 不阻止默认行为，允许浏览器直接跳转
            return;
        }

        // 内部路由处理
        if (!this.router) {
            // 没有 router 实例，降级为普通 <a> 标签（不阻止默认行为）
            return;
        }

        // 阻止默认的链接跳转行为
        event.preventDefault();

        // 根据 replace 属性选择导航方式
        if (this.replace) {
            this.router.replace(target);
        } else {
            this.router.push(target);
        }
    }

    render() {
        return html`<a href="${this.to}" @click=${this.handleClick}><slot></slot></a>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-link": KylinLinkElement;
    }
}
