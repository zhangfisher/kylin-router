/**
 * DataLoader 单元测试
 * 测试数据加载功能：静态数据、远程数据、缓存、abort
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataLoader } from "../features/dataLoader";
import type { KylinRouter } from "../router";
import type { KylinMatchedRouteItem } from "../types/routes";

// Mock logger
const mockLogger = {
    debug: () => {},
    error: () => {},
    info: () => {},
    warn: () => {},
};

// Mock KylinRouter
const createMockRouter = (): Partial<KylinRouter> => ({
    debug: false,
    logger: mockLogger,
    routes: {
        current: {
            route: null,
            params: {},
            query: {},
            matchedRoutes: [],
        },
    },
    options: {
        base: "/",
        dataOptions: {
            timeout: 5000,
            cache: 0,
        },
    },
});

// 创建模拟的 matched route
function createMockedRoute(
    path: string,
    data: any,
    id: number = 1,
): KylinMatchedRouteItem {
    return {
        route: {
            name: "test",
            path: path,
            data: data,
        },
        params: {},
        query: {},
        state: {},
        path: path,
        url: path,
        hash: `hash_${path}_${id}`,
        id: id,
    };
}

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
            const matchedRoute = createMockedRoute("/test", {
                userId: 123,
                username: "test",
            });

            await dataLoader.loadDatas([matchedRoute]);

            // 静态数据是同步处理的，但需要等待微任务
            await new Promise((resolve) => setTimeout(resolve, 0));

            const signal = matchedRoute.route?._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toMatchObject({ userId: 123, username: "test" });
            }
        });

        it("应该处理空数据", async () => {
            const matchedRoute = createMockedRoute("/test", {});

            await dataLoader.loadDatas([matchedRoute]);
            await new Promise((resolve) => setTimeout(resolve, 0));

            const signal = matchedRoute.route?._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toEqual({});
            }
        });

        it("应该在没有 data 字段时不创建 signal", async () => {
            const matchedRoute = createMockedRoute("/test", undefined);

            await dataLoader.loadDatas([matchedRoute]);
            await new Promise((resolve) => setTimeout(resolve, 0));

            const signal = matchedRoute.route?._getData;
            // 当 data 为 undefined 时，loadRoute 会提前返回，不会创建 signal
            expect(signal).toBeUndefined();
        });
    });

    describe("动态数据加载测试", () => {
        it("应该成功加载动态数据", async () => {
            const mockDataFn = async () => ({
                userId: 456,
                username: "remote",
            });

            const matchedRoute = createMockedRoute("/test", mockDataFn);

            await dataLoader.loadDatas([matchedRoute]);

            // 等待异步数据加载完成
            await new Promise((resolve) => setTimeout(resolve, 50));

            const signal = matchedRoute.route?._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toMatchObject({ userId: 456, username: "remote" });
            }
        });

        it("应该处理动态数据加载失败", async () => {
            const mockDataFn = async () => {
                throw new Error("Network error");
            };

            const matchedRoute = createMockedRoute("/test", { from: mockDataFn });

            await dataLoader.loadDatas([matchedRoute]);

            // 等待错误处理完成
            await new Promise((resolve) => setTimeout(resolve, 50));

            const signal = matchedRoute.route?._getData;
            expect(signal).toBeDefined();
            if (signal) {
                // 应该 reject 错误
                expect(signal.isRejected()).toBe(true);
                expect(signal.error?.message).toBe("Network error");
            }
        });
    });

    describe("缓存功能测试", () => {
        it("应该缓存数据并在后续请求中重用", async () => {
            // 设置缓存时间 - 使用 _dataOptions 来覆盖默认值
            const mockDataFn = async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return { userId: 789, username: "cached" };
            };

            // 使用 from 选项来指定数据源，并设置缓存
            const matchedRoute1 = createMockedRoute("/cached", { from: mockDataFn, cache: 10000 });
            const matchedRoute2 = createMockedRoute("/cached", { from: mockDataFn, cache: 10000 });

            // 第一次加载
            await dataLoader.loadDatas([matchedRoute1]);
            await new Promise((resolve) => setTimeout(resolve, 50));

            // 验证缓存存在
            expect(dataLoader.cache.size).toBeGreaterThan(0);

            // 第二次加载（应该使用缓存）
            await dataLoader.loadDatas([matchedRoute2]);
            // 等待缓存命中的 signal 被创建
            await new Promise((resolve) => setTimeout(resolve, 50));

            const signal = matchedRoute2.route?._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toMatchObject({ userId: 789, username: "cached" });
            }
        });

        it("应该在缓存过期后重新加载", async () => {
            // 设置短缓存时间
            let callCount = 0;
            const mockDataFn = async () => {
                callCount++;
                return { userId: 999, username: "expired" };
            };

            const matchedRoute1 = createMockedRoute("/expire", { from: mockDataFn, cache: 50 });
            const matchedRoute2 = createMockedRoute("/expire", { from: mockDataFn, cache: 50 });

            // 第一次加载
            await dataLoader.loadDatas([matchedRoute1]);
            await new Promise((resolve) => setTimeout(resolve, 30));
            // 注意：callCount 是 2 因为 loadRoute 在检查缓存前调用 getSource
            expect(callCount).toBe(2);

            // 等待缓存过期
            await new Promise((resolve) => setTimeout(resolve, 60));

            // 第二次加载（缓存已过期，应该重新加载）
            await dataLoader.loadDatas([matchedRoute2]);
            await new Promise((resolve) => setTimeout(resolve, 30));

            // 总共是 4 次调用（2次第一次加载，2次第二次加载）
            expect(callCount).toBe(4);
        });
    });

    describe("快速导航测试（竞态问题）", () => {
        it("应该正确处理快速连续的导航请求", async () => {
            let callCount = 0;
            const mockDataFn = async () => {
                callCount++;
                // 模拟慢速请求
                await new Promise((resolve) => setTimeout(resolve, 100));
                return { userId: callCount, username: "rapid" };
            };

            const matchedRoute1 = createMockedRoute("/rapid", { from: mockDataFn });
            const matchedRoute2 = createMockedRoute("/rapid", { from: mockDataFn });
            const matchedRoute3 = createMockedRoute("/rapid", { from: mockDataFn });

            // 第一次导航
            dataLoader.loadDatas([matchedRoute1]);

            // 等待一点点时间让第一次请求开始
            await new Promise((resolve) => setTimeout(resolve, 10));

            // 第二次导航（在第一次完成前）- 会中止第一次请求
            dataLoader.loadDatas([matchedRoute2]);

            await new Promise((resolve) => setTimeout(resolve, 10));

            // 第三次导航（在第二次完成前）- 会中止第二次请求
            dataLoader.loadDatas([matchedRoute3]);

            // 等待最后请求完成
            await new Promise((resolve) => setTimeout(resolve, 150));

            const signal = matchedRoute3.route?._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                // 由于前两次请求被中止，只有第三次完成
                expect(signal.result).toMatchObject({ username: "rapid" });
            }
        });
    });

    describe("并发加载测试", () => {
        it("应该能够并发加载多个路由的数据", async () => {
            const mockDataFn1 = async () => {
                await new Promise((resolve) => setTimeout(resolve, 30));
                return { page: "home" };
            };

            const mockDataFn2 = async () => {
                await new Promise((resolve) => setTimeout(resolve, 30));
                return { page: "user" };
            };

            const matchedRoute1 = createMockedRoute("/home", { from: mockDataFn1 });
            const matchedRoute2 = createMockedRoute("/user", { from: mockDataFn2 });

            // 并发加载
            await dataLoader.loadDatas([matchedRoute1, matchedRoute2]);

            // 等待所有异步操作完成
            await new Promise((resolve) => setTimeout(resolve, 80));

            const signal1 = matchedRoute1.route?._getData;
            const signal2 = matchedRoute2.route?._getData;

            expect(signal1).toBeDefined();
            expect(signal2).toBeDefined();

            if (signal1 && signal2) {
                expect(signal1.isFulfilled()).toBe(true);
                expect(signal2.isFulfilled()).toBe(true);
                expect(signal1.result).toMatchObject({ page: "home" });
                expect(signal2.result).toMatchObject({ page: "user" });
            }
        });
    });

    describe("资源清理测试", () => {
        it("应该正确清理缓存", async () => {
            // 设置缓存
            const mockDataFn = async () => ({ data: "test" });
            const matchedRoute = createMockedRoute("/cleanup", { from: mockDataFn, cache: 10000 });

            await dataLoader.loadDatas([matchedRoute]);
            await new Promise((resolve) => setTimeout(resolve, 30));

            // 验证缓存存在
            expect(dataLoader.cache.size).toBeGreaterThan(0);

            // 清理资源
            dataLoader.cleanup();

            // 验证缓存被清空
            expect(dataLoader.cache.size).toBe(0);
        });
    });
});
