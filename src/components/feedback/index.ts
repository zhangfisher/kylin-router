// @ts-ignore
import { parse as parseJson } from "really-relaxed-json";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from "./styles";

/**
 * 内置错误类型
 */
type ErrorType = "info" | "warn" | "error" | "success";

/**
 * 动作配置类型
 */
interface ActionConfig {
    /** 动作名称/标识 */
    name: string;
    /** 按钮标题 */
    title?: string;
    /** 按钮提示文本 */
    tips?: string;
    /** 图标（SVG字符串或图片URL） */
    icon?: string;
    /** 是否为主要按钮 */
    primary?: boolean;
}

/**
 * kylin:action 事件详情类型
 */
interface ActionEventDetail extends ActionConfig {}

/**
 * 内置图标 SVG
 */
const BUILTIN_ICONS: Record<ErrorType, string> = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    warn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
};

/**
 * 默认动作图标
 */
const ACTION_ICONS = {
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    retry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
    back: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
};

/**
 * 反馈页面组件
 *
 * 用于显示各种类型的消息、错误和状态页面。
 * 支持自定义图标、内置类型、动作按钮等功能。
 *
 * @example
 * ```html
 * <kylin-feedback
 *   type="error"
 *   message="加载失败"
 *   description="无法获取资源，请稍后重试"
 *   retryable
 *   backable
 * ></kylin-feedback>
 * ```
 */
@customElement("kylin-feedback")
export class KylinFeedbackElement extends LitElement {
    static styles = styles;

    /**
     * 主要消息/标题
     */
    @property({ type: String })
    message?: string;

    /**
     * 详细描述文本
     */
    @property({ type: String })
    description?: string;

    /**
     * 自定义图标（图片URL或SVG字符串）
     */
    @property({ type: String })
    icon?: string;

    /**
     * 内置错误类型，会使用对应的默认图标和颜色
     */
    @property({ type: String })
    type?: ErrorType;

    /**
     * 自定义动作按钮配置（JSON字符串或已解析的对象）
     */
    @property({ type: Object })
    actions?: ActionConfig[] | string;

    /**
     * 是否显示关闭按钮
     */
    @property({ type: Boolean })
    closeable = false;

    /**
     * 是否显示重试按钮
     */
    @property({ type: Boolean })
    retryable = false;

    /**
     * 是否显示返回按钮
     */
    @property({ type: Boolean })
    backable = false;

    /**
     * 是否取消充满父容器，使用内联模式
     */
    @property({ type: Boolean })
    inline = false;

    /**
     * 解析后的动作列表
     */
    private get _parsedActions(): ActionConfig[] {
        if (!this.actions) return [];

        let parsed: ActionConfig[];
        if (typeof this.actions === "string") {
            try {
                parsed = parseJson(this.actions) as ActionConfig[];
            } catch {
                console.warn("[kylin-feedback] Failed to parse actions:", this.actions);
                return [];
            }
        } else {
            parsed = this.actions;
        }

        // 解析每个 action 的 icon 字段（可能是 JSON 字符串）
        return parsed.map((action) => {
            if (action.icon && typeof action.icon === "string") {
                try {
                    const parsedIcon = parseJson(action.icon);
                    return { ...action, icon: parsedIcon };
                } catch {
                    // 保持原样
                    return action;
                }
            }
            return action;
        });
    }

    /**
     * 获取要显示的图标 HTML
     */
    private _renderIcon(): TemplateResult {
        // 优先使用自定义 icon
        if (this.icon) {
            // 判断是否为 SVG（以 <svg 开头）
            if (this.icon.trim().startsWith("<svg")) {
                return html`<div class="icon">${this.icon}</div>`;
            }
            // 作为图片 URL 处理
            return html`<img class="icon" src="${this.icon}" alt="" />`;
        }

        // 使用内置类型图标
        if (this.type && BUILTIN_ICONS[this.type]) {
            return html`<div class="icon ${this.type}">${BUILTIN_ICONS[this.type]}</div>`;
        }

        // 默认使用 error 图标
        return html`<div class="icon error">${BUILTIN_ICONS.error}</div>`;
    }

    /**
     * 获取所有要显示的动作按钮
     */
    private get _allActions(): ActionConfig[] {
        const result: ActionConfig[] = [...this._parsedActions];

        if (this.backable) {
            result.unshift({
                name: "back",
                title: "返回",
                icon: ACTION_ICONS.back,
            });
        }

        if (this.retryable) {
            result.unshift({
                name: "retry",
                title: "重试",
                icon: ACTION_ICONS.retry,
                primary: true,
            });
        }

        if (this.closeable) {
            result.push({
                name: "close",
                title: "关闭",
                icon: ACTION_ICONS.close,
            });
        }

        return result;
    }

    /**
     * 处理动作按钮点击
     */
    private _handleAction(action: ActionConfig, event: Event): void {
        // 阻止默认行为
        event.preventDefault();
        event.stopPropagation();

        // 分发自定义事件，冒泡并允许穿越 Web Component 边界
        const customEvent = new CustomEvent<ActionEventDetail>("kylin:action", {
            detail: action,
            bubbles: true,
            composed: true, // 允许穿越 Shadow DOM 边界
        });

        this.dispatchEvent(customEvent);
    }

    /**
     * 渲染单个动作按钮
     */
    private _renderActionButton(action: ActionConfig): TemplateResult {
        const title = action.title || action.name;
        const iconHtml = action.icon ? html`<span class="action-icon">${action.icon}</span>` : "";

        return html`
            <button
                class="action-button ${action.primary ? "primary" : ""}"
                title="${action.tips || title}"
                @click="${(e: Event) => this._handleAction(action, e)}"
            >
                ${iconHtml}${title}
            </button>
        `;
    }

    override render(): TemplateResult {
        const iconHtml = this._renderIcon();
        const messageHtml = this.message ? html`<div class="message">${this.message}</div>` : "";
        const descriptionHtml = this.description
            ? html`<div class="description">${this.description}</div>`
            : "";

        const actions = this._allActions;
        const actionsHtml =
            actions.length > 0
                ? html`
                      <div class="actions">
                          ${actions.map((action) => this._renderActionButton(action))}
                      </div>
                  `
                : "";

        return html`
            <div class="container">${iconHtml}${messageHtml}${descriptionHtml}${actionsHtml}</div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "kylin-feedback": KylinFeedbackElement;
    }

    interface HTMLElementEventMap {
        "kylin:action": CustomEvent<ActionEventDetail>;
    }
}
