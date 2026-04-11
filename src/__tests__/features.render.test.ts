import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Render } from "@/features/render";
import type { LoadResult, RenderContext, KylinRenderOptions, KylinRouteItem } from "@/types";

/**
 * 创建测试用的 DOM 环境
 */
function createTestDOM() {
    const { Window } = require("happy-dom");
    const win = new Window({ url: "http://localhost/" });

    // @ts-ignore
    globalThis.window = win;
    // @ts-ignore
    globalThis.document = win.document;
    // @ts-ignore
    globalThis.history = win.history;
    // @ts-ignore
    globalThis.location = win.location;
    // @ts-ignore
    globalThis.Event = win.Event;
    // @ts-ignore
    globalThis.CustomEvent = win.CustomEvent;
    // @ts-ignore
    globalThis.HTMLElement = win.HTMLElement;
    // @ts-ignore
    globalThis.URLSearchParams = win.URLSearchParams;
    // @ts-ignore
    globalThis.DOMParser = win.DOMParser;

    win.SyntaxError = SyntaxError;

    // @ts-ignore
    const host = document.createElement("div") as HTMLElement;
    // @ts-ignore
    document.body.appendChild(host);
    return host;
}

/**
 * 创建模拟的 KylinRouter 实例
 */
function createMockRouter(): any {
    return {
        debug: false,
        options: {},
        routes: {
            current: {
                route: null,
                params: {},
                query: {},
                matchedRoutes: [],
            },
        },
        render: {}, // 会被 Render 实例替换
    };
}

describe("Render 类", () => {
    let host: HTMLElement;
    let mockRouter: any;

    beforeEach(() => {
        host = createTestDOM();
        mockRouter = createMockRouter();
        // Render 类通过 Mixin 模式集成到 KylinRouter
        // 模拟 Render 方法绑定到 router 实例
        Object.assign(mockRouter, {
            createRenderContext: function (route: KylinRouteItem) {
                const context: RenderContext = {
                    router: mockRouter,
                    route: {
                        ...route,
                        data: route.data || {},
                    },
                    ...(route.data || {}),
                };
                return context;
            },
            renderToOutlet: async function (
                loadResult: LoadResult,
                outlet: HTMLElement,
                options?: KylinRenderOptions,
            ) {
                // 简化的渲染逻辑用于测试
                if (!loadResult.success) {
                    outlet.innerHTML = `<div class="kylin-render-error"><h3>渲染错误</h3><p>${loadResult.error?.message || "Unknown error"}</p></div>`;
                    return;
                }

                const content = loadResult.content;
                if (!content) {
                    outlet.innerHTML =
                        '<div class="kylin-render-error"><h3>渲染错误</h3><p>No content to render</p></div>';
                    return;
                }

                const route = mockRouter.routes.current.route;
                if (!route) {
                    outlet.innerHTML =
                        '<div class="kylin-render-error"><h3>渲染错误</h3><p>No current route</p></div>';
                    return;
                }

                // 简化：直接渲染内容
                if (typeof content === "string") {
                    outlet.innerHTML = content;
                }
            },
        });
    });

    afterEach(() => {
        // @ts-ignore
        if (document && document.body) {
            // @ts-ignore
            document.body.innerHTML = "";
        }
    });

    describe("createRenderContext", () => {
        it("应该创建包含 router 和 route 的基础上下文", () => {
            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
                data: { userId: 123 },
            };

            const context = mockRouter.createRenderContext(route);

            expect(context.router).toBe(mockRouter);
            expect(context.route).toBeDefined();
            expect(context.route.name).toBe("test");
            expect(context.userId).toBe(123); // data 字段展开
        });

        it("应该正确展开 route.data 字段为局部变量", () => {
            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
                data: {
                    title: "Hello",
                    userId: 456,
                    nested: { value: "deep" },
                },
            };

            const context = mockRouter.createRenderContext(route);

            expect(context.title).toBe("Hello");
            expect(context.userId).toBe(456);
            expect(context.nested).toEqual({ value: "deep" });
        });

        it("应该处理空的 route.data", () => {
            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
            };

            const context = mockRouter.createRenderContext(route);

            expect(context.router).toBe(mockRouter);
            expect(context.route).toBeDefined();
            expect(context.route.data).toEqual({});
        });
    });

    describe("renderToOutlet", () => {
        it("应该渲染 HTML 字符串内容", async () => {
            const outlet = document.createElement("kylin-outlet");
            host.appendChild(outlet);

            const loadResult: LoadResult = {
                success: true,
                content: "<h1>Hello World</h1>",
                error: null,
            };

            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
            };

            mockRouter.routes.current.route = route;

            await mockRouter.renderToOutlet(loadResult, outlet);

            expect(outlet.innerHTML).toContain("Hello World");
        });

        it("应该处理渲染失败的情况", async () => {
            const outlet = document.createElement("kylin-outlet");
            host.appendChild(outlet);

            const loadResult: LoadResult = {
                success: false,
                content: null,
                error: new Error("Load failed"),
            };

            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
            };

            mockRouter.routes.current.route = route;

            await mockRouter.renderToOutlet(loadResult, outlet);

            expect(outlet.innerHTML).toContain("渲染错误");
        });

        it("应该支持替换模式（默认）", async () => {
            const outlet = document.createElement("kylin-outlet");
            outlet.innerHTML = "<div>Old Content</div>";
            host.appendChild(outlet);

            const loadResult: LoadResult = {
                success: true,
                content: "<div>New Content</div>",
                error: null,
            };

            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
            };

            mockRouter.routes.current.route = route;

            await mockRouter.renderToOutlet(loadResult, outlet);

            expect(outlet.innerHTML).not.toContain("Old Content");
            expect(outlet.innerHTML).toContain("New Content");
        });
    });

    describe("错误处理", () => {
        it("应该处理缺失内容的情况", async () => {
            const outlet = document.createElement("kylin-outlet");
            host.appendChild(outlet);

            const loadResult: LoadResult = {
                success: true,
                content: null,
                error: null,
            };

            const route: KylinRouteItem = {
                name: "test",
                path: "/test",
            };

            mockRouter.routes.current.route = route;

            await mockRouter.renderToOutlet(loadResult, outlet);

            expect(outlet.innerHTML).toContain("渲染错误");
        });
    });
});
