import { describe, it, expect } from "bun:test";
import { matchRoute, createRouteMatcher } from "@/utils/matchRoute";
import type { KylinRouteItem } from "@/types";

describe("matchRoute - 基础匹配", () => {
    describe("静态路径匹配", () => {
        it("应该完全匹配静态路径 /user", () => {
            const routes: KylinRouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
                { name: "about", path: "/about" },
            ];

            const result = matchRoute("/user", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user");
            expect(result[0].params).toEqual({});
            expect(result[0].url).toBe("/user");
        });

        it("应该匹配根路径 /", () => {
            const routes: KylinRouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
            ];

            const result = matchRoute("/", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("home");
            expect(result[0].url).toBe("/");
        });

        it("应该匹配根路径 /", () => {
            const routes: KylinRouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
            ];

            const result = matchRoute("/", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("home");
        });

        it("不匹配的路径应该返回空数组", () => {
            const routes: KylinRouteItem[] = [
                { name: "home", path: "/" },
                { name: "user", path: "/user" },
            ];

            const result = matchRoute("/nonexistent", routes);

            expect(result).toHaveLength(0);
        });
    });

    describe("动态参数匹配", () => {
        it("应该匹配 /user/:id 并提取参数 {id: '123'}", () => {
            const routes: KylinRouteItem[] = [{ name: "user-detail", path: "/user/:id" }];

            const result = matchRoute("/user/123", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user-detail");
            expect(result[0].params).toEqual({ id: "123" });
            expect(result[0].url).toBe("/user/123");
        });

        it("应该匹配多个动态参数 /user/:id/post/:postId", () => {
            const routes: KylinRouteItem[] = [
                { name: "user-post", path: "/user/:id/post/:postId" },
            ];

            const result = matchRoute("/user/123/post/456", routes);

            expect(result).toHaveLength(1);
            expect(result[0].params).toEqual({ id: "123", postId: "456" });
            expect(result[0].url).toBe("/user/123/post/456");
        });

        it("应该匹配尖括号语法 /user/<id>", () => {
            const routes: KylinRouteItem[] = [{ name: "user-detail", path: "/user/<id>" }];

            const result = matchRoute("/user/abc", routes);

            expect(result).toHaveLength(1);
            expect(result[0].params).toEqual({ id: "abc" });
        });

        it("应该支持正则约束 /user/:id(\\d+)", () => {
            const routes: KylinRouteItem[] = [
                { name: "user-num", path: "/user/:id(\\d+)" },
                { name: "user-any", path: "/user/:id" },
            ];

            const numResult = matchRoute("/user/123", routes);
            expect(numResult).toHaveLength(1);
            expect(numResult[0].route.name).toBe("user-num");

            const strResult = matchRoute("/user/abc", routes);
            expect(strResult).toHaveLength(1);
            expect(strResult[0].route.name).toBe("user-any");
        });
    });

    describe("嵌套路由匹配", () => {
        it("应该匹配嵌套路由 /user/:id/profile", () => {
            const routes: KylinRouteItem[] = [
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

            expect(result).toHaveLength(2);
            expect(result[0].route.name).toBe("user");
            expect(result[0].params).toEqual({ id: "123" });
            expect(result[0].url).toBe("/user/123/");
            expect(result[1].route.name).toBe("user-profile");
            expect(result[1].params).toEqual({ id: "123" });
            expect(result[1].url).toBe("/user/123/profile");
        });
        it("当多个顶层匹配存在时，应返回优先级最高的嵌套路由链", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [{ name: "profile1", path: "profile" }],
                },
                {
                    name: "profile2",
                    path: "user/:id/profile",
                },
            ];

            const result = matchRoute("/user/123/profile", routes);

            expect(result).toHaveLength(2);
            expect(result[0].route.name).toBe("user");
        });

        it("应该在子路由不匹配时匹配父路由", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [{ name: "user-profile", path: "profile" }],
                },
            ];

            const result = matchRoute("/user/123", routes, { strict: false });

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user");
            expect(result[0].params).toEqual({ id: "123" });
        });

        it("嵌套路由子项以 / 开头时也应作为相对路径处理", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [{ name: "user-profile", path: "/profile" }],
                },
            ];

            const result = matchRoute("/user/123/profile", routes);

            expect(result).toHaveLength(2);
            expect(result[0].route.name).toBe("user");
            expect(result[1].route.name).toBe("user-profile");
            expect(result[1].params).toEqual({ id: "123" });
        });

        it("应该匹配多层嵌套路由并返回完整路径链", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [
                        {
                            name: "user-post",
                            path: "post/:postId",
                            children: [
                                {
                                    name: "post-comment",
                                    path: "comment/:commentId",
                                },
                            ],
                        },
                    ],
                },
            ];

            const result = matchRoute("/user/1/post/2/comment/3", routes);

            expect(result).toHaveLength(3);
            expect(result[0].route.name).toBe("user");
            expect(result[0].url).toBe("/user/1/");
            expect(result[1].route.name).toBe("user-post");
            expect(result[1].url).toBe("/user/1/post/2/");
            expect(result[2].route.name).toBe("post-comment");
            expect(result[2].params).toEqual({ id: "1", postId: "2", commentId: "3" });
            expect(result[2].url).toBe("/user/1/post/2/comment/3");
        });

        it("多级嵌套路由链上解析 params，并且 query 仅在最后节点生效", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "team",
                    path: "/team/:teamId",
                    children: [
                        {
                            name: "project",
                            path: "project/:projectId",
                            children: [{ name: "task", path: "task/:taskId" }],
                        },
                    ],
                },
            ];

            const result = matchRoute("/team/alpha/project/beta/task/123?show=details", routes);

            expect(result).toHaveLength(3);
            expect(result[0].route.name).toBe("team");
            expect(result[0].params).toEqual({ teamId: "alpha" });
            expect(result[0].query).toEqual({});

            expect(result[1].route.name).toBe("project");
            expect(result[1].params).toEqual({ teamId: "alpha", projectId: "beta" });
            expect(result[1].query).toEqual({});

            expect(result[2].route.name).toBe("task");
            expect(result[2].params).toEqual({ teamId: "alpha", projectId: "beta", taskId: "123" });
            expect(result[2].query).toEqual({ show: "details" });
        });
    });

    describe("通配符匹配", () => {
        it("应该用 * 匹配任意路径（旧版本匹配行为）", () => {
            const routes: KylinRouteItem[] = [
                { name: "home", path: "/" },
                { name: "catch-all", path: "*" },
            ];

            const result = matchRoute("/any/deep/path", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("catch-all");
            expect(result[0].url).toBe("/any/deep/path");
        });

        it("通配符应该匹配空路径", () => {
            const routes: KylinRouteItem[] = [{ name: "catch-all", path: "*" }];

            const result = matchRoute("/", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("catch-all");
        });

        describe("单段通配符 * 规则（匹配单个路径段）", () => {
            it("/a/*/c 应该匹配 /a/x/c", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/*/c" }];

                const result = matchRoute("/a/x/c", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("/a/*/c 应该匹配 /a/y/c", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/*/c" }];

                const result = matchRoute("/a/y/c", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("/a/*/c 不应该匹配 /a/x/y/c（多个段）", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/*/c" }];

                const result = matchRoute("/a/x/y/c", routes);

                expect(result).toHaveLength(0);
            });

            it("/a/* 应该匹配 /a/x", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/*" }];

                const result = matchRoute("/a/x", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("/a/* 不应该匹配 /a/x/y", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/*" }];

                const result = matchRoute("/a/x/y", routes);

                expect(result).toHaveLength(0);
            });

            it("/*/user 应该匹配 /x/user", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/*/user" }];

                const result = matchRoute("/x/user", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("多个 * 模式：/*/*/c 应该匹配 /a/b/c", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/*/*/c" }];

                const result = matchRoute("/a/b/c", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });
        });

        describe("多段通配符 ** 规则（匹配零个或多个段，仅末尾）", () => {
            it("/a/b/** 应该匹配 /a/b/c", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/b/**" }];

                const result = matchRoute("/a/b/c", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("/a/b/** 应该匹配 /a/b/x/x/ddd/d/d/d", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/b/**" }];

                const result = matchRoute("/a/b/x/x/ddd/d/d/d", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("/a/b/** 应该匹配 /a/b（零段情况）", () => {
                const routes: KylinRouteItem[] = [{ name: "pattern", path: "/a/b/**" }];

                const result = matchRoute("/a/b", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("pattern");
            });

            it("/api/** 应该匹配 /api/users/123/profile", () => {
                const routes: KylinRouteItem[] = [{ name: "api-catch-all", path: "/api/**" }];

                const result = matchRoute("/api/users/123/profile", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("api-catch-all");
            });

            it("/** 应该匹配任意路径", () => {
                const routes: KylinRouteItem[] = [{ name: "catch-all", path: "/**" }];

                const result = matchRoute("/any/deep/path", routes);

                expect(result).toHaveLength(1);
                expect(result[0].route.name).toBe("catch-all");
            });
        });
    });

    describe("匹配优先级", () => {
        it("具体路径应该优先于参数化路径", () => {
            const routes: KylinRouteItem[] = [
                { name: "user-new", path: "/user/new" },
                { name: "user-detail", path: "/user/:id" },
            ];

            const result = matchRoute("/user/new", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user-new");
        });
        it("非严格模式下具体路径仍应优先于参数化路径", () => {
            const routes: KylinRouteItem[] = [
                { name: "user-new", path: "/user/new" },
                { name: "user-detail", path: "/user/:id" },
            ];

            const result = matchRoute("/user/new", routes, { strict: false });

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user-new");
        });
        it("参数化路径应该优先于通配符", () => {
            const routes: KylinRouteItem[] = [
                { name: "catch-all", path: "*" },
                { name: "user-detail", path: "/user/:id" },
            ];

            const result = matchRoute("/user/123", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user-detail");
        });
    });

    describe("路径规范化", () => {
        it("/user/ 和 /user 应该被视为相同路径", () => {
            const routes: KylinRouteItem[] = [{ name: "user", path: "/user" }];

            const result1 = matchRoute("/user", routes);
            const result2 = matchRoute("/user/", routes);

            expect(result1).toHaveLength(1);
            expect(result2).toHaveLength(1);
            expect(result1[0].route.name).toBe("user");
            expect(result2[0].route.name).toBe("user");
        });
    });

    describe("大小写不敏感", () => {
        it("/User 和 /user 应该被视为相同路径", () => {
            const routes: KylinRouteItem[] = [{ name: "user", path: "/user" }];

            const result1 = matchRoute("/user", routes);
            const result2 = matchRoute("/User", routes);
            const result3 = matchRoute("/USER", routes);

            expect(result1).toHaveLength(1);
            expect(result2).toHaveLength(1);
            expect(result3).toHaveLength(1);
            expect(result1[0].route.name).toBe("user");
            expect(result2[0].route.name).toBe("user");
            expect(result3[0].route.name).toBe("user");
        });
    });
});

describe("matchRoute - 选项功能", () => {
    describe("strict 选项", () => {
        it("strict=true (默认) 应该完全匹配，子树层级不匹配时不返回父路由", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [{ name: "profile", path: "profile" }],
                },
            ];

            // 严格模式，只匹配完全路径，/user/123 不是完全路由（有子路由）
            const result = matchRoute("/user/123", routes, { strict: true });
            // 在有子路由未匹配的情况下，严格模式返回空
            expect(result).toHaveLength(0);
        });

        it("strict=false 应该支持前缀匹配，返回部分匹配的路由", () => {
            const routes: KylinRouteItem[] = [{ name: "ab", path: "/a/b" }];

            // 非严格模式，允许剩余路径
            const result = matchRoute("/a/b/c", routes, { strict: false });
            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("ab");
        });

        it("strict=false 在有子路由时支持前缀匹配", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [{ name: "profile", path: "profile" }],
                },
            ];

            // 非严格模式，/user/123 匹配但有子路由未匹配，允许返回父路由
            const result = matchRoute("/user/123", routes, { strict: false });
            expect(result).toHaveLength(1);
            expect(result[0].route.name).toBe("user");
        });

        it("strict=false 应该解析 query 并返回完整的嵌套路由链", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    children: [{ name: "profile", path: "profile" }],
                },
            ];

            const result = matchRoute("/user/123/profile?tab=activity", routes, { strict: false });
            expect(result).toHaveLength(2);
            expect(result[0].route.name).toBe("user");
            expect(result[0].path).toBe("/user/:id");
            expect(result[0].query).toEqual({});
            expect(result[1].route.name).toBe("profile");
            expect(result[1].path).toBe("/user/:id/profile");
            expect(result[1].query).toEqual({ tab: "activity" });
        });
    });

    describe("redirect 参数", () => {
        it("匹配的路由如果有 redirect 参数，应该包含在返回的 route 中", () => {
            const routes: KylinRouteItem[] = [
                { name: "old-path", path: "/old", redirect: "/new" },
                { name: "new-path", path: "/new" },
            ];

            const result = matchRoute("/old", routes);

            expect(result).toHaveLength(1);
            expect(result[0].route.redirect).toBe("/new");
        });
    });

    describe("params 和 query 参数", () => {
        it("应该包含路由配置中的 params 和 query", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    params: { role: "admin" } as any,
                    query: { debug: "true" } as any,
                },
            ];

            const result = matchRoute("/user/123", routes);

            expect(result).toHaveLength(1);
            expect(result[0].params).toEqual({ id: "123", role: "admin" });
            expect(result[0].query).toEqual({ debug: "true" });
        });

        it("应该解析路径中的 query 字符串并合并到返回 query 中", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    query: { debug: "true" } as any,
                },
            ];

            const result = matchRoute("/user/123?from=home", routes);

            expect(result).toHaveLength(1);
            expect(result[0].params).toEqual({ id: "123" });
            expect(result[0].query).toEqual({ debug: "true", from: "home" });
            expect(result[0].url).toBe("/user/123");
        });

        it("动态提取的 params 应该与路由配置中的 params 合并", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "product",
                    path: "/product/:id",
                    params: { version: "v1" } as any,
                },
            ];

            const result = matchRoute("/product/456", routes);

            expect(result).toHaveLength(1);
            expect(result[0].params.id).toBe("456");
            expect(result[0].params.version).toBe("v1");
        });

        it("输入路径参数应该覆盖路由配置中的默认 params", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "product",
                    path: "/product/:id",
                    params: { id: "default", version: "v1" } as any,
                },
            ];

            const result = matchRoute("/product/456", routes);

            expect(result).toHaveLength(1);
            expect(result[0].params).toEqual({ id: "456", version: "v1" });
        });

        it("URL query 参数应该覆盖路由配置中的默认 query", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "user",
                    path: "/user/:id",
                    query: { locale: "en", debug: "true" } as any,
                },
            ];

            const result = matchRoute("/user/123?locale=cn", routes);

            expect(result).toHaveLength(1);
            expect(result[0].query).toEqual({ locale: "cn", debug: "true" });
        });
    });
});
describe("matchRoute - 路径信息", () => {
    describe("path 属性", () => {
        it("matched.path 应该包含完整的匹配路径", () => {
            const routes: KylinRouteItem[] = [{ name: "user", path: "/user/:id" }];

            const result = matchRoute("/user/123", routes);

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe("/user/:id");
            expect(result[0].url).toBe("/user/123");
        });

        it("嵌套路由的 path 应该包含完整路径", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "blog",
                    path: "/blog",
                    children: [{ name: "post", path: ":id" }],
                },
            ];

            const result = matchRoute("/blog/hello-world", routes);

            expect(result).toHaveLength(2);
            expect(result[1].route.name).toBe("post");
            expect(result[1].path).toBe("/blog/:id");
            expect(result[1].url).toBe("/blog/hello-world");
        });
    });

    describe("url 属性", () => {
        it("matched.url 应该包含实际匹配的路径（参数已替换）", () => {
            const routes: KylinRouteItem[] = [{ name: "user", path: "/user/:id" }];

            const result = matchRoute("/user/abc", routes);

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe("/user/:id");
            expect(result[0].url).toBe("/user/abc");
        });

        it("matched.url 不应包含 query 参数", () => {
            const routes: KylinRouteItem[] = [{ name: "user", path: "/user/:id" }];

            const result = matchRoute("/user/123?tab=info", routes);

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe("/user/123");
            expect(result[0].query).toEqual({ tab: "info" });
        });

        it("嵌套路由的每层都应该有正确的 url", () => {
            const routes: KylinRouteItem[] = [
                {
                    name: "app",
                    path: "/app",
                    children: [
                        {
                            name: "module",
                            path: ":moduleId",
                            children: [{ name: "item", path: "item/:itemId" }],
                        },
                    ],
                },
            ];

            const result = matchRoute("/app/users/item/42", routes);

            expect(result).toHaveLength(3);
            expect(result[0].url).toBe("/app/");
            expect(result[1].url).toBe("/app/users/");
            expect(result[2].url).toBe("/app/users/item/42");
        });
    });
});

describe("createRouteMatcher", () => {
    it("应该为静态路径创建匹配函数", () => {
        const route: KylinRouteItem = { name: "home", path: "/home" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/home");
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({});
    });

    it("应该为动态路径创建匹配函数并提取参数", () => {
        const route: KylinRouteItem = { name: "user", path: "/user/:id" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/user/42");
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ id: "42" });
    });

    it("应该支持正则约束 /user/:id(\\d+)", () => {
        const route: KylinRouteItem = { name: "user", path: "/user/:id(\\d+)" };
        const matcher = createRouteMatcher(route);

        const numResult = matcher("/user/123");
        expect(numResult.matched).toBe(true);
        expect(numResult.params).toEqual({ id: "123" });

        const strResult = matcher("/user/abc");
        expect(strResult.matched).toBe(false);
    });

    it("不匹配的路径应该返回 matched: false", () => {
        const route: KylinRouteItem = { name: "user", path: "/user" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/other");
        expect(result.matched).toBe(false);
    });

    it("应该支持通配符路径", () => {
        const route: KylinRouteItem = { name: "catch-all", path: "*" };
        const matcher = createRouteMatcher(route);

        const result = matcher("/any/deep/path");
        expect(result.matched).toBe(true);
    });

    it("前缀匹配模式 (isPrefix=true) 应该返回 remainingPath", () => {
        const route: KylinRouteItem = { name: "user", path: "/user/:id" };
        const matcher = createRouteMatcher(route, true);

        const result = matcher("/user/123/profile");
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ id: "123" });
        expect(result.remainingPath).toBe("profile");
    });

    it("前缀匹配模式 should ignore query params and still return remainingPath", () => {
        const route: KylinRouteItem = { name: "user", path: "/user/:id" };
        const matcher = createRouteMatcher(route, true);

        const result = matcher("/user/123/profile?tab=activity");
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ id: "123" });
        expect(result.remainingPath).toBe("profile");
    });
});
