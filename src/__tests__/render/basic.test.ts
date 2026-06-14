import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { KylinRouter } from "@/router";
import { createTestDOM, createRouter, assertRenderInOutlet, RouteEventCollector } from "./common";

describe("基础路由匹配渲染", () => {
    let host: HTMLElement;
    let win: any;
    let router: KylinRouter;

    beforeEach(() => {
        const setup = createTestDOM();
        host = setup.host;
        win = setup.win;
    });

    afterEach(() => {
        if (router) {
            router.detach();
        }
        // @ts-ignore
        if (document && document.body) {
            // @ts-ignore
            document.body.innerHTML = "";
        }
    });

    describe("静态路由渲染", () => {
        it("默认导航到主页", async () => {
            router = await createRouter(host, win, {
                routes: {
                    name: "home",
                    path: "/",
                    view: '<div class="home">Home Page</div>',
                },
            });

            // 在 push 之前创建事件收集器
            const collector = new RouteEventCollector(router);
            // 等待渲染完成
            await new Promise((resolve) => setTimeout(resolve, 150));
            // 使用 router 验证渲染结构
            assertRenderInOutlet(host, router, ".home", "Home Page");
            // 清理事件监听器
            collector.dispose();
        }, 5000000000);
        it("应该正确渲染静态路由", async () => {
            router = await createRouter(host, win, {
                routes: {
                    name: "home",
                    path: "/",
                    view: '<div class="home">Home Page</div>',
                },
            });

            // 在 push 之前创建事件收集器
            const collector = new RouteEventCollector(router);
            // router.push("/");

            // 等待渲染完成
            await new Promise((resolve) => setTimeout(resolve, 150));

            // 使用 router 验证渲染结构
            assertRenderInOutlet(host, router, ".home", "Home Page");

            // 清理事件监听器
            collector.dispose();
        }, 5000000000);
    });

    describe("参数化路由渲染", () => {
        it("应该正确渲染参数化路由", async () => {
            router = await createRouter(host, win, {
                routes: [
                    {
                        name: "user",
                        path: "/user/:id",
                        view: '<div class="user" x-text="`User ${$params.id}`"></div>',
                    },
                ],
            });

            const collector = new RouteEventCollector(router);
            router.push("/user/123");
            await new Promise((resolve) => setTimeout(resolve, 150));

            const userElement = host.querySelector(".user");
            expect(userElement).not.toBeNull();
            expect(userElement!.textContent).toBe("User 123");

            collector.dispose();
        });
        it("应该正确渲染路由参数插值", async () => {
            router = await createRouter(host, win, {
                routes: [
                    {
                        name: "user",
                        path: "/user/:id",
                        view: '<div class="user">User {{ $params.id }}</div>',
                    },
                ],
            });

            const collector = new RouteEventCollector(router);
            router.push("/user/123");
            await new Promise((resolve) => setTimeout(resolve, 150));

            const userElement = host.querySelector(".user");
            expect(userElement).not.toBeNull();
            expect(userElement!.textContent).toBe("User 123");

            collector.dispose();
        });
        it("应该正确渲染多参数路由", async () => {
            router = await createRouter(host, win, {
                routes: [
                    {
                        name: "post",
                        path: "/post/:category/:id",
                        view: '<div class="post" x-text="`Post ${$params.category}/${$params.id}`"></div>',
                    },
                ],
            });

            const collector = new RouteEventCollector(router);
            router.push("/post/tech/42");
            await new Promise((resolve) => setTimeout(resolve, 150));

            const postElement = host.querySelector(".post");
            expect(postElement).not.toBeNull();
            expect(postElement!.textContent).toBe("Post tech/42");

            collector.dispose();
        });

        it("应该正确处理查询参数", async () => {
            router = await createRouter(host, win, {
                routes: [
                    {
                        name: "search",
                        path: "/search",
                        view: '<div class="search" x-text="`Search ${$query.q}`"></div>',
                    },
                ],
            });

            const collector = new RouteEventCollector(router);
            router.push("/search?q=test&page=1");
            await new Promise((resolve) => setTimeout(resolve, 150));

            const searchElement = host.querySelector(".search");
            expect(searchElement).not.toBeNull();
            expect(searchElement!.textContent).toBe("Search test");

            collector.dispose();
        });

        it("应该正确处理导航状态 state 参数", async () => {
            router = await createRouter(host, win, {
                routes: [
                    {
                        name: "user",
                        path: "/user/:id",
                        view: '<div class="user" x-text="`User ${$params.id} from ${$state.from || \'direct\'}`"></div>',
                    },
                ],
            });

            const collector = new RouteEventCollector(router);
            router.push("/user/123", { from: "home", timestamp: Date.now() });
            await new Promise((resolve) => setTimeout(resolve, 150));

            const userElement = host.querySelector(".user");
            expect(userElement).not.toBeNull();
            expect(userElement!.textContent).toBe("User 123 from home");

            collector.dispose();
        });
    });
});

describe("通配符路由匹配渲染", () => {
    let host: HTMLElement;
    let win: any;
    let router: KylinRouter;

    beforeEach(() => {
        const setup = createTestDOM();
        host = setup.host;
        win = setup.win;
    });

    afterEach(() => {
        if (router) {
            router.detach();
        }
        // @ts-ignore
        if (document && document.body) {
            // @ts-ignore
            document.body.innerHTML = "";
        }
    });

    it("应该正确渲染单段通配符路由", async () => {
        router = await createRouter(host, win, {
            routes: [
                { name: "home", path: "/" },
                {
                    name: "catch-all",
                    path: "/*",
                    view: '<div class="catch-all">404 Not Found</div>',
                },
            ],
        });

        const collector = new RouteEventCollector(router);
        router.push("/unknown");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const catchAllElement = host.querySelector(".catch-all");
        expect(catchAllElement).not.toBeNull();

        collector.dispose();
    });

    it("应该正确渲染嵌套通配符路由", async () => {
        router = await createRouter(host, win, {
            routes: [
                {
                    name: "admin",
                    path: "/admin",
                    view: '<div class="admin">Admin <kylin-outlet></kylin-outlet></div>',
                    children: [
                        {
                            name: "admin-catch-all",
                            path: "*",
                            view: '<div class="admin-404">Admin 404</div>',
                        },
                    ],
                },
            ],
        });

        const collector = new RouteEventCollector(router);
        router.push("/admin/unknown");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const adminElement = host.querySelector(".admin");
        const admin404Element = host.querySelector(".admin-404");
        expect(adminElement).not.toBeNull();
        expect(admin404Element).not.toBeNull();

        collector.dispose();
    });

    it("应该正确渲染多段通配符路由", async () => {
        router = await createRouter(host, win, {
            routes: [
                {
                    name: "files",
                    path: "/files/**",
                    view: '<div class="files">Files View</div>',
                },
            ],
        });

        const collector = new RouteEventCollector(router);
        router.push("/files/a/b/c/d");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const filesElement = host.querySelector(".files");
        expect(filesElement).not.toBeNull();

        collector.dispose();
    });
});
