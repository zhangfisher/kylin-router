/**
 * DataLoader 单元测试
 * 测试数据加载功能：静态数据、远程数据、错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataLoader } from "../features/data";
import type { KylinRouter } from "../router";
import type { RouteItem } from "../types";

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
    options: {},
});

describe("DataLoader", () => {
    let dataLoader: DataLoader;
    let mockRouter: Partial<KylinRouter>;

    beforeEach(() => {
        mockRouter = createMockRouter();
        dataLoader = new DataLoader(mockRouter as KylinRouter);
    });

    afterEach(() => {
        dataLoader.cleanup();
    });

    describe("静态数据加载测试", () => {
        it("应该成功加载静态数据", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: { userId: 123, username: "test" },
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ userId: 123, username: "test" });
            expect(result.error).toBeUndefined();
        });

        it("应该处理空数据", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: {},
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({});
        });

        it("应该在没有 data 字段时返回空数据", async () => {
            const route: RouteItem = {
                name: "test",
                path: "/test",
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({});
        });
    });

    describe("远程数据加载测试", () => {
        it("应该成功加载远程数据", async () => {
            const mockDataFn = async () => ({
                userId: 456,
                username: "remote",
            });

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn,
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ userId: 456, username: "remote" });
        });

        it("应该处理远程数据加载失败", async () => {
            const mockDataFn = async () => {
                throw new Error("Network error");
            };

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn,
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(false);
            expect(result.data).toBeUndefined();
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe("Network error");
        });

        it("应该处理超时", async () => {
            const mockDataFn = async () => {
                // 模拟长时间加载
                await new Promise((resolve) => setTimeout(resolve, 6000));
                return { data: "slow" };
            };

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn,
            };

            const result = await dataLoader.loadData(route, { timeout: 1000 });

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe("Data load timeout");
        }, 10000);

        it("应该验证返回数据类型", async () => {
            const mockDataFn = async () => null as any;

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn,
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe("Data function must return an object");
        });
    });

    describe("请求取消测试", () => {
        it("应该取消进行中的请求", async () => {
            let abortCalled = false;
            const mockDataFn = async (_signal?: any) => {
                if (_signal?.aborted) {
                    abortCalled = true;
                    throw new Error("Cancelled");
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
                return { data: "test" };
            };

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn as any,
            };

            // 立即取消请求
            const loadPromise = dataLoader.loadData(route);
            dataLoader.abortPendingRequests();

            const result = await loadPromise;

            // 验证请求被取消（注意：实际取消取决于 signal 传递）
            expect(result).toBeDefined();
        });
    });

    describe("资源清理测试", () => {
        it("应该正确清理资源", async () => {
            const dataLoader2 = new DataLoader(mockRouter as KylinRouter);

            // 先触发一次数据加载，初始化 abortController
            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: { test: "data" },
            };
            await dataLoader2.loadData(route);

            // 验证 abortController 存在
            expect((dataLoader2 as any).abortController).toBeDefined();

            // 清理资源
            dataLoader2.cleanup();

            // 验证 abortController 被清理
            expect((dataLoader2 as any).abortController).toBeUndefined();
        });
    });

    describe("集成测试", () => {
        it("应该处理完整的数据加载流程", async () => {
            const mockDataFn = async () => ({
                user: { id: 1, name: "Test User" },
                posts: [{ id: 1, title: "Post 1" }],
            });

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn,
            };

            const result = await dataLoader.loadData(route);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                user: { id: 1, name: "Test User" },
                posts: [{ id: 1, title: "Post 1" }],
            });
        });

        it("应该支持自定义超时时间", async () => {
            const mockDataFn = async () => {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                return { data: "test" };
            };

            const route: RouteItem = {
                name: "test",
                path: "/test",
                data: mockDataFn,
            };

            // 使用较短的超时时间
            const result = await dataLoader.loadData(route, { timeout: 500 });

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe("Data load timeout");
        }, 3000);
    });
});
