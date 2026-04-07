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

    /**
     * 添加钩子函数
     * @param type - 钩子类型
     * @param hook - 钩子函数
     */
    protected addHook(this: KylinRouter, type: HookType, hook: HookFunction): void {
        this.hooks[type].push(hook);
    }

    /**
     * 移除指定的钩子函数
     * @param type - 钩子类型
     * @param hook - 要移除的钩子函数
     */
    protected removeHook(this: KylinRouter, type: HookType, hook: HookFunction): void {
        const index = this.hooks[type].indexOf(hook);
        if (index > -1) {
            this.hooks[type].splice(index, 1);
        }
    }

    /**
     * 清空钩子
     * @param type - 可选，指定要清空的钩子类型。如果不指定，清空所有钩子
     */
    protected clearHooks(this: KylinRouter, type?: HookType): void {
        if (type) {
            this.hooks[type] = [];
        } else {
            (Object.keys(this.hooks) as HookType[]).forEach(key => {
                this.hooks[key] = [];
            });
        }
    }
}
