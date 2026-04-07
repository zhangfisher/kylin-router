/**
 * History 管理功能
 *
 * 负责 history 对象的创建和模式切换：
 * - 根据 mode 配置创建 BrowserHistory 或 HashHistory
 * - 提供 attach/detach 生命周期管理
 * - 封装 history.listen 监听逻辑
 */

import { createBrowserHistory, createHashHistory } from "history";
import type { BrowserHistory, HashHistory, Update } from "history";
import type { KylinRouter } from "@/router";

type HistoryInstance = BrowserHistory | HashHistory;

export class History {
    /** history 实例，由 createHistory 初始化 */
    history!: HistoryInstance;

    /** 路由模式 */
    private _mode: "hash" | "history" = "history";

    /**
     * 根据配置创建对应的 History 实例
     *
     * history 库 v5 的 createBrowserHistory/createHashHistory
 * 均不支持 basename 参数，需要自行处理基础路径
     */
    protected createHistory(this: KylinRouter, mode?: "hash" | "history"): void {
        this._mode = mode || "history";

        if (this._mode === "hash") {
            this.history = createHashHistory();
        } else {
            this.history = createBrowserHistory();
        }
    }

    /**
     * 获取当前路由模式
     */
    getMode(this: KylinRouter): "hash" | "history" {
        return this._mode;
    }

    /**
     * 附加 history 监听器
     */
    protected attachHistoryListener(this: KylinRouter): void {
        this._cleanups.push(this.history.listen(this.onRouteUpdate.bind(this)));
    }
}
