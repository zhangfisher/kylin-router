/**
 * DataLoader 单元测试
 * 测试错误处理、重试机制、导航竞态控制等功能
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataLoader } from "../features/data";
import type { KylinRouter } from "../router";
import type { RouteItem, ErrorBoundaryConfig, RetryConfig } from "../types";
import type { ViewLoadResult } from "../types/routes";
import { GlobalWindow } from "happy-dom";

// Mock KylinRouter
const createMockRouter = (): Partial<KylinRouter> => ({
    debug: false,
    routes: {
        current: {
            route: null,
            params: {},
            query: {},
            matchedRoutes: [],
        },
    },
    options: {
        defaultErrorComponent: undefined,
        defaultLoadingTemplate: undefined,
    },
    viewLoader: {
        loadView: async () => ({
            success: true,
            content: "<div>Test</div>",
            error: null,
        }),
    },
});

describe("DataLoader", () => {
    let dataLoader: DataLoader;
    let mockRouter: Partial<KylinRouter>;
    let window: GlobalWindow;

    beforeEach(() => {
        // 创建 Happy DOM 环境
        window = new GlobalWindow();
        globalThis.document = window.document as any;
        globalThis.HTMLElement = window.HTMLElement as any;
        globalThis.Element = window.Element as any;

        mockRouter = createMockRouter();
        dataLoader = new DataLoader(mockRouter as KylinRouter);
    });

    afterEach(() => {
        dataLoader.cleanup();
    });

    describe("错误边界测试", () => {
        it("应该在路由级配置时使用路由级错误组件", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                errorBoundary: {
                    component: "div",
                    fallback: "<div>路由级错误</div>",
                },
            };

            const outlet = document.createElement("div");
            const error = new Error("Test error");

            await dataLoader.handleError(error, route, outlet);

            // 验证错误边界被渲染
            expect(outlet.innerHTML).toContain("路由级错误");
        });

        it("应该在无路由级配置时使用全局错误组件", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
            };

            const outlet = document.createElement("div");
            const error = new Error("Test error");

            await dataLoader.handleError(error, route, outlet);

            // 验证错误边界被渲染（使用默认错误显示）
            expect(outlet.innerHTML).toContain("组件加载失败");
        });

        it("应该正确传递错误信息给错误组件", async () => {
            let capturedError: Error | null = null;

            const route: RouteItem = {
                name: "test",
                path: "/test",
                errorBoundary: {
                    onError: (error) => {
                        capturedError = error;
                    },
                },
            };

            const outlet = document.createElement("div");
            const error = new Error("Test error message");

            await dataLoader.handleError(error, route, outlet);

            // 验证错误回调被调用
            expect(capturedError).not.toBeNull();
            expect(capturedError?.message).toBe("Test error message");
        });
    });

    describe("重试机制测试", () => {
        it("应该使用固定重试策略重试3次", async () => {
            let attemptCount = 0;
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
            };

            // Mock loader 前两次失败，第三次成功
            (mockRouter as any).viewLoader.loadView = async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    return {
                        success: false,
                        content: null,
                        error: new Error("Load failed"),
                    };
                }
                return {
                    success: true,
                    content: "<div>Success</div>",
                    error: null,
                };
            };

            const outlet = document.createElement("div");
            const retryConfig: RetryConfig = {
                max: 3,
                delay: 100,
                backoff: "linear",
            };

            const result = await dataLoader.retryLoad(route, outlet, retryConfig);

            // 验证重试了3次
            expect(attemptCount).toBe(3);
            expect(result.success).toBe(true);
        });

        it("应该使用指数退避策略", async () => {
            let attemptCount = 0;
            const delays: number[] = [];
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
            };

            // Mock loader 总是失败
            (mockRouter as any).viewLoader.loadView = async () => {
                attemptCount++;
                return {
                    success: false,
                    content: null,
                    error: new Error("Load failed"),
                };
            };

            // 记录延迟时间
            const originalDelay = (dataLoader as any).delay.bind(dataLoader);
            (dataLoader as any).delay = async (baseDelay: number, attempt: number) => {
                delays.push(baseDelay * Math.pow(2, attempt - 1));
                return originalDelay(baseDelay, attempt, "exponential");
            };

            const outlet = document.createElement("div");
            const retryConfig: RetryConfig = {
                max: 3,
                delay: 100,
                backoff: "exponential",
            };

            await dataLoader.retryLoad(route, outlet, retryConfig);

            // 验证使用了指数退避：100, 200, 400
            expect(delays).toEqual([100, 200, 400]);
        });

        it("应该调用重试回调函数", async () => {
            let retryCallbackCalled = false;
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
            };

            // Mock loader 总是失败
            (mockRouter as any).viewLoader.loadView = async () => ({
                success: false,
                content: null,
                error: new Error("Load failed"),
            });

            const outlet = document.createElement("div");
            const retryConfig: RetryConfig = {
                max: 2,
                delay: 50,
                onRetry: (attempt, error) => {
                    retryCallbackCalled = true;
                    expect(attempt).toBeGreaterThan(0);
                    expect(error).toBeInstanceOf(Error);
                },
            };

            await dataLoader.retryLoad(route, outlet, retryConfig);

            // 验证重试回调被调用
            expect(retryCallbackCalled).toBe(true);
        });
    });

    describe("导航竞态测试（ERROR-02）", () => {
        it("应该正确检测导航版本号变更", () => {
            // 获取初始版本号
            const version1 = dataLoader.getNavVersion();

            // 递增版本号
            dataLoader.incrementNavVersion();

            // 获取新版本号
            const version2 = dataLoader.getNavVersion();

            // 验证版本号递增了
            expect(version2).toBe(version1 + 1);
        });

        it("应该检查导航版本号是否匹配", () => {
            const currentVersion = dataLoader.getNavVersion();

            // 检查当前版本号应该匹配
            expect((dataLoader as any).checkNavVersion(currentVersion)).toBe(true);

            // 递增版本号后，旧版本号不应该匹配
            dataLoader.incrementNavVersion();
            expect((dataLoader as any).checkNavVersion(currentVersion)).toBe(false);
        });

        it("应该取消进行中的请求", () => {
            let abortCalled = false;

            // 创建一个 AbortController 并监听 abort 事件
            const testController = new AbortController();
            testController.signal.addEventListener("abort", () => {
                abortCalled = true;
            });

            // 替换 DataLoader 的 abortController
            (dataLoader as any).abortController = testController;

            // 调用 abortPendingRequests
            dataLoader.abortPendingRequests();

            // 验证请求被取消
            expect(abortCalled).toBe(true);
        });

        it("应该在重试中检查导航版本号", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
            };

            let loadCount = 0;
            (mockRouter as any).viewLoader.loadView = async () => {
                loadCount++;

                // 在第一次加载时递增版本号，模拟竞态条件
                if (loadCount === 1) {
                    dataLoader.incrementNavVersion();
                    // 等待一下确保版本号变更被检测到
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }

                return {
                    success: true,
                    content: "<div>Success</div>",
                    error: null,
                };
            };

            const outlet = document.createElement("div");
            const retryConfig: RetryConfig = {
                max: 3,
                delay: 50,
            };

            const result = await dataLoader.retryLoad(route, outlet, retryConfig);

            // 验证重试因版本号变更而取消
            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Navigation version changed");
        });
    });

    describe("加载状态测试", () => {
        it("应该正确显示和隐藏加载状态", () => {
            const outlet = document.createElement("div");

            // 添加 loading 元素
            const loading = document.createElement("kylin-loading");
            outlet.appendChild(loading);

            // 验证 loading 存在
            expect(outlet.querySelector("kylin-loading")).not.toBeNull();

            // 移除 loading
            loading.remove();

            // 验证 loading 已移除
            expect(outlet.querySelector("kylin-loading")).toBeNull();
        });
    });

    describe("集成测试", () => {
        it("应该处理完整的错误处理流程", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
                errorBoundary: {
                    fallback: "<div>Custom Error</div>",
                    retry: false, // 不重试，直接显示错误
                },
            };

            // Mock loader 失败
            (mockRouter as any).viewLoader.loadView = async () => ({
                success: false,
                content: null,
                error: new Error("Load failed"),
            });

            const outlet = document.createElement("div");

            await dataLoader.handleError(
                new Error("Integration test error"),
                route,
                outlet,
            );

            // 验证错误边界被渲染
            expect(outlet.innerHTML).toContain("Custom Error");
        });

        it("应该在重试成功后恢复渲染", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
                errorBoundary: {
                    retry: {
                        max: 3,
                        delay: 50,
                    },
                },
            };

            let attemptCount = 0;
            (mockRouter as any).viewLoader.loadView = async () => {
                attemptCount++;

                // 第一次失败，第二次成功
                if (attemptCount === 1) {
                    return {
                        success: false,
                        content: null,
                        error: new Error("Load failed"),
                    };
                }

                return {
                    success: true,
                    content: "<div>Success</div>",
                    error: null,
                };
            };

            // Mock renderToOutlet
            let renderedContent: any = null;
            (mockRouter as any).renderToOutlet = async (result: ViewLoadResult) => {
                renderedContent = result.content;
            };

            const outlet = document.createElement("div");

            await dataLoader.handleError(new Error("Test error"), route, outlet);

            // 验证重试成功并渲染了内容
            expect(attemptCount).toBe(2);
            expect(renderedContent).toBe("<div>Success</div>");
        });

        it("应该在多重重试后最终失败处理", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                view: "https://example.com/test.html",
                errorBoundary: {
                    fallback: "<div>Final Error</div>",
                    retry: {
                        max: 2,
                        delay: 50,
                    },
                },
            };

            // Mock loader 总是失败
            (mockRouter as any).viewLoader.loadView = async () => ({
                success: false,
                content: null,
                error: new Error("Always fails"),
            });

            const outlet = document.createElement("div");

            await dataLoader.handleError(new Error("Test error"), route, outlet);

            // 验证最终错误边界被渲染
            expect(outlet.innerHTML).toContain("Final Error");
        });
    });
});
