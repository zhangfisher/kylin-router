import type { KylinRouter } from "@/router";
import { LitElement, html } from "lit";
/**
 * Context 回调函数类型
 */
type ContextCallback<ValueType> = (value: ValueType, unsubscribe?: () => void) => void;

/**

/**
 * KylinRouter 组件基类
 *
 * 为所有继承此基类的组件提供自动消费 router context 的能力。
 * 组件初始化后会自动分发 "context-request" 事件，由 KylinRouter
 * 接收并提供 router 实例，保存在 this.router 属性中。
 *
 * 使用示例：
 * - 继承此类即可自动获取 router 实例
 * - 在 render() 或其他方法中通过 this.router 访问路由 
 */
export class KylinRouterElementBase extends LitElement {
    /**
     * Router 实例引用，由 KylinRouter 通过 context 提供
     */
    protected router?: KylinRouter;

    /**
     * 是否已经分发过 context-request 事件
     */
    private _contextRequested = false;

    override connectedCallback() {
        super.connectedCallback();
        // 在组件连接到 DOM 后请求 context
        if (!this._contextRequested) {
            this._requestRouterContext();
            this._contextRequested = true;
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * 分发 context-request 事件来请求 router 实例
     * 与 src/features/context.ts 的 onContextRequest 逻辑匹配
     */
    private _requestRouterContext() {
        // 使用 ContextRequestEvent 确保事件格式与 onContextRequest 期望的一致
        const contextRequestEvent = new CustomEvent("context-request", {
            context: "KylinRouter",
            contextTarget: this,
            callback: this._contextCallback,
        } as any);
        this.dispatchEvent(contextRequestEvent);
    }

    /**
     * Context 回调函数，当 KylinRouter 响应 context-request 时被调用
     *
     * @param router - KylinRouter 实例
     * @param unsubscribe - 取消订阅函数
     */
    private _contextCallback: ContextCallback<KylinRouter> = (router: KylinRouter) => {
        // 保存 router 实例
        this.router = router;
        // 触发组件更新
        this.requestUpdate();
    };
    /**
     *  重写 createRenderRoot，使组件不使用 Shadow DOM，以便样式和事件能够穿透到组件内部
     * 这对于路由组件来说很重要，因为它们需要与外部的路由状态和事件进行交互。
     * @returns
     */
    createRenderRoot() {
        return this;
    }

    render() {
        return html`<slot></slot>`;
    }
}
