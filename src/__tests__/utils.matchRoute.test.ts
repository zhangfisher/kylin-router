import { describe, it, expect } from "bun:test";
import { matchRoute, createRouteMatcher } from "@/utils/matchRoute";
import type { RouteItem } from "@/types";

describe("matchRoute", () => {
    describe("静态路径匹配", () => {
        it("应该完全匹配静态路径 /user", () => {
            const routes: RouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
                { name: "about", path: "/about" },
            ];

            const result = matchRoute("/user", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("user");
            expect(result!.params).toEqual({});
        });

        it("应该匹配根路径 /", () => {
            const routes: RouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
            ];

            const result = matchRoute("/", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("home");
        });

        it("应该对不匹配的路径返回 null", () => {
            const routes: RouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
            ];

            const result = matchRoute("/nonexistent", routes);

            expect(result).toBeNull();
        });
    });

    describe("动态参数匹配", () => {
        it("应该匹配 /user/:id 并提取参数 {id: '123'}", () => {
            const routes: RouteItem[] = [
                { name: "user-detail", path: "/user/:id" },
            ];

            const result = matchRoute("/user/123", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("user-detail");
            expect(result!.params).toEqual({ id: "123" });
        });

        it("应该匹配多个动态参数 /user/:id/post/:postId", () => {
            const routes: RouteItem[] = [
                { name: "user-post", path: "/user/:id/post/:postId" },
            ];

            const result = matchRoute("/user/123/post/456", routes);

            expect(result).not.toBeNull();
            expect(result!.params).toEqual({ id: "123", postId: "456" });
        });

        it("应该匹配尖括号语法 /user/<id>", () => {
            const routes: RouteItem[] = [
                { name: "user-detail", path: "/user/<id>" },
            ];

            const result = matchRoute("/user/abc", routes);

            expect(result).not.toBeNull();
            expect(result!.params).toEqual({ id: "abc" });
        });
    });

    describe("嵌套路由匹配", () => {
        it("应该匹配嵌套路由 /user/:id/profile", () => {
            const routes: RouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [
                        { name: "user-profile", path: "profile" },
                        { name: "user-settings", path: "settings" },
                    ],
                },
            ];

            const result = matchRoute("/user/123/profile", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("user-profile");
            expect(result!.params).toEqual({ id: "123" });
        });

        it("应该匹配父路由当子路由都不匹配时", () => {
            const routes: RouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [
                        { name: "user-profile", path: "profile" },
                    ],
                },
            ];

            const result = matchRoute("/user/123", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("user");
            expect(result!.params).toEqual({ id: "123" });
        });

        it("应该匹配多层嵌套路由", () => {
            const routes: RouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [
                        {
                            name: "user-post",
                            path: "post/:postId",
                            children: [
                                { name: "post-comment", path: "comment/:commentId" },
                            ],
                        },
                    ],
                },
            ];

            const result = matchRoute("/user/1/post/2/comment/3", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("post-comment");
            expect(result!.params).toEqual({ id: "1", postId: "2", commentId: "3" });
        });
    });

    describe("通配符匹配", () => {
        it("应该用 * 匹配任意路径", () => {
            const routes: RouteItem[] = [
                { name: "home", path: "/" },
                { name: "catch-all", path: "*" },
            ];

            const result = matchRoute("/any/deep/path", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("catch-all");
        });

        it("通配符应该匹配空路径", () => {
            const routes: RouteItem[] = [
                { name: "catch-all", path: "*" },
            ];

            const result = matchRoute("/", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("catch-all");
        });
    });

    describe("匹配优先级", () => {
        it("具体路径应该优先于参数化路径", () => {
            const routes: RouteItem[] = [
                { name: "user-new", path: "/user/new" },
                { name: "user-detail", path: "/user/:id" },
            ];

            const result = matchRoute("/user/new", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("user-new");
        });

        it("参数化路径应该优先于通配符", () => {
            const routes: RouteItem[] = [
                { name: "catch-all", path: "*" },
                { name: "user-detail", path: "/user/:id" },
            ];

            const result = matchRoute("/user/123", routes);

            expect(result).not.toBeNull();
            expect(result!.route.name).toBe("user-detail");
        });

        it("具体路径优先于参数化路径优先于通配符", () => {
            const routes: RouteItem[] = [
                { name: "catch-all", path: "*" },
                { name: "user-detail", path: "/user/:id" },
                { name: "user-list", path: "/user/list" },
            ];

            // 具体路径优先
            const resultList = matchRoute("/user/list", routes);
            expect(resultList!.route.name).toBe("user-list");

            // 参数化路径次之
            const resultDetail = matchRoute("/user/123", routes);
            expect(resultDetail!.route.name).toBe("user-detail");

            // 通配符最后
            const resultAny = matchRoute("/other/path", routes);
            expect(resultAny!.route.name).toBe("catch-all");
        });
    });

    describe("路径规范化", () => {
        it("/user/ 和 /user 应该被视为相同路径", () => {
            const routes: RouteItem[] = [
                { name: "user", path: "/user" },
            ];

            const result1 = matchRoute("/user", routes);
            const result2 = matchRoute("/user/", routes);

            expect(result1).not.toBeNull();
            expect(result2).not.toBeNull();
            expect(result1!.route.name).toBe("user");
            expect(result2!.route.name).toBe("user");
        });
    });

    describe("大小写不敏感", () => {
        it("/User 和 /user 应该被视为相同路径", () => {
            const routes: RouteItem[] = [
                { name: "user", path: "/user" },
            ];

            const result1 = matchRoute("/user", routes);
            const result2 = matchRoute("/User", routes);
            const result3 = matchRoute("/USER", routes);

            expect(result1).not.toBeNull();
            expect(result2).not.toBeNull();
            expect(result3).not.toBeNull();
            expect(result1!.route.name).toBe("user");
            expect(result2!.route.name).toBe("user");
            expect(result3!.route.name).toBe("user");
        });
    });
});

describe("createRouteMatcher", () => {
    it("应该为静态路径创建匹配函数", () => {
        const route: RouteItem = { name: "home", path: "/home" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/home");
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({});
    });

    it("应该为动态路径创建匹配函数并提取参数", () => {
        const route: RouteItem = { name: "user", path: "/user/:id" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/user/42");
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ id: "42" });
    });

    it("应该支持正则约束 /user/:id(\\d+) 仅匹配数字", () => {
        const route: RouteItem = { name: "user", path: "/user/:id(\\d+)" };
        const matcher = createRouteMatcher(route);

        const numResult = matcher("/user/123");
        expect(numResult.matched).toBe(true);
        expect(numResult.params).toEqual({ id: "123" });

        const strResult = matcher("/user/abc");
        expect(strResult.matched).toBe(false);
    });

    it("不匹配的路径应该返回 matched: false", () => {
        const route: RouteItem = { name: "user", path: "/user" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/other");
        expect(result.matched).toBe(false);
    });

    it("应该支持通配符路径", () => {
        const route: RouteItem = { name: "catch-all", path: "*" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/any/deep/path");
        expect(result.matched).toBe(true);
    });
});
