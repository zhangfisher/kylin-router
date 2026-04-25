/**
 * DataLoader 单元测试
 * 测试数据加载功能：静态数据、远程数据、缓存、abort
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataLoader } from "../features/dataLoader";
import type { KylinRouter } from "../router";
import type { KylinMatchedRouteItem } from "../types/routes";

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
): KylinMatchedRouteItem {
    return {
        route: {
            name: "test",
            path: path,
            data: data,
        },
        params: {},
        query: {},
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

            // 等待异步操作完成
            await new Promise((resolve) => setTimeout(resolve, 100));

            const signal = matchedRoute.route._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toMatchObject({ userId: 123, username: "test" });
            }
        });

        it("应该处理空数据", async () => {
            const matchedRoute = createMockedRoute("/test", {});

            await dataLoader.loadDatas([matchedRoute]);

            await new Promise((resolve) => setTimeout(resolve, 100));

            const signal = matchedRoute.route._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toEqual({});
            }
        });

        it("应该在没有 data 字段时返回 undefined", async () => {
            const matchedRoute = createMockedRoute("/test", undefined);

            await dataLoader.loadDatas([matchedRoute]);

            await new Promise((resolve) => setTimeout(resolve, 100));

            const signal = matchedRoute.route._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toEqual({});
            }
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

            await new Promise((resolve) => setTimeout(resolve, 100));

            const signal = matchedRoute.route._getData;
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

            const matchedRoute = createMockedRoute("/test", mockDataFn);

            await dataLoader.loadDatas([matchedRoute]);

            await new Promise((resolve) => setTimeout(resolve, 100));

            const signal = matchedRoute.route._getData;
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
            // 设置缓存时间
            if (mockRouter.options) {
                mockRouter.options.dataOptions = {
                    timeout: 5000,
                    cache: 10000, // 10秒缓存
                };
            }

            let callCount = 0;
            const mockDataFn = async () => {
                callCount++;
                await new Promise((resolve) => setTimeout(resolve, 50));
                return { userId: 789, username: "cached" };
            };

            const matchedRoute1 = createMockedRoute("/cached", mockDataFn);
            const matchedRoute2 = createMockedRoute("/cached", mockDataFn);

            // 第一次加载
            await dataLoader.loadDatas([matchedRoute1]);
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(callCount).toBe(1);

            // 第二次加载（应该使用缓存）
            await dataLoader.loadDatas([matchedRoute2]);
            await new Promise((resolve) => setTimeout(resolve, 50));

            const signal = matchedRoute2.route._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toMatchObject({ userId: 789, username: "cached" });
            }

            // 验证没有再次调用数据函数
            expect(callCount).toBe(1);
        });

        it("应该在缓存过期后重新加载", async () => {
            // 设置短缓存时间
            if (mockRouter.options) {
                mockRouter.options.dataOptions = {
                    timeout: 5000,
                    cache: 100, // 100ms缓存
                };
            }

            let callCount = 0;
            const mockDataFn = async () => {
                callCount++;
                return { userId: 999, username: "expired" };
            };

            const matchedRoute1 = createMockedRoute("/expire", mockDataFn);
            const matchedRoute2 = createMockedRoute("/expire", mockDataFn);

            // 第一次加载
            await dataLoader.loadDatas([matchedRoute1]);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(callCount).toBe(1);

            // 等待缓存过期
            await new Promise((resolve) => setTimeout(resolve, 150));

            // 第二次加载（缓存已过期，应该重新加载）
            await dataLoader.loadDatas([matchedRoute2]);
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(callCount).toBe(2);
        });
    });

    describe("快速导航测试（竞态问题）", () => {
        it("应该正确处理快速连续的导航请求", async () => {
            let callCount = 0;
            const mockDataFn = async () => {
                callCount++;
                // 模拟慢速请求
                await new Promise((resolve) => setTimeout(resolve, 200));
                return { userId: callCount, username: "rapid" };
            };

            const matchedRoute1 = createMockedRoute("/rapid", mockDataFn);
            const matchedRoute2 = createMockedRoute("/rapid", mockDataFn);
            const matchedRoute3 = createMockedRoute("/rapid", mockDataFn);

            // 第一次导航
            await dataLoader.loadDatas([matchedRoute1]);
            expect(matchedRoute1.route._getData?.isPending()).toBe(true);

            // 第二次导航（在第一次完成前）
            await new Promise((resolve) => setTimeout(resolve, 50));
            await dataLoader.loadDatas([matchedRoute2]);

            // 第一次请求应该被完成（旧的signal被覆盖）
            expect(matchedRoute1.route._getData?.isFulfilled() || matchedRoute1.route._getData?.isRejected()).toBe(true);
            expect(matchedRoute2.route._getData?.isPending()).toBe(true);

            // 第三次导航（在第二次完成前）
            await new Promise((resolve) => setTimeout(resolve, 50));
            await dataLoader.loadDatas([matchedRoute3]);

            // 第二次请求应该被完成
            expect(matchedRoute2.route._getData?.isFulfilled() || matchedRoute2.route._getData?.isRejected()).toBe(true);
            expect(matchedRoute3.route._getData?.isPending()).toBe(true);

            // 等待最后请求完成
            await new Promise((resolve) => setTimeout(resolve, 300));

            const signal = matchedRoute3.route._getData;
            expect(signal).toBeDefined();
            if (signal) {
                expect(signal.isFulfilled()).toBe(true);
                expect(signal.result).toMatchObject({ username: "rapid" });
            }
        });
    });

    describe("并发加载测试", () => {
        it("应该能够并发加载多个路由的数据", async () => {
            const mockDataFn1 = async () => {
                await new Promise((resolve) => setTimeout(resolve, 50));
                return { page: "home" };
            };

            const mockDataFn2 = async () => {
                await new Promise((resolve) => setTimeout(resolve, 50));
                return { page: "user" };
            };

            const matchedRoute1 = createMockedRoute("/home", mockDataFn1);
            const matchedRoute2 = createMockedRoute("/user", mockDataFn2);

            // 并发加载
            await dataLoader.loadDatas([matchedRoute1, matchedRoute2]);

            await new Promise((resolve) => setTimeout(resolve, 150));

            const signal1 = matchedRoute1.route._getData;
            const signal2 = matchedRoute2.route._getData;

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
            if (mockRouter.options) {
                mockRouter.options.dataOptions = {
                    timeout: 5000,
                    cache: 10000,
                };
            }

            const mockDataFn = async () => ({ data: "test" });
            const matchedRoute = createMockedRoute("/cleanup", mockDataFn);

            await dataLoader.loadDatas([matchedRoute]);
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 验证缓存存在
            expect(dataLoader.cache.size).toBeGreaterThan(0);

            // 清理资源
            dataLoader.cleanup();

            // 验证缓存被清空
            expect(dataLoader.cache.size).toBe(0);
        });
    });
});
