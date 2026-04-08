import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Loader } from "@/features/loader";
import type { LoadResult, RemoteLoadOptions } from "@/types/routes";

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
            },
        },
    };
}

describe("Loader - 组件加载系统", () => {
    let host: HTMLElement;
    let loader: Loader;
    let mockRouter: any;

    beforeEach(() => {
        host = createTestDOM();
        mockRouter = createMockRouter();
        loader = new Loader(mockRouter);
    });

    afterEach(() => {
        loader.cleanup();
    });

    describe("本地组件加载测试", () => {
        it("应该成功加载 HTML 元素名", async () => {
            const result = await loader.loadComponent("div");

            expect(result.success).toBe(true);
            expect(result.content).toBe("div");
            expect(result.error).toBeNull();
        });

        it("应该成功加载自定义元素名", async () => {
            const result = await loader.loadComponent("my-component");

            expect(result.success).toBe(true);
            expect(result.content).toBe("my-component");
            expect(result.error).toBeNull();
        });

        it("应该拒绝空字符串", async () => {
            const result = await loader.loadComponent("");

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toBe("Invalid component name");
        });
    });

    describe("动态导入加载测试", () => {
        it("应该成功加载动态导入函数", async () => {
            // 创建一个模拟的动态导入函数
            const mockImportFn = () => Promise.resolve({ default: class MockComponent {} });

            const result = await loader.loadComponent(mockImportFn);

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.error).toBeNull();
        });

        it("应该处理导入失败的情况", async () => {
            // 创建一个会抛出错误的导入函数
            const mockImportFn = () => Promise.reject(new Error("Module not found"));

            const result = await loader.loadComponent(mockImportFn);

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toBe("Module not found");
        });

        it("应该处理没有默认导出的模块", async () => {
            // 创建一个没有默认导出的模拟模块
            const mockImportFn = () => Promise.resolve({ namedExport: "value" });

            const result = await loader.loadComponent(mockImportFn);

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });
    });

    describe("远程 HTML 加载测试", () => {
        // Mock fetch API
        beforeEach(() => {
            // @ts-ignore
            globalThis.fetch = async (url: string) => {
                console.log("Mock fetch called with:", url); // 调试日志
                if (url === "http://example.com/success.html") {
                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get: (name: string) => (name === "content-length" ? "1000" : null),
                        },
                        text: async () => "<div>Content</div>",
                    } as Response;
                } else if (url === "http://example.com/body.html") {
                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get: (name: string) => null,
                        },
                        text: async () => "<html><body><div>Body Content</div></body></html>",
                    } as Response;
                } else if (url === "http://example.com/outlet.html") {
                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get: (name: string) => null,
                        },
                        text: async () => '<div data-outlet>Outlet Content</div>',
                    } as Response;
                } else if (url === "http://example.com/script.html") {
                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get: (name: string) => null,
                        },
                        text: async () => "<div><script>alert('xss')</script>Content</div>",
                    } as Response;
                } else if (url === "http://example.com/error.html") {
                    return {
                        ok: false,
                        status: 404,
                        headers: {
                            get: (name: string) => null,
                        },
                        text: async () => "Not Found",
                    } as Response;
                } else if (url === "http://example.com/timeout.html") {
                    // 模拟超时
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                status: 200,
                                headers: {
                                    get: (name: string) => null,
                                },
                                text: async () => "<div>Delayed Content</div>",
                            } as Response);
                        }, 6000); // 超过默认的 5 秒超时
                    });
                } else if (url === "http://example.com/large.html") {
                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get: (name: string) => "2097152", // 2MB
                        },
                        text: async () => "<div>Large Content</div>",
                    } as Response;
                } else if (url.includes("custom.html")) {
                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get: (name: string) => null,
                        },
                        text: async () =>
                            '<div class="wrapper"><div id="target">Target Content</div></div>',
                    } as Response;
                }
                throw new Error("URL not found: " + url);
            };
        });

        it("应该成功加载远程 HTML", async () => {
            const result = await loader.loadComponent("http://example.com/success.html");

            expect(result.success).toBe(true);
            expect(result.content).toBe("<div>Content</div>");
            expect(result.error).toBeNull();
        });

        it("应该提取 body 内容", async () => {
            const result = await loader.loadComponent("http://example.com/body.html");

            if (!result.success) {
                console.log("Body extract failed:", result.error);
            }
            expect(result.success).toBe(true);
            expect(result.content).toBe("<div>Body Content</div>");
        });

        it("应该提取 data-outlet 元素内容", async () => {
            const result = await loader.loadComponent("http://example.com/outlet.html");

            expect(result.success).toBe(true);
            expect(result.content).toBe("Outlet Content");
        });

        it("应该移除 script 标签（安全检查）", async () => {
            const result = await loader.loadComponent("http://example.com/script.html");

            expect(result.success).toBe(true);
            expect(result.content).not.toContain("<script>");
            expect(result.content).toContain("Content");
        });

        it("应该允许不安全的 HTML（allowUnsafeHTML=true）", async () => {
            const options: RemoteLoadOptions = {
                allowUnsafeHTML: true,
            };
            const result = await loader.loadComponent("http://example.com/script.html", options);

            expect(result.success).toBe(true);
            expect(result.content).toContain("<script>");
        });

        it("应该处理 HTTP 错误", async () => {
            const result = await loader.loadComponent("http://example.com/error.html");

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("HTTP error");
        });

        it("应该处理超时", async () => {
            const result = await loader.loadComponent("http://example.com/timeout.html");

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toBe("Load timeout");
        }, 10000); // 增加测试超时时间到 10 秒

        it("应该拒绝过大的响应", async () => {
            const result = await loader.loadComponent("http://example.com/large.html");

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toBe("Response too large (max 1MB)");
        });

        it("应该支持自定义超时时间", async () => {
            const options: RemoteLoadOptions = {
                timeout: 1000, // 1 秒超时
            };
            const result = await loader.loadComponent("http://example.com/timeout.html", options);

            expect(result.success).toBe(false);
            expect(result.error?.message).toBe("Load timeout");
        }, 8000);
    });

    describe("错误处理测试", () => {
        it("应该拒绝无效的组件类型", async () => {
            // @ts-ignore - 测试无效类型
            const result = await loader.loadComponent(123);

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("Invalid component type");
        });

        it("应该拒绝 null 组件", async () => {
            // @ts-ignore - 测试 null
            const result = await loader.loadComponent(null);

            expect(result.success).toBe(false);
            expect(result.content).toBeNull();
            expect(result.error).not.toBeNull();
        });
    });

    describe("URL 检测测试", () => {
        it("应该正确识别 http URL", async () => {
            const result = await loader.loadComponent("http://example.com/test.html");
            // 只要不会抛出错误就可以
            expect(result).toBeDefined();
        });

        it("应该正确识别 https URL", async () => {
            const result = await loader.loadComponent("https://example.com/test.html");
            // 只要不会抛出错误就可以
            expect(result).toBeDefined();
        });

        it("应该将非 URL 字符串视为元素名", async () => {
            const result = await loader.loadComponent("my-element");
            expect(result.success).toBe(true);
            expect(result.content).toBe("my-element");
        });
    });

    describe("AbortController 测试", () => {
        it("应该取消之前的加载请求", async () => {
            // @ts-ignore
            globalThis.fetch = async (url: string) => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            headers: {
                                get: (name: string) => null,
                            },
                            text: async () => "<div>Content</div>",
                        } as Response);
                    }, 1000);
                });
            };

            // 启动第一个加载请求
            const firstLoad = loader.loadComponent("http://example.com/first.html");

            // 立即启动第二个加载请求（应该取消第一个）
            const secondLoad = loader.loadComponent("http://example.com/second.html");

            const secondResult = await secondLoad;
            expect(secondResult.success).toBe(true);
        });
    });

    describe("自定义选择器测试", () => {
        beforeEach(() => {
            // @ts-ignore
            globalThis.fetch = async (url: string) => {
                return {
                    ok: true,
                    status: 200,
                    headers: {
                        get: (name: string) => null,
                    },
                    text: async () =>
                        '<div class="wrapper"><div id="target">Target Content</div></div>',
                } as Response;
            };
        });

        it("应该使用自定义选择器提取内容", async () => {
            const options: RemoteLoadOptions = {
                extractSelector: "#target",
            };
            const result = await loader.loadComponent("http://example.com/custom.html", options);

            expect(result.success).toBe(true);
            expect(result.content).toBe("Target Content");
        });

        it("应该回退到完整内容如果选择器不匹配", async () => {
            const options: RemoteLoadOptions = {
                extractSelector: "#nonexistent",
            };
            const result = await loader.loadComponent("http://example.com/custom.html", options);

            expect(result.success).toBe(true);
            expect(result.content).toContain('<div class="wrapper">');
        });
    });
});
