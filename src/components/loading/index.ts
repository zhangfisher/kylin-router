import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { TemplateResult } from "lit";

@customElement("kylin-loading")
export class KylinLoadingElement extends LitElement {
    createRenderRoot() {
        return this;
    }

    @property({ type: String, reflect: true })
    path?: string;

    /**
     * 自定义加载模板（D-10）
     * 支持 lit 模板或 HTML 字符串
     */
    @property({ type: Object })
    template?: TemplateResult | string;

    /**
     * 是否在嵌套 outlet 中显示（D-11）
     * 默认为 false，只在最外层 outlet 显示加载指示器
     */
    @property({ type: Boolean, reflect: true })
    showInNested: boolean = false;

    connectedCallback() {
        super.connectedCallback();
        // 检查是否应该显示（D-11）
        if (!this.shouldShow()) {
            this.style.display = "none";
        } else {
            this.style.display = "";
        }
    }

    /**
     * 检查是否应该显示加载指示器（D-11）
     * 嵌套 outlet 中默认不显示，避免多个加载指示器造成混乱
     */
    private shouldShow(): boolean {
        // 检查是否在嵌套 outlet 中
        const parentOutlet = this.closest("kylin-outlet");
        if (parentOutlet && parentOutlet !== this.parentElement) {
            return this.showInNested; // 默认不显示
        }
        return true;
    }

    render() {
        // 使用自定义模板（D-10）
        if (this.template) {
            if (typeof this.template === "string") {
                // HTML 字符串模板
                return html`${this.template}`;
            } else {
                // lit 模板
                return this.template;
            }
        }

        // 使用默认加载指示器
        return this.renderDefault();
    }

    /**
     * 渲染默认加载指示器
     */
    private renderDefault() {
        return html`
            <style>
                .kylin-loading-spinner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
                        Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .text {
                    margin-top: 12px;
                    color: #666;
                    font-size: 14px;
                }

                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }
            </style>
            <div class="kylin-loading-spinner">
                <div class="spinner"></div>
                <div class="text">Loading...</div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-loading": KylinLoadingElement;
    }
}
