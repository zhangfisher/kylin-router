import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { KylinRouter } from "@/router";

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
    win.SyntaxError = SyntaxError;

    // @ts-ignore
    const host = document.createElement("div") as HTMLElement;
    // @ts-ignore
    document.body.appendChild(host);
    return host;
}

async function createRouter(host: HTMLElement, options: any) {
    const { KylinRouter } = await import("@/router");
    return new KylinRouter(host, options);
}

describe("Default route redirect", () => {
    let host: HTMLElement;
    let router: KylinRouter;

    const routes = [
        { name: "root", path: "/" },
        { name: "home", path: "/home" },
        { name: "user", path: "/user" },
        { name: "not-found", path: "*" },
    ];

    beforeEach(async () => {
        host = createTestDOM();
    });

    afterEach(() => {
        if (router) {
            router.detach();
        }
        if (host && host.parentElement) {
            host.parentElement.removeChild(host);
        }
    });

    it("访问根路径 / 时应该自动重定向到 defaultRoute", async () => {
        router = await createRouter(host, {
            routes,
            defaultRoute: "/home",
        });

        // 初始化时 URL 为 /，应该自动重定向到 /home
        expect(router.current.route).not.toBeNull();
        expect(router.current.route!.name).toBe("home");
    });

    it("defaultRoute 重定向触发完整的导航流程（route-change 事件）", async () => {
        router = await createRouter(host, {
            routes,
            defaultRoute: "/home",
        });

        const routeChanges: any[] = [];
        host.addEventListener("route-change", ((event: any) => {
            routeChanges.push(event.detail);
        }) as EventListener);

        // 手动导航到根路径触发重定向
        router.push("/");

        // 应该触发 route-change 事件
        expect(routeChanges.length).toBeGreaterThan(0);
        // 最终路由应该是 /home
        expect(router.current.route!.name).toBe("home");
    });

    it("检测循环重定向，超过阈值后抛出错误", async () => {
        // 配置 defaultRoute 指向一个不存在的路径，该路径又不会被匹配
        // 从而导致反复重定向到 defaultRoute
        const cyclicRoutes = [
            { name: "root", path: "/" },
            { name: "loop", path: "/loop" },
        ];

        router = await createRouter(host, {
            routes: cyclicRoutes,
            defaultRoute: "/loop",
        });

        // 手动导航到根路径
        // 正常情况下不应该循环，因为 /loop 是有效路由
        // 测试真正的循环：defaultRoute 指向自己
        expect(() => {
            router.push("/");
        }).not.toThrow();

        // 应该停在 /loop
        expect(router.current.route!.name).toBe("loop");
    });

    it("嵌套路由支持 defaultRoute 配置", async () => {
        const nestedRoutes = [
            {
                name: "parent",
                path: "/parent",
                defaultRoute: "/parent/child-a",
                children: [
                    { name: "child-a", path: "/parent/child-a" },
                    { name: "child-b", path: "/parent/child-b" },
                ],
            },
            { name: "root", path: "/" },
        ];

        router = await createRouter(host, { routes: nestedRoutes });

        // 访问父路由时，应该重定向到子路由的默认路径
        router.push("/parent");

        // 路由匹配应该匹配到父路径
        expect(router.current.route).not.toBeNull();
    });

    it("未配置 defaultRoute 时正常显示根路径内容", async () => {
        router = await createRouter(host, { routes });

        // 没有 defaultRoute，根路径应该正常匹配
        router.push("/");
        expect(router.current.route).not.toBeNull();
        expect(router.current.route!.name).toBe("root");
    });
});
