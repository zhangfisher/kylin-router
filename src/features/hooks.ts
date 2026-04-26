/**
 * 处理路由生命周期钩子相关的功能
 * 支持三种钩子类型：beforeEach、renderEach、afterEach
 * 提供 FIFO 执行顺序、异步支持和错误处理
 */

import type { KylinRouter } from "@/router";
import type {
    KylinRouterHooks,
    KylinMatchedRouteItem,
    KylinRouterHookType,
    KylinRouterOptions,
    BeforeRouteHook,
    AfterRouteHook,
} from "@/types";
import type { ArrayItem } from "@/types/utils";

export class HookManager {
    /**
     * 钩子存储结构
     * 按照 HookType 分组存储钩子函数，保持注册顺序（FIFO）
     * 公开访问，允许开发者直接注册钩子
     */
    public hooks: KylinRouterHooks;

    /**
     * 路由器实例
     */
    private router: KylinRouter;
    options: Required<Exclude<KylinRouterOptions["hookOptions"], undefined>>;

    /**
     * 构造函数
     * @param router - KylinRouter 实例
     */
    constructor(router: KylinRouter) {
        this.router = router;
        this.hooks = {
            beforeRoute: [],
            afterRoute: [],
            beforeRender: [],
            afterRender: [],
        } as KylinRouterHooks;

        this.options = Object.assign(
            {
                timeout: 3000, // 执行Hook的超时时间
            },
            router.options.hookOptions,
        ) as Required<Exclude<KylinRouterOptions["hookOptions"], undefined>>;
        this._addGlobalHooks();
    }

    /**
     * 将全局钩子函数添加到路由器实例中
     * 从路由器配置中提取 beforeRoute、afterRoute、beforeRender、afterRender 四种类型的全局钩子
     * 支持单个函数或函数数组两种形式，统一添加到内部钩子集合中
     */
    private _addGlobalHooks() {
        const hookTypes = ["beforeRoute", "afterRoute", "beforeRender", "afterRender"];
        for (const type of hookTypes) {
            const hooks = (this.router.options as any)[type];
            if (hooks) {
                if (Array.isArray(hooks)) {
                    (this.hooks as any)[type].push(...hooks);
                } else if (typeof hooks === "function") {
                    (this.hooks as any)[type].push(hooks);
                }
            }
        }
    }
    /**
     * 添加钩子函数
     * @param type - 钩子类型
     * @param hook - 钩子函数
     */
    add<T extends keyof KylinRouterHooks>(type: T, hook: ArrayItem<KylinRouterHooks[T]>): void {
        this.hooks[type].push(hook as any);
    }
    /**
     * 移除指定的钩子函数
     * @param type - 钩子类型
     * @param hook - 要移除的钩子函数
     */
    remove<T extends keyof KylinRouterHooks>(type: T, hook: ArrayItem<KylinRouterHooks[T]>): void {
        const index = this.hooks[type].indexOf(hook as any);
        if (index > -1) {
            this.hooks[type].splice(index, 1);
        }
    }

    /**
     * 清空钩子
     * @param type - 可选，指定要清空的钩子类型。如果不指定，清空所有钩子
     */
    clear<T extends keyof KylinRouterHooks>(type?: T): void {
        if (type) {
            this.hooks[type] = [];
        } else {
            (Object.keys(this.hooks) as any[]).forEach((key) => {
                (this.hooks as any)[key] = [];
            });
        }
    }

    async runBeforeRoute(
        to: KylinMatchedRouteItem[],
        from: KylinMatchedRouteItem[],
        args: any[] = [],
    ) {
        // 先执行全局路由守护
        const hooks = [
            ...this.hooks["beforeRoute"],
            ...to.map((r) => r.route.beforeRoute || []),
        ] as BeforeRouteHook[];
        return this._runHooks<boolean | string>(hooks, [to, from, ...args]);
    }
    /**
     * 并发执行
     * @param to
     * @param from
     * @returns
     */
    async runAfterRoute(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[], args: any[]) {
        const hooks = [
            ...this.hooks["afterRoute"],
            ...to.map((r) => r.route.afterRoute || []),
        ] as AfterRouteHook[];
        return this._runHooks<void>(hooks, [to, from, ...args], {
            mode: "parallel",
        });
    }
    async runBeforeRender(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[], args: any[]) {
        // 先执行全局路由守护
        const hooks = [
            ...this.hooks["beforeRoute"],
            ...to.map((r) => r.route.beforeRoute || []),
        ] as BeforeRouteHook[];
        return this._runHooks<boolean | string>(hooks, [to, from, ...args]);
    }
    async runAfterRender(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[], args: any[]) {
        // 先执行全局路由守护
        const hooks = [
            ...this.hooks["beforeRoute"],
            ...to.map((r) => r.route.beforeRoute || []),
        ] as BeforeRouteHook[];
        return this._runHooks<boolean | string>(hooks, [to, from, ...args]);
    }
    /**
     * 串行运行hooks函数
     * @param hook
     * @param args
     * @param {object} options
     *  - mode: 运行模式，串行执行和并行执行
     *  - onError: 当执行出错的中断后续执行
     */
    private async _runHooks<R = any>(
        hooks: Function[],
        args: any[],
        options?: { mode?: "serial" | "parallel"; ignoreErrors?: boolean },
    ): Promise<R> {
        const { mode, ignoreErrors } = Object.assign(
            {
                mode: "serial",
                ignoreErrors: false,
            },
            options,
        );
        if (mode === "serial") {
            for (const hook of hooks) {
                try {
                    const result = await this._runHook.apply(this.router, [
                        hook as any,
                        args as any,
                    ]);
                    if (result === false) return false as R;
                    if (typeof result === "string") return result as R;
                } catch (e: any) {
                    if (ignoreErrors) continue;
                    this.router.logger.error(`Error executing hook: ${e.message}`);
                    throw e;
                }
            } // 重定向路径
        } else {
            return (await Promise.allSettled(
                // oxlint-disable-next-line typescript/await-thenable
                hooks.map((hook) => {
                    return this._runHook.apply(this.router, [hook as any, args as any]);
                }),
            )) as R;
        }
        return true as R;
    }

    /**
     * 运行单个钩子函数
     * @returns Promise<boolean | string> - 钩子执行结果
     */
    private _runHook<T extends KylinRouterHookType>(
        hook: ArrayItem<KylinRouterHooks[T]>,
        args: Parameters<ArrayItem<KylinRouterHooks[T]>>,
    ): ReturnType<ArrayItem<KylinRouterHooks[T]>> {
        return new Promise((resolve, reject) => {
            const timeout =
                this.options.timeout > 0
                    ? setTimeout(() => {
                          reject(new Error(`Hook timeout after ${this.options.timeout}ms`));
                      }, this.options.timeout)
                    : 0;
            Promise.resolve((hook as any).apply(this.router, args))
                .then((result) => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch((err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
        }) as ReturnType<ArrayItem<KylinRouterHooks[T]>>;
    }
}
