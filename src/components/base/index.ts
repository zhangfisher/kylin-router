import type { KylinRouter } from "@/router";
import { triggerEvent } from "@/utils/triggerEvent";
import { LitElement, html } from "lit";
/**
 * Context 回调函数类型
 */
type ContextCallback<ValueType> = (value: ValueType, unsubscribe?: () => void) => void;

/**

/**
 * KylinRouter 组件基类
 *
 * - 为所有继承此基类的组件提供获取router实例
 * - 使用Light DOM而不是Shadow DOM,以便样式和事件能够穿透到组件内部
 *
 * 使用示例：
 * - 继承此类即可自动获取 router 实例
 * - 在 render() 或其他方法中通过 this.router 访问路由 
 */
export class KylinRouterElementBase extends LitElement {
    /**
     * Router 实例引用，由 KylinRouter 通过 context 提供
     */
    router?: KylinRouter;

    /**
     * 是否已经分发过 context-request 事件
     */
    private _contextRequested = false;

    override connectedCallback() {
        super.connectedCallback();
        // 在组件连接到 DOM 后请求 context
        if (!this._contextRequested) {
            // 优先尝试同步获取 router 实例
            const syncRouter = this._getRouterSync();
            if (syncRouter) {
                this.router = syncRouter;
                this.requestUpdate();
            } else {
                // 同步获取失败，使用异步方式
                this.getRouter();
            }
            this._contextRequested = true;
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * 同步获取 router 实例
     * 向上遍历 DOM 树，按优先级查找：
     * 1. 具有 data-kylin-router 属性的元素（router 宿主元素）
     * 2. 具有 router 实例的 KylinRouterElementBase 祖先元素
     *
     * @returns router 实例或 undefined
     */
    private _getRouterSync(): KylinRouter | undefined {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let currentElement: Element | null = this;
        const walk: string[] = [];

        while (currentElement) {
            // 记录遍历路径用于调试
            walk.push(
                currentElement instanceof HTMLElement
                    ? `${currentElement.tagName.toLowerCase()}${currentElement.id ? "#" + currentElement.id : ""}${currentElement.className ? "." + currentElement.className : ""}`
                    : currentElement.tagName,
            );

            // 优先查找 router 宿主元素（data-kylin-router 属性）
            if (
                currentElement instanceof HTMLElement &&
                currentElement.hasAttribute("data-kylin-router")
            ) {
                console.log("[KylinRouterElementBase] 找到 router 宿主元素:", {
                    element: currentElement,
                    hasRouter: !!(currentElement as any).router,
                    walk,
                });
                return (currentElement as any).router;
            }
            // 检查是否是 KylinRouterElementBase 且具有有效的 router 实例
            if (currentElement instanceof KylinRouterElementBase && currentElement.router) {
                console.log("[KylinRouterElementBase] 找到父级 router 实例:", {
                    element: currentElement,
                    walk,
                });
                return currentElement.router;
            }
            currentElement = currentElement.parentElement;
        }
        return undefined;
    }

    /**
     * 分发 context-request 事件来请求 router 实例
     * 与 src/features/context.ts 的 onContextRequest 逻辑匹配
     */
    protected getRouter(callback: ContextCallback<KylinRouter> = this._contextCallback) {
        if (this.router) {
            // 已经有 router 实例，直接调用回调
            callback(this.router);
            return;
        }
        // 使用 ContextRequestEvent 确保事件格式与 onContextRequest 期望的一致
        triggerEvent(this, "context-request", {
            context: "KylinRouter",
            contextTarget: this,
            callback: (router: KylinRouter) => {
                this.router = router;
                callback(router);
            },
        });
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
    render() {
        return html`<slot></slot>`;
    }
}
