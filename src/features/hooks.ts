/**
 * 处理路由生命周期钩子相关的功能
 * 支持三种钩子类型：beforeEach、renderEach、afterEach
 * 提供 FIFO 执行顺序、异步支持和错误处理
 */

import type { KylinRouter } from "@/router";
import type { HookFunction, HookType, RouteItem } from "@/types";

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

    /**
     * 执行指定类型的所有钩子函数
     * @param type - 钩子类型
     * @param to - 目标路由
     * @param from - 来源路由
     * @param router - 路由器实例
     * @returns Promise<boolean | string> - 返回 false 表示取消导航，返回字符串表示重定向路径，返回 true 表示继续
     */
    protected async executeHooks(
        this: KylinRouter,
        type: HookType,
        to: RouteItem,
        from: RouteItem,
        router: any
    ): Promise<boolean | string> {
        const hooks = this.hooks[type];
        if (hooks.length === 0) return true;

        for (const hook of hooks) {
            const result = await this.runHook(hook, to, from, router);
            if (result === false) return false;
            if (typeof result === 'string') return result; // 重定向路径
        }
        return true;
    }

    /**
     * 运行单个钩子函数
     * @param hook - 钩子函数
     * @param to - 目标路由
     * @param from - 来源路由
     * @param router - 路由器实例
     * @returns Promise<boolean | string> - 钩子执行结果
     */
    protected async runHook(
        this: KylinRouter,
        hook: HookFunction,
        to: RouteItem,
        from: RouteItem,
        router: any
    ): Promise<boolean | string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Hook timeout after 30000ms`));
            }, 30000);

            const next = (result?: boolean | string) => {
                clearTimeout(timeout);
                resolve(result !== undefined ? result : true);
            };

            try {
                const result = hook(to, from, next, router);
                if (result instanceof Promise) {
                    result.then(() => clearTimeout(timeout)).catch(err => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
}
