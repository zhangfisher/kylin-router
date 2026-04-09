import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { KylinRouterElementBase } from "../base";
import type { KylinRouter } from "@/router";

/**
 * 判断目标路径是否为内部路由
 * 内部路由：以 / 开头且不包含 ://
 * 外部链接：包含 ://（如 https://、http://）
 */
export function isInternalLink(path: string): boolean {
    if (!path) return false;
    return path.startsWith("/") && !path.includes("://");
}

/**
 * 检查路径是否为危险协议（javascript:、data:）
 * 按照 T-02-01 威胁缓解策略实现
 */
export function isDangerousProtocol(path: string): boolean {
    const trimmed = path.trim().toLowerCase();
    return trimmed.startsWith("javascript:") || trimmed.startsWith("data:");
}

@customElement("kylin-link")
export class KylinLinkElement extends KylinRouterElementBase {
    @property({ type: String })
    to = "";

    @property({ type: Boolean })
    replace = false;

    @property({ type: String })
    target = "";

    @property({ type: String })
    rel = "";

    /**
     * 计算最终的 rel 属性
     * - 如果用户已设置 rel，使用用户设置的值
     * - 如果 target="_blank"，自动添加 noopener noreferrer 防止安全漏洞
     */
    private _getComputedRel(): string {
        if (this.rel) {
            return this.rel;
        }
        if (this.target === "_blank") {
            return "noopener noreferrer";
        }
        return "";
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
        if (isDangerousProtocol(target)) {
            event.preventDefault();
            return;
        }

        // 判断是否为内部路由
        if (!isInternalLink(target)) {
            // 外部链接 - 不阻止默认行为，允许浏览器直接跳转
            return;
        }
        super.getRouter(() => {
            // 内部路由处理
            if (!this.router) {
                // 没有 router 实例，降级为普通 <a> 标签（不阻止默认行为）
                return;
            }
            // 根据 replace 属性选择导航方式
            if (this.replace) {
                this.router.replace(target);
            } else {
                this.router.push(target);
            }
        });

        // 阻止默认的链接跳转行为
        event.preventDefault();
    }

    render() {
        const computedRel = this._getComputedRel();
        return html`<a
            href="${this.to}"
            target="${this.target || nothing}"
            rel="${computedRel || nothing}"
            @click=${this.handleClick}
            ><slot></slot
        ></a>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-link": KylinLinkElement;
    }
}
