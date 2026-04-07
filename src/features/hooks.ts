/**
 * 处理路由生命周期钩子相关的功能
 * 支持三种钩子类型：beforeEach、renderEach、afterEach
 * 提供 FIFO 执行顺序、异步支持和错误处理
 */

import type { KylinRouter } from "@/router";
import type { HookFunction, HookType } from "@/types";

export class Hooks {
    /**
     * 钩子存储结构
     * 按照 HookType 分组存储钩子函数，保持注册顺序（FIFO）
     */
    protected hooks: Record<HookType, HookFunction[]> = {
        beforeEach: [],
        renderEach: [],
        afterEach: []
    };

    /**
     * 初始化钩子系统
     * 在路由器构造时调用
     */
    protected initHooks(this: KylinRouter): void {
        // 钩子存储已在属性声明时初始化
        // 此方法保留用于未来扩展
    }
}
