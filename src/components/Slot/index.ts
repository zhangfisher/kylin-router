import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property, state } from "lit/decorators.js";
import { KylinRouterElementBase } from "../Base";
import { styles } from "./styles";
import type { RouteSignalReuslt } from "./types";

/**
 * KylinSlot - 路由槽位组件
 *
 * 用于在 kylin-outlet 中渲染单个路由视图
 *
 * @module components/Slot
 */
@customElement("kylin-slot")
export class KylinSlot extends KylinRouterElementBase {
    static styles = styles;

    /**
     * 当前 URL，用于参数变化检测
     */
    @property({ type: String, reflect: true })
    url?: string;

    /**
     * 是否显示 Loading 状态
     */
    @property({ type: Boolean, reflect: true })
    loading = false;

    private _active = false;

    /**
     * 是否为活动状态
     * 当设置为 true 时，自动将同一父元素下的其他 slot 的 active 设为 false
     */
    @property({ type: Boolean, reflect: true })
    get active(): boolean {
        return this._active;
    }
    set active(value: boolean) {
        if (this._active === value) return;

        this._active = value;

        // 当设置为 true 时，将同一父元素下的其他 slot 的 active 设为 false
        if (value && this.parentElement) {
            const siblings = Array.from(
                this.parentElement.querySelectorAll<KylinSlot>(":scope > kylin-slot"),
            );
            siblings.forEach((sibling) => {
                if (sibling !== this && sibling.active) {
                    sibling.active = false;
                }
            });
        }

        this.requestUpdate("active", !value);
    }

    /**
     * 存储视图内容（内部状态）
     */
    @state()
    private _viewContent?: string;

    /**
     * 存储错误元素（内部状态）
     */
    @state()
    private _errorElement?: HTMLElement;

    /**
     * Alpine x-data 值
     */
    @state()
    private _xDataValue: string = "{}";

    /**
     * 解析视图内容到槽位中
     *
     * @param view - 视图内容（HTML字符串或HTMLElement）
     * @param data - 路由数据（RouteSignalReuslt类型，可选）
     * @param cssVars - CSS变量列表（预留参数）
     * @returns this - 返回 slot 元素本身，用于传递给 afterRender 钩子
     */
    resolve(view: string | HTMLElement, data?: RouteSignalReuslt, _cssVars?: string[]): KylinSlot {
        // 设置 Alpine x-data 属性（直接在元素上设置，不会破坏 Lit 渲染）
        if (data?.hash) {
            this.setAttribute("x-data", data.hash);
        } else {
            this.setAttribute("x-data", "{}");
        }

        // 使用响应式状态存储内容
        if (typeof view === "string") {
            this._viewContent = this._interpolateTemplate(view);
        } else {
            // 将 HTMLElement 转换为 HTML 字符串
            this._viewContent = view.outerHTML;
        }

        // 清除错误状态
        this._errorElement = undefined;

        // 触发重新渲染
        this.requestUpdate();

        return this;
    }

    /**
     * 拒绝视图加载，显示错误页面
     *
     * @param error - 错误对象
     * @param errorElement - 错误页面元素
     */
    reject(_error: any, errorElement: HTMLElement): void {
        // 存储错误元素
        this._errorElement = errorElement;
        this._viewContent = undefined;

        // 触发重新渲染
        this.requestUpdate();
    }

    /**
     * 完成渲染，移除Loading状态
     */
    finally(): void {
        this.loading = false;
    }

    /**
     * 销毁槽位，从DOM中移除
     */
    abort(): void {
        this.remove();
    }

    /**
     * 将模板中的 {{ }} 语法转换为 x-text 指令
     *
     * @param text - 模板文本
     * @returns 转换后的文本
     */
    private _interpolateTemplate(text: string): string {
        // 将 {{ }} 语法转换为 x-text 指令
        return text.replace(/\{\{\s*(.*?)\s*\}\}/g, (_match, expression) => {
            return `<span x-text="${expression}"></span>`;
        });
    }

    render() {
        // 使用 Light DOM，根据状态渲染不同内容
        if (this.loading) {
            return html`<kylin-loading style="z-index: 9"></kylin-loading>`;
        }

        // 渲染错误元素
        if (this._errorElement) {
            return html`${this._errorElement}`;
        }

        // 渲染视图内容
        if (this._viewContent) {
            return html`${unsafeHTML(this._viewContent)}`;
        }

        return html``;
    }

    createRenderRoot() {
        return this; // 使用 Light DOM
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-slot": KylinSlot;
    }
}
