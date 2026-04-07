import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { KylinRouter } from "@/router";
import { KylinLinkElement } from "@/components/link";

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
    const host = document.createElement("div") as HTMLElement;
    // @ts-ignore
    document.body.appendChild(host);
    return host;
}

async function createRouter(host: HTMLElement, options: any) {
    const { KylinRouter } = await import("@/router");
    return new KylinRouter(host, options);
}

/**
 * 直接创建 KylinLinkElement 实例
 * happy-dom 不支持 LitElement 的 customElements.define 完整行为，
 * 所以使用 new KylinLinkElement() 而不是 document.createElement。
 * 不需要 appendChild 到 DOM，直接在实例上调用 handleClick 即可测试逻辑。
 */
function createLink(to: string = "", replace: boolean = false): KylinLinkElement {
    const link = new KylinLinkElement();
    link.to = to;
    link.replace = replace;
    return link;
}

describe("KylinLinkElement", () => {
    let host: HTMLElement;
    let router: KylinRouter;

    const routes = [
        { name: "home", path: "/" },
        { name: "user", path: "/user" },
        { name: "settings", path: "/settings" },
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

    describe("内部路由导航", () => {
        it("点击 <kylin-link to=\"/user\"> 应该调用 router.push('/user')", async () => {
            router = await createRouter(host, { routes });

            const link = createLink("/user");
            link.router = router;

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            expect(router.currentRoute).not.toBeNull();
            expect(router.currentRoute!.route.name).toBe("user");
        });

        it("点击 <kylin-link to=\"/user\" replace> 应该调用 router.replace('/user')", async () => {
            router = await createRouter(host, { routes });

            // 先 push 到一个路径建立初始状态
            router.push("/settings");

            const link = createLink("/user", true);
            link.router = router;

            // 监听 navigation-start 事件来验证 replace 类型
            let navType: string | undefined;
            host.addEventListener("navigation-start", ((event: any) => {
                navType = event.detail.navigationType;
            }) as EventListener);

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            expect(navType).toBe("replace");
            expect(router.currentRoute!.route.name).toBe("user");
        });

        it("<kylin-link> 内部路由应该阻止默认的链接跳转行为", async () => {
            router = await createRouter(host, { routes });

            const link = createLink("/user");
            link.router = router;

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            // 内部链接应该调用 preventDefault
            expect(clickEvent.defaultPrevented).toBe(true);
        });

        it("<kylin-link> 应该支持 slot 内容渲染", async () => {
            const link = createLink("/user");

            // 验证组件可以渲染 - 检查 render 方法返回值
            const renderResult = link.render();
            expect(renderResult).toBeDefined();
            // render 返回的 TemplateResult 包含 <a> 标签和 <slot>
        });
    });

    describe("外部链接处理", () => {
        it("点击 <kylin-link to=\"https://external.com\"> 不应使用 router 导航", async () => {
            router = await createRouter(host, { routes });

            // 先建立确定的路由状态
            router.push("/settings");
            const routeBefore = router.currentRoute!.route.name;

            const link = createLink("https://external.com");
            link.router = router;

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            // 外部链接不应该改变路由
            expect(router.currentRoute!.route.name).toBe(routeBefore);
            // 外部链接不应该阻止默认行为（允许浏览器直接跳转）
            expect(clickEvent.defaultPrevented).toBe(false);
        });

        it("点击 <kylin-link to=\"http://example.com\"> 不应使用 router 导航", async () => {
            router = await createRouter(host, { routes });

            // 先建立确定的路由状态
            router.push("/user");
            const routeBefore = router.currentRoute!.route.name;

            const link = createLink("http://example.com");
            link.router = router;

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            expect(router.currentRoute!.route.name).toBe(routeBefore);
            expect(clickEvent.defaultPrevented).toBe(false);
        });
    });

    describe("降级处理", () => {
        it("<kylin-link> 在未获取到 router 实例时应该降级为普通链接", async () => {
            const link = createLink("/user");
            // 不设置 router 实例，模拟降级场景

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            // 没有 router 时不应阻止默认行为（降级为普通 <a> 标签）
            expect(clickEvent.defaultPrevented).toBe(false);
        });
    });

    describe("安全性", () => {
        it("应该拒绝 javascript: 协议的链接", async () => {
            router = await createRouter(host, { routes });

            // 先建立确定的路由状态
            router.push("/user");
            const routeBefore = router.currentRoute!.route.name;

            const link = createLink("javascript:alert('xss')");
            link.router = router;

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            // javascript: 协议应被阻止，路由不变
            expect(router.currentRoute!.route.name).toBe(routeBefore);
            expect(clickEvent.defaultPrevented).toBe(true);
        });

        it("应该拒绝 data: 协议的链接", async () => {
            router = await createRouter(host, { routes });

            // 先建立确定的路由状态
            router.push("/settings");
            const routeBefore = router.currentRoute!.route.name;

            const link = createLink("data:text/html,<h1>test</h1>");
            link.router = router;

            const clickEvent = new Event("click", { cancelable: true });
            link.handleClick(clickEvent);

            expect(router.currentRoute!.route.name).toBe(routeBefore);
            expect(clickEvent.defaultPrevented).toBe(true);
        });
    });
});
