import { afterEach } from "bun:test";
/**
 * 处理路由生命周期钩子相关的功能
 * 支持三种钩子类型：beforeEach、renderEach、afterEach
 * 提供 FIFO 执行顺序、异步支持和错误处理
 */

import type { KylinRouter } from "@/router";
import type {
    IRouteHook,
    KylinRouteItem,
    KylinRouteDataSource,
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
    /**
     * 执行全局路由前置钩子
     * @param from
     * @param to
     */
    async runBeforeHooks(
        type: KylinRouterHookType,
        from: KylinMatchedRouteItem[],
        to: KylinMatchedRouteItem[],
    ) {}
    /**
     * 执行路由钩子
     * @param from
     * @param to
     */
    async runBeforeRouteHooks(from: KylinMatchedRouteItem[], to: KylinMatchedRouteItem[]) {}

    /**
     * 执行指定类型的所有钩子函数
     * @param type - 钩子类型
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<boolean | string> - 返回 false 表示取消导航，返回字符串表示重定向路径，返回 true 表示继续
     */
    async executeHooks<T extends keyof KylinRouterHooks>(
        type: T,
        from: KylinMatchedRouteItem[],
        to: KylinMatchedRouteItem[],
    ): Promise<boolean | string> {
        const hooks = this.hooks[type];
        if (hooks.length === 0) return true;

        // afterEach 钩子使用特殊的执行逻辑，不抛出错误
        if (type === "afterRoute") {
            return this.executeAfterEachHooks(hooks, to, from);
        }

        for (const hook of hooks) {
            const result = await this.runHook(hooks, from, to);
            if (result === false) return false;
            if (typeof result === "string") return result; // 重定向路径
        }
        return true;
    }

    /**
     * 执行 afterEach 钩子，不会抛出错误
     * @param hooks - afterEach 钩子数组
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<boolean> - 始终返回 true，afterEach 不影响导航流程
     */
    async executeAfterEachHooks(
        hooks: IRouteHook[],
        to: KylinMatchedRouteItem[],
        from: KylinMatchedRouteItem[],
    ): Promise<boolean> {
        for (const hook of hooks) {
            try {
                await this.runAfterEachHook(hook, to, from);
            } catch (error) {
                // afterEach 钩子出错不影响导航流程，只记录错误
                console.error("[Router] afterEach hook error:", error);
            }
        }
        return true;
    }

    /**
     * 运行单个 afterEach 钩子函数
     * @param hook - afterEach 钩子函数
     * @param to - 目标路由
     * @param from - 来源路由
     */
    async runAfterEachHook(
        hook: IRouteHook,
        to: KylinMatchedRouteItem[],
        from: KylinMatchedRouteItem[],
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error("[Router] afterEach hook timeout after 30000ms");
                resolve(); // 超时不阻塞
            }, 30000);

            try {
                const result = hook(to, from, () => {}, this.router); // afterEach 不需要 next 回调

                if (result instanceof Promise) {
                    result
                        .then(() => {
                            clearTimeout(timeout);
                            resolve();
                        })
                        .catch((error) => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    async runBeforeRoute(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[] | undefined) {
        // 先执行全局路由守护
        const hooks = [
            ...this.hooks["beforeRoute"],
            ...to.map((r) => r.route.beforeRoute || []),
        ] as BeforeRouteHook[];
        return this._runHooks<boolean | string>(hooks, [to, from]);
    }
    /**
     * 并发执行
     * @param to
     * @param from
     * @returns
     */
    async runAfterRoute(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[]) {
        const hooks = [
            ...this.hooks["afterRoute"],
            ...to.map((r) => r.route.afterRoute || []),
        ] as AfterRouteHook[];
        return this._runHooks<void>(hooks, [to, from], {
            mode: "parallel",
        });
    }
    async runBeforeRender(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[]) {
        // 先执行全局路由守护
        const hooks = [
            ...this.hooks["beforeRoute"],
            ...to.map((r) => r.route.beforeRoute || []),
        ] as BeforeRouteHook[];
        return this._runHooks<boolean | string>(hooks, [to, from]);
    }
    async runAfterRender(to: KylinMatchedRouteItem[], from: KylinMatchedRouteItem[]) {
        // 先执行全局路由守护
        const hooks = [
            ...this.hooks["beforeRoute"],
            ...to.map((r) => r.route.beforeRoute || []),
        ] as BeforeRouteHook[];
        return this._runHooks<boolean | string>(hooks, [to, from]);
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
        options?: { mode?: "serial" | "parallel" },
    ): Promise<R> {
        const { mode } = Object.assign(
            {
                mode: "serial",
            },
            options,
        );
        args.push(this.router);
        if (mode === "serial") {
            for (const hook of hooks) {
                const result = await this._runHook.apply(this.router, [hook as any, args as any]);
                if (result === false) return false as R;
                if (typeof result === "string") return result as R;
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
            args.push(this.router);
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

    /**
     * 执行路由级守卫（父优先顺序）
     * @param matchedRoutes - 匹配的路由链（从外到内排序）
     * @param to - 目标路由
     * @param from - 来源路由
     * @param guardType - 守卫类型
     * @returns Promise<boolean | string> - 返回 false 表示取消导航，返回字符串表示重定向路径，返回 true 表示继续
     */
    async executeRouteGuards(
        matchedRoutes: any[],
        to: KylinRouteItem,
        from: KylinRouteItem,
        guardType: "beforeEnter" | "afterLeave",
    ): Promise<boolean | string> {
        // 从外到内执行父 → 子
        for (const matched of matchedRoutes) {
            const route = matched.route;
            const guard = guardType === "beforeEnter" ? route.beforeEnter : route.afterLeave;

            if (guard) {
                try {
                    const result = await this.runRouteGuard(route, guard, to, from);
                    // 处理守卫返回 undefined 的情况（视为继续导航）
                    if (result === undefined || result === true) {
                        continue; // 继续执行下一个守卫
                    }
                    if (result === false) return false;
                    if (typeof result === "string") return result;
                } catch (error) {
                    console.error(`[Router] Route ${guardType} guard error:`, {
                        route: route.name,
                        guardType,
                        error,
                        to: to.path,
                        from: from.path,
                    });
                    return false; // 守卫失败，取消导航
                }
            }
        }
        return true;
    }

    /**
     * 运行单个路由守卫函数
     * @param route - 路由配置
     * @param guard - 守卫函数
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<boolean | string> - 守卫执行结果
     */
    async runRouteGuard(
        route: KylinRouteItem,
        guard: (to: KylinRouteItem, from: KylinRouteItem) => any,
        to: KylinRouteItem,
        from: KylinRouteItem,
    ): Promise<boolean | string> {
        return new Promise<boolean | string>((resolve) => {
            const timeout = setTimeout(() => {
                console.error(`[Router] Route guard timeout after 30000ms in ${route.name}`);
                resolve(false); // 超时视为守卫失败
            }, 30000);

            try {
                const result = guard(to, from);

                // 处理同步返回值
                if (result === undefined || result === true) {
                    clearTimeout(timeout);
                    resolve(true);
                } else if (result === false) {
                    clearTimeout(timeout);
                    resolve(false);
                } else if (typeof result === "string") {
                    clearTimeout(timeout);
                    resolve(result);
                } else if (result instanceof Promise) {
                    // 处理异步返回值
                    result
                        .then((promiseResult: boolean | string) => {
                            clearTimeout(timeout);
                            if (promiseResult === undefined || promiseResult === true) {
                                resolve(true);
                            } else if (promiseResult === false) {
                                resolve(false);
                            } else {
                                resolve(promiseResult);
                            }
                        })
                        .catch((error: unknown) => {
                            clearTimeout(timeout);
                            console.error(
                                `[Router] Route guard execution error in ${route.name}:`,
                                error,
                            );
                            resolve(false);
                        });
                } else {
                    clearTimeout(timeout);
                    resolve(true);
                }
            } catch (error) {
                clearTimeout(timeout);
                console.error(`[Router] Route guard sync error in ${route.name}:`, error);
                resolve(false);
            }
        });
    }

    /**
     * 获取排序后的匹配路由（从外到内，父优先）
     * @param matchedRoutes - 匹配的路由链
     * @returns MatchedRoute[] - 从外到内排序的路由链
     */
    getOrderedMatchedRoutes(matchedRoutes: any[]): any[] {
        // matchRoute 现在已经返回从外到内的顺序（父 → 子）
        // 所以不需要反转，直接返回
        return matchedRoutes;
    }

    /**
     * 执行 renderEach 钩子
     * 遵循 D-18: 在组件加载后执行
     * 遵循 D-19: 失败时继续渲染
     * 不再负责数据加载和合并，数据加载由 DataLoader 统一处理
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<void>
     */
    async executeRenderEach(to: KylinRouteItem, from: KylinRouteItem): Promise<void> {
        // 收集全局 renderEach 钩子
        const globalHooks = this.hooks[HookTypeValues.RENDER_EACH as HookType] as RenderEachHook[];
        // 收集路由级 renderEach 钩子
        const routeHooks = to.renderEach
            ? Array.isArray(to.renderEach)
                ? to.renderEach
                : [to.renderEach]
            : [];

        const allHooks = [...globalHooks, ...routeHooks];
        if (allHooks.length === 0) return;

        let errorCount = 0;

        // 串行执行所有 renderEach 钩子
        for (const hook of allHooks) {
            try {
                await this.runRenderEachHook(hook, to, from);
            } catch (error) {
                errorCount++;
                console.error("[Router] renderEach hook failed:", {
                    route: to.name,
                    error,
                });
                // 继续执行下一个钩子（D-19）
            }
        }

        // 记录错误统计
        if (errorCount > 0) {
            console.warn(`[Router] ${errorCount} renderEach hooks failed, continuing navigation`);
        }
    }

    /**
     * 运行单个 renderEach 钩子函数
     * @param hook - renderEach 钩子函数
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<void>
     */
    async runRenderEachHook(
        hook: IRouteHook,
        to: KylinRouteItem,
        from: KylinRouteItem,
    ): Promise<void> {
        return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                console.error("[Router] renderEach hook timeout after 30000ms");
                resolve(); // 超时不阻塞导航
            }, 30000);

            const next = (_data?: KylinRouteDataSource) => {
                clearTimeout(timeout);
                // 不再处理数据，只完成钩子执行
                resolve();
            };

            try {
                const result = hook(to, from, next, this.router);

                // 支持直接返回数据（但不再使用）
                if (result instanceof Promise) {
                    result
                        .then(() => {
                            clearTimeout(timeout);
                            resolve();
                        })
                        .catch((error) => {
                            clearTimeout(timeout);
                            console.error("[Router] renderEach hook execution error:", error);
                            resolve();
                        });
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
                // 如果调用 next()，由 next 回调处理
            } catch (error) {
                clearTimeout(timeout);
                console.error("[Router] renderEach hook sync error:", error);
                resolve();
            }
        });
    }

    /**
     * 运行带重试机制的 renderEach 钩子函数
     * 遵循 D-29: 混合错误处理模式
     * 遵循 D-30: 自动错误日志
     * @param hook - renderEach 钩子函数
     * @param to - 目标路由
     * @param from - 来源路由
     * @param maxRetries - 最大重试次数（默认 1）
     * @returns Promise<void>
     */
    async runRenderEachHookWithRetry(
        hook: RenderEachHook,
        to: KylinRouteItem,
        from: KylinRouteItem,
        maxRetries: number = 1,
    ): Promise<void> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await this.runRenderEachHook(hook, to, from);
                return; // 成功执行，退出
            } catch (error) {
                if (attempt === maxRetries) {
                    console.error(
                        `[Router] renderEach hook failed after ${maxRetries + 1} attempts:`,
                        {
                            route: to.name,
                            error,
                        },
                    );
                    throw error;
                }
                console.warn(`[Router] renderEach hook retry ${attempt + 1}/${maxRetries}`);
                // 延迟重试，避免立即重试导致相同错误
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }
}
