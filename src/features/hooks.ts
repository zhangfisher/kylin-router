/**
 * 处理路由生命周期钩子相关的功能
 * 支持三种钩子类型：beforeEach、renderEach、afterEach
 * 提供 FIFO 执行顺序、异步支持和错误处理
 */

import type { KylinRouter } from "@/router";
import type { HookFunction, RouteItem, RouteData, RenderEachHook } from "@/types";
import type { HookType } from "@/types";
import { HookTypeValues } from "@/types/hooks";

export class HookManager {
    /**
     * 钩子存储结构
     * 按照 HookType 分组存储钩子函数，保持注册顺序（FIFO）
     * 公开访问，允许开发者直接注册钩子
     */
    public hooks: Record<HookType, HookFunction[]>;

    /**
     * 路由器实例
     */
    private _router: KylinRouter;

    /**
     * 构造函数
     * @param router - KylinRouter 实例
     */
    constructor(router: KylinRouter) {
        this._router = router;
        this.hooks = {
            beforeEach: [],
            renderEach: [],
            afterEach: [],
        };
    }

    /**
     * 添加钩子函数
     * @param type - 钩子类型
     * @param hook - 钩子函数
     */
    add(type: HookType, hook: HookFunction | RenderEachHook): void {
        this.hooks[type].push(hook as HookFunction);
    }

    /**
     * 移除指定的钩子函数
     * @param type - 钩子类型
     * @param hook - 要移除的钩子函数
     */
    remove(type: HookType, hook: HookFunction | RenderEachHook): void {
        const index = this.hooks[type].indexOf(hook as HookFunction);
        if (index > -1) {
            this.hooks[type].splice(index, 1);
        }
    }

    /**
     * 清空钩子
     * @param type - 可选，指定要清空的钩子类型。如果不指定，清空所有钩子
     */
    clear(type?: HookType): void {
        if (type) {
            this.hooks[type] = [];
        } else {
            (Object.keys(this.hooks) as HookType[]).forEach((key) => {
                this.hooks[key] = [];
            });
        }
    }

    /**
     * 执行指定类型的所有钩子函数
     * @param type - 钩子类型
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<boolean | string> - 返回 false 表示取消导航，返回字符串表示重定向路径，返回 true 表示继续
     */
    async executeHooks(type: HookType, to: RouteItem, from: RouteItem): Promise<boolean | string> {
        const hooks = this.hooks[type];
        if (hooks.length === 0) return true;

        // afterEach 钩子使用特殊的执行逻辑，不抛出错误
        if (type === HookTypeValues.AFTER_EACH) {
            return this.executeAfterEachHooks(hooks, to, from);
        }

        for (const hook of hooks) {
            const result = await this.runHook(hook, to, from);
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
        hooks: HookFunction[],
        to: RouteItem,
        from: RouteItem,
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
    async runAfterEachHook(hook: HookFunction, to: RouteItem, from: RouteItem): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error("[Router] afterEach hook timeout after 30000ms");
                resolve(); // 超时不阻塞
            }, 30000);

            try {
                const result = hook(to, from, () => {}, this._router); // afterEach 不需要 next 回调

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

    /**
     * 运行单个钩子函数
     * @param hook - 钩子函数
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<boolean | string> - 钩子执行结果
     */
    async runHook(hook: HookFunction, to: RouteItem, from: RouteItem): Promise<boolean | string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Hook timeout after 30000ms`));
            }, 30000);

            const next = (result?: boolean | string) => {
                clearTimeout(timeout);
                resolve(result !== undefined ? result : true);
            };

            try {
                const result = hook(to, from, next, this._router);
                if (result instanceof Promise) {
                    result
                        .then(() => clearTimeout(timeout))
                        .catch((err) => {
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
        to: RouteItem,
        from: RouteItem,
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
        route: RouteItem,
        guard: (to: RouteItem, from: RouteItem) => any,
        to: RouteItem,
        from: RouteItem,
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
     * 执行 renderEach 钩子进行数据预加载
     * 遵循 D-18: 在组件加载后执行
     * 遵循 D-19: 失败时继续渲染
     * 遵循 D-20: 通过 route.data 传递
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<RouteData | undefined> - 合并后的预加载数据
     */
    async executeRenderEach(to: RouteItem, from: RouteItem): Promise<RouteData | undefined> {
        // 收集全局 renderEach 钩子
        const globalHooks = this.hooks[HookTypeValues.RENDER_EACH as HookType] as RenderEachHook[];
        // 收集路由级 renderEach 钩子
        const routeHooks = to.renderEach
            ? Array.isArray(to.renderEach)
                ? to.renderEach
                : [to.renderEach]
            : [];

        const allHooks = [...globalHooks, ...routeHooks];
        if (allHooks.length === 0) return undefined;

        let combinedData: RouteData = {};
        let errorCount = 0;
        const errors: Array<{ hook: RenderEachHook; error: Error }> = [];

        // 串行执行所有 renderEach 钩子
        for (const hook of allHooks) {
            try {
                const result = await this.runRenderEachHook(hook, to, from);
                if (result) {
                    combinedData = { ...combinedData, ...result };
                }
            } catch (error) {
                errorCount++;
                errors.push({ hook, error: error as Error });
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

        return combinedData;
    }

    /**
     * 运行单个 renderEach 钩子函数
     * @param hook - renderEach 钩子函数
     * @param to - 目标路由
     * @param from - 来源路由
     * @returns Promise<RouteData | undefined> - 钩子返回的预加载数据
     */
    async runRenderEachHook(
        hook: RenderEachHook,
        to: RouteItem,
        from: RouteItem,
    ): Promise<RouteData | undefined> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.error("[Router] renderEach hook timeout after 30000ms");
                resolve(undefined); // 超时返回 undefined，不阻塞导航
            }, 30000);

            const next = (data?: RouteData) => {
                clearTimeout(timeout);
                resolve(data);
            };

            try {
                const result = hook(to, from, next, this._router);

                // 支持直接返回数据
                if (result instanceof Promise) {
                    result
                        .then((data) => {
                            clearTimeout(timeout);
                            resolve(data || undefined);
                        })
                        .catch((error) => {
                            clearTimeout(timeout);
                            console.error("[Router] renderEach hook execution error:", error);
                            resolve(undefined);
                        });
                } else if (result !== undefined) {
                    clearTimeout(timeout);
                    resolve(result);
                }
                // 如果调用 next()，由 next 回调处理
            } catch (error) {
                clearTimeout(timeout);
                console.error("[Router] renderEach hook sync error:", error);
                resolve(undefined);
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
     * @returns Promise<RouteData | undefined> - 钩子返回的预加载数据
     */
    async runRenderEachHookWithRetry(
        hook: RenderEachHook,
        to: RouteItem,
        from: RouteItem,
        maxRetries: number = 1,
    ): Promise<RouteData | undefined> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.runRenderEachHook(hook, to, from);
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
        return undefined;
    }
}
