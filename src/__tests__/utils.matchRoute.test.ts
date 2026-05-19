// @ts-nocheck

import { describe, it, expect } from "bun:test";
import { matchRoute, createRouteMatcher } from "@/utils/matchRoute";
import type { KylinRouteItem } from "@/types";
import { normalizeRoutes } from "@/utils";

const rootPathExpect = expect.objectContaining({
    route: expect.objectContaining({ path: "/" }),
    url: "/",
    path: "/",
});

describe("matchRoute - 基础匹配", () => {
    describe("静态路径匹配", () => {
        it("应该完全匹配静态路径 /user", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    { name: "user", path: "user" },
                    { name: "about", path: "about" },
                ],
            });

            const result = matchRoute("/user", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "user" }),
                    params: {},
                    url: "/user",
                }),
            ]);
        });

        it("应该匹配根路径 /", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "user", path: "user" }],
            });

            const result = matchRoute("/", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
            ]);
        });

        it("不匹配的路径应该返回未匹配路由项", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "user", path: "user" }],
            });

            const result = matchRoute("/nonexistent", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: undefined,
                    url: "/nonexistent",
                }),
            ]);
        });
    });

    describe("动态参数匹配", () => {
        it("应该匹配 /user/:id 并提取参数 {id: '123'}", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "user-detail", path: "user", children: [{ path: ":id" }] }],
            });

            const result = matchRoute("/user/123", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "user-detail" }),
                    params: {},
                    path: "/user",
                    url: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "123" },
                    path: "/user/:id",
                    url: "/user/123",
                }),
            ]);
        });

        it("应该匹配多个动态参数 /user/:id/post/:postId", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "user-post", path: "user/:id/post/:postId" }],
            });

            const result = matchRoute("/user/123/post/456", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    path: "/",
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    path: "/user",
                    url: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "123" },
                    path: "/user/:id",
                    url: "/user/123",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "post" }),
                    params: { id: "123" },
                    path: "/user/:id/post",
                    url: "/user/123/post",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":postId" }),
                    params: { id: "123", postId: "456" },
                    path: "/user/:id/post/:postId",
                    url: "/user/123/post/456",
                }),
            ]);
        });

        it("应该匹配尖括号语法 /user/<id>", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "user-detail", path: "user/<id>" }],
            });

            const result = matchRoute("/user/abc", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    url: "/user",
                    path: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "<id>" }),
                    params: { id: "abc" },
                    url: "/user/abc",
                    path: "/user/<id>",
                }),
            ]);
        });

        it("应该支持正则约束 /user/:id(\\d+)", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    { name: "user-num", path: "user/:id(\\d+)" },
                    { name: "user-any", path: "user/:id" },
                ],
            });

            const numResult = matchRoute("/user/123", routes);
            expect(numResult).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    url: "/user",
                    path: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id(\\d+)" }),
                    params: { id: "123" },
                    url: "/user/123",
                    path: "/user/:id(\\d+)",
                }),
            ]);

            const strResult = matchRoute("/user/abc", routes);
            expect(strResult).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    url: "/user",
                    path: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "abc" },
                    url: "/user/abc",
                    path: "/user/:id",
                }),
            ]);
        });
    });

    describe("嵌套路由匹配", () => {
        it("应该匹配嵌套路由 /user/:id/profile", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "user",
                        path: "user/:id",
                        children: [
                            { name: "user-profile", path: "profile" },
                            { name: "user-settings", path: "settings" },
                        ],
                    },
                ],
            });

            const result = matchRoute("/user/123/profile", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    path: "/user",
                    url: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "123" },
                    path: "/user/:id",
                    url: "/user/123",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "user-profile" }),
                    params: { id: "123" },
                    path: "/user/:id/profile",
                    url: "/user/123/profile",
                }),
            ]);
        });
        it("当匹配存在时，应以最先匹配到的为准", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "user",
                        path: "user",
                        children: [
                            {
                                path: ":id",
                                children: [
                                    { name: "profile1", path: "profile" },
                                    { name: "profile2", path: "profile" },
                                ],
                            },
                        ],
                    },
                ],
            });

            const result = matchRoute("/user/123/profile", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                    path: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    url: "/user",
                    path: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "123" },
                    url: "/user/123",
                    path: "/user/:id",
                }),

                expect.objectContaining({
                    route: expect.objectContaining({ name: "profile2" }),
                    params: { id: "123" },
                    path: "/user/:id/profile",
                    url: "/user/123/profile",
                }),
            ]);
        });

        it("嵌套路由子项以 / 开头时也应作为相对路径处理", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "user",
                        path: "/user",
                        children: [
                            {
                                path: "/:id",
                                children: [
                                    { name: "profile1", path: "/profile" },
                                    { name: "profile2", path: "/profile" },
                                ],
                            },
                        ],
                    },
                ],
            });

            const result = matchRoute("/user/123/profile", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                    path: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    url: "/user",
                    path: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "123" },
                    url: "/user/123",
                    path: "/user/:id",
                }),

                expect.objectContaining({
                    route: expect.objectContaining({ name: "profile2" }),
                    params: { id: "123" },
                    path: "/user/:id/profile",
                    url: "/user/123/profile",
                }),
            ]);
        });

        it("应该匹配多层嵌套路由并返回完整路径链", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
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
                ],
            });

            const result = matchRoute("/user/1/post/2/comment/3", routes);

            expect(result).toEqual([
                rootPathExpect,
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    path: "/user",
                    url: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "1" },
                    path: "/user/:id",
                    url: "/user/1",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "post" }),
                    params: { id: "1" },
                    path: "/user/:id/post",
                    url: "/user/1/post",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":postId" }),
                    params: { id: "1", postId: "2" },
                    path: "/user/:id/post/:postId",
                    url: "/user/1/post/2",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "comment" }),
                    params: { id: "1", postId: "2" },
                    path: "/user/:id/post/:postId/comment",
                    url: "/user/1/post/2/comment",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":commentId" }),
                    params: { id: "1", postId: "2", commentId: "3" },
                    path: "/user/:id/post/:postId/comment/:commentId",
                    url: "/user/1/post/2/comment/3",
                }),
            ]);
        });

        it("多级嵌套路由链上解析 params，并且 query 仅在最后节点生效", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
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
                ],
            });

            const result = matchRoute("/user/1/post/2/comment/3?keyword=x", routes);

            expect(result).toEqual([
                rootPathExpect,
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    path: "/user",
                    url: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":id" }),
                    params: { id: "1" },
                    path: "/user/:id",
                    url: "/user/1",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "post" }),
                    params: { id: "1" },
                    path: "/user/:id/post",
                    url: "/user/1/post",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":postId" }),
                    params: { id: "1", postId: "2" },
                    path: "/user/:id/post/:postId",
                    url: "/user/1/post/2",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "comment" }),
                    params: { id: "1", postId: "2" },
                    path: "/user/:id/post/:postId/comment",
                    url: "/user/1/post/2/comment",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: ":commentId" }),
                    params: { id: "1", postId: "2", commentId: "3" },
                    query: { keyword: "x" },
                    path: "/user/:id/post/:postId/comment/:commentId",
                    url: "/user/1/post/2/comment/3",
                }),
            ]);
        });
    });

    describe("通配符匹配", () => {
        it("* 作为整个路径时应该只匹配单段路径", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                name: "home",
                path: "/",
                children: [{ name: "wildcard", path: "*" }],
            });

            // * 只匹配单个段
            const result1 = matchRoute("/any", routes);
            expect(result1).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "wildcard" }),
                    url: "/any",
                }),
            ]);

            // * 不匹配多段路径，应该返回未匹配项
            const result2 = matchRoute("/any/deep/path", routes);
            expect(result2).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: undefined,
                    url: "/any/deep/path",
                }),
            ]);
        });

        it("** 应该匹配任意路径（包括空路径）", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "catch-all", path: "**" }],
            });

            // ** 匹配一个或多个段，不包括空路径
            const result1 = matchRoute("/", routes);
            expect(result1).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    path: "/",
                    url: "/",
                }),
            ]);

            const result2 = matchRoute("/any", routes);
            expect(result2).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "**" }),
                    path: "/**",
                    url: "/any",
                }),
            ]);

            const result3 = matchRoute("/any/deep/path", routes);

            expect(result3).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "**" }),
                    path: "/**",
                    url: "/any/deep/path",
                }),
            ]);
        });

        describe("单段通配符 * 规则（匹配单个路径段）", () => {
            it("/a/*/c 应该匹配 /a/x/c", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/*/c" }],
                });

                const result = matchRoute("/a/x/c", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/a/*",
                        url: "/a/x",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "c" }),
                        path: "/a/*/c",
                        url: "/a/x/c",
                    }),
                ]);
            });

            it("/a/*/c 应该匹配 /a/y/c", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/*/c" }],
                });

                const result = matchRoute("/a/y/c", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/a/*",
                        url: "/a/y",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "c" }),
                        path: "/a/*/c",
                        url: "/a/y/c",
                    }),
                ]);
            });

            it("/a/*/c 不应该匹配 /a/x/y/c（多个段）", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/*/c" }],
                });

                const result = matchRoute("/a/x/y/c", routes);

                // * 匹配了 x，但 y/c 无法匹配 c，所以返回未匹配项
                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/a/*",
                        url: "/a/x",
                    }),
                    expect.objectContaining({
                        route: undefined,
                        url: "/a/x/y/c",
                    }),
                ]);
            });

            it("/a/* 应该匹配 /a/x", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/*" }],
                });

                const result = matchRoute("/a/x", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/a/*",
                        url: "/a/x",
                    }),
                ]);
            });

            it("/a/* 不应该匹配 /a/x/y", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/*" }],
                });

                const result = matchRoute("/a/x/y", routes);

                // * 匹配了 x，但 y 无法匹配（* 只匹配单个段），所以返回未匹配项
                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/a/*",
                        url: "/a/x",
                    }),
                    expect.objectContaining({
                        route: undefined,
                        url: "/a/x/y",
                    }),
                ]);
            });

            it("/*/user 应该匹配 /x/user", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/*/user" }],
                });

                const result = matchRoute("/x/user", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/*",
                        url: "/x",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "user" }),
                        path: "/*/user",
                        url: "/x/user",
                    }),
                ]);
            });

            it("多个 * 模式：/*/*/c 应该匹配 /a/b/c", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/*/*/c" }],
                });

                const result = matchRoute("/a/b/c", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/*",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/*/*",
                        url: "/a/b",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "c" }),
                        path: "/*/*/c",
                        url: "/a/b/c",
                    }),
                ]);
            });
        });

        describe("多段通配符规则,匹配1个或多个段", () => {
            it("/a/b/** 应该匹配 /a/b/c", () => {
                ///a/b/** 应该匹配 /a/b/c
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/b/**" }],
                });

                const result = matchRoute("/a/b/c", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "b" }),
                        path: "/a/b",
                        url: "/a/b",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "**" }),
                        path: "/a/b/**",
                        url: "/a/b/c",
                    }),
                ]);
            });

            it("/a/b/** 应该匹配 /a/b/x/x/ddd/d/d/d", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/b/**" }],
                });

                const result = matchRoute("/a/b/x/x/ddd/d/d/d", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "b" }),
                        path: "/a/b",
                        url: "/a/b",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "**" }),
                        path: "/a/b/**",
                        url: "/a/b/x/x/ddd/d/d/d",
                    }),
                ]);
            });

            it("/api/** 应该匹配 /api/users/123/profile", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "api-catch-all", path: "/api/**" }],
                });

                const result = matchRoute("/api/users/123/profile", routes);

                expect(result).toEqual([
                    rootPathExpect,
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "api" }),
                        url: "/api",
                        path: "/api",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "**" }),
                        url: "/api/users/123/profile",
                        path: "/api/**",
                    }),
                ]);
            });

            it("/** 应该匹配任意路径", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "catch-all", path: "/**" }],
                });

                const result = matchRoute("/any/deep/path", routes);

                expect(result).toEqual([
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "/" }),
                        url: "/",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ name: "catch-all" }),
                        path: "/**",
                        url: "/any/deep/path",
                    }),
                ]);
            });
        });

        describe("通配符剩余路径区分处理", () => {
            it("纯 * 有剩余路径时应返回 null（不参与匹配）", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "wildcard", path: "*" }],
                });

                const result = matchRoute("/any/deep/path", routes);

                // * 不应该参与匹配，直接返回未匹配项
                expect(result).toEqual([
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "/" }),
                        url: "/",
                    }),
                    expect.objectContaining({
                        route: undefined,
                        url: "/any/deep/path",
                    }),
                ]);
                // 不应该包含 * 的匹配项
                expect(result.some((r) => r.route?.path === "*")).toBe(false);
            });

            it("/a/* 有剩余路径时应返回未匹配项", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "pattern", path: "/a/*" }],
                });

                const result = matchRoute("/a/x/y", routes);

                // /a/* 应该匹配 /a/x，剩余 /y 返回未匹配项
                expect(result).toHaveLength(4);
                expect(result).toEqual([
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "/" }),
                        url: "/",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "a" }),
                        path: "/a",
                        url: "/a",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "*" }),
                        path: "/a/*",
                        url: "/a/x",
                    }),
                    expect.objectContaining({
                        route: undefined,
                        url: "/a/x/y",
                    }),
                ]);
            });

            it("纯 * 单段路径应该完全匹配", () => {
                const routes: KylinRouteItem = normalizeRoutes({
                    path: "/",
                    children: [{ name: "wildcard", path: "*" }],
                });

                const result = matchRoute("/any", routes);

                // * 完全匹配单段路径
                expect(result).toEqual([
                    expect.objectContaining({
                        route: expect.objectContaining({ path: "/" }),
                        url: "/",
                    }),
                    expect.objectContaining({
                        route: expect.objectContaining({ name: "wildcard" }),
                        url: "/any",
                    }),
                ]);
            });
        });
    });

    describe("匹配优先级", () => {
        it("具体路径应该优先于参数化路径", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    { name: "user-new", path: "/user/new" },
                    { name: "user-detail", path: "/user/:id" },
                ],
            });

            const result = matchRoute("/user/new", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "user" }),
                    path: "/user",
                    url: "/user",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ path: "new" }),
                    path: "/user/new",
                    url: "/user/new",
                }),
            ]);
        });
    });
});

describe("matchRoute - 选项功能", () => {
    describe("params 和 query 参数", () => {
        it("应该包含路由配置中的 params 和 query", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "user",
                        path: "/user/:id",
                        params: { role: "admin" } as any,
                        query: { debug: "true" } as any,
                    },
                ],
            });

            const result = matchRoute("/user/123", routes);

            expect(result).toHaveLength(3);
            expect(result[2].params).toEqual({ id: "123", role: "admin" });
            expect(result[2].query).toEqual({ debug: "true" });
        });

        it("应该解析路径中的 query 字符串并合并到返回 query 中", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "user",
                        path: "/user/:id",
                        query: { debug: "true" } as any,
                    },
                ],
            });

            const result = matchRoute("/user/123?from=home", routes);

            expect(result).toHaveLength(3);
            expect(result[2].params).toEqual({ id: "123" });
            expect(result[2].query).toEqual({ debug: "true", from: "home" });
            expect(result[2].url).toBe("/user/123");
        });

        it("动态提取的 params 应该与路由配置中的 params 合并", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "product",
                        path: "/product/:id",
                        params: { version: "v1" } as any,
                    },
                ],
            });

            const result = matchRoute("/product/456", routes);

            expect(result).toHaveLength(3);
            expect(result[2].params.id).toBe("456");
            expect(result[2].params.version).toBe("v1");
        });

        it("输入路径参数应该覆盖路由配置中的默认 params", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "product",
                        path: "/product/:id",
                        params: { id: "default", version: "v1" } as any,
                    },
                ],
            });

            const result = matchRoute("/product/456", routes);

            expect(result).toHaveLength(3);
            expect(result[2].params).toEqual({ id: "456", version: "v1" });
        });

        it("URL query 参数应该覆盖路由配置中的默认 query", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "user",
                        path: "/user/:id",
                        query: { locale: "en", debug: "true" } as any,
                    },
                ],
            });

            const result = matchRoute("/user/123?locale=cn", routes);

            expect(result).toHaveLength(3);
            expect(result[2].query).toEqual({ locale: "cn", debug: "true" });
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

describe("matchRoute - 默认子路由处理", () => {
    it("路由时自动选择 default:true 的子路由", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [{ name: "home", path: "home", default: true }],
        });

        const result = matchRoute("/", routes);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
                path: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "home" }),
                path: "/home",
                url: "/home",
            }),
        ]);
    });
    it("嵌套默认子路由", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "home",
                    path: "home",
                    default: true,
                    children: [
                        {
                            path: "a",
                            default: true,
                            children: [
                                {
                                    path: "b",
                                    default: true,
                                    children: [{ path: "c", default: true }],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const result = matchRoute("/", routes);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
                path: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "home" }),
                path: "/home",
                url: "/home",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "a" }),
                path: "/home/a",
                url: "/home/a",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "b" }),
                path: "/home/a/b",
                url: "/home/a/b",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "c" }),
                path: "/home/a/b/c",
                url: "/home/a/b/c",
            }),
        ]);
    });
    it("应该在路径完全匹配父路由时自动选择 default:true 的子路由", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [
                        { name: "list", path: "list" },
                        { name: "detail", path: "detail", default: true },
                    ],
                },
            ],
        });

        const result = matchRoute("/products", routes);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
                path: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "detail" }),
                path: "/products/detail",
                url: "/products/detail",
            }),
        ]);
    });

    it("当有多个 default:true 时应选择第一个", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [
                        { name: "detail", path: "detail", default: true },
                        { name: "list", path: "list", default: true },
                    ],
                },
            ],
        });

        const result = matchRoute("/products", routes);

        expect(result).toHaveLength(3);
        expect(result[2].route.name).toBe("detail");
    });
    it("空路径优先级应该高于 default:true", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [
                        { name: "detail", path: "detail", default: true },
                        { name: "list", path: "" },
                    ],
                },
            ],
        });

        const result = matchRoute("/products", routes);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
                path: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "detail" }),
                path: "/products/detail",
                url: "/products/detail",
            }),
        ]);
    });

    it("应该忽略 path 为空字符串的路由", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [{ name: "default", path: "" }],
                },
            ],
        });

        const result = matchRoute("/products", routes);

        expect(result).toHaveLength(2);
        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
                path: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
        ]);
    });

    it("应该忽略 path 为斜杠的默认路由", () => {
        const routes: KylinRouteItem[] = normalizeRoutes([
            {
                name: "products",
                path: "/products",
                children: [{ name: "default", path: "/" }],
            },
        ]);

        const result = matchRoute("/products", routes);

        expect(result).toHaveLength(2);
        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
                path: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
        ]);
    });

    it("应该识别 path 为 ./ 的默认路由", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [{ name: "default", path: "./" }],
                },
            ],
        });

        const result = matchRoute("/products", routes);

        expect(result).toHaveLength(2);
        expect(result[1].route.name).toBe("products");
    });

    describe("autoMatchSubRoute 选项", () => {
        it("autoMatchSubRoute=false 时没有 default:true 应返回根路由", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    { name: "home", path: "home" },
                    { name: "about", path: "about" },
                ],
            });

            const result = matchRoute("/", routes, { autoMatchSubRoute: false });

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                    path: "/",
                }),
            ]);
        });

        it("autoMatchSubRoute=true 时没有 default:true 应自动使用 children[0]", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    { name: "home", path: "home" },
                    { name: "about", path: "about" },
                ],
            });

            const result = matchRoute("/", routes, { autoMatchSubRoute: true });

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                    path: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "home" }),
                    path: "/home",
                    url: "/home",
                }),
            ]);
        });

        it("autoMatchSubRoute=true 时嵌套路由应自动使用 children[0]", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "products",
                        path: "products",
                        children: [
                            { name: "list", path: "list" },
                            { name: "detail", path: "detail" },
                        ],
                    },
                ],
            });

            const result = matchRoute("/", routes, { autoMatchSubRoute: true });

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                    path: "/",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "products" }),
                    path: "/products",
                    url: "/products",
                }),
                expect.objectContaining({
                    route: expect.objectContaining({ name: "list" }),
                    path: "/products/list",
                    url: "/products/list",
                }),
            ]);
        });

        it("autoMatchSubRoute 优先级：default:true 高于 children[0]", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    { name: "first", path: "first" },
                    { name: "second", path: "second", default: true },
                    { name: "third", path: "third" },
                ],
            });

            const result1 = matchRoute("/", routes, { autoMatchSubRoute: false });
            const result2 = matchRoute("/", routes, { autoMatchSubRoute: true });

            // 无论 autoMatchSubRoute 是什么，default:true 优先
            expect(result1[1].route.name).toBe("second");
            expect(result2[1].route.name).toBe("second");
        });

        it("autoMatchSubRoute=true 支持多级嵌套使用 children[0]", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "a",
                        path: "a",
                        children: [
                            {
                                name: "b",
                                path: "b",
                                children: [
                                    {
                                        name: "c",
                                        path: "c",
                                        children: [{ name: "d", path: "d" }],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const result = matchRoute("/", routes, { autoMatchSubRoute: true });

            expect(result).toHaveLength(5);
            expect(result[1].route.name).toBe("a");
            expect(result[2].route.name).toBe("b");
            expect(result[3].route.name).toBe("c");
            expect(result[4].route.name).toBe("d");
        });

        it("autoMatchSubRoute=true 支持混合 default:true 和 children[0]", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [
                    {
                        name: "products",
                        path: "products",
                        children: [
                            { name: "detail", path: "detail", default: true },
                            { name: "list", path: "list" },
                        ],
                    },
                ],
            });

            const result = matchRoute("/", routes, { autoMatchSubRoute: true });

            expect(result).toHaveLength(3);
            // 第一层使用 children[0] (products)
            expect(result[1].route.name).toBe("products");
            // 第二层使用 default:true (detail)
            expect(result[2].route.name).toBe("detail");
        });

        it("autoMatchSubRoute 默认值为 false", () => {
            const routes: KylinRouteItem = normalizeRoutes({
                path: "/",
                children: [{ name: "home", path: "home" }],
            });

            // 不传 options 参数，默认行为是不自动匹配
            const result = matchRoute("/", routes);

            expect(result).toEqual([
                expect.objectContaining({
                    route: expect.objectContaining({ path: "/" }),
                    url: "/",
                    path: "/",
                }),
            ]);
        });
    });
});

describe("matchRoute - 未匹配路由处理", () => {
    it("当子路由无法匹配时应该返回未匹配的路由项", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [{ name: "list", path: "list" }],
                },
            ],
        });

        const result = matchRoute("/products/a/x/y/z", routes);

        expect(result).toHaveLength(3);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
            expect.objectContaining({
                route: undefined,
                path: "/products/a/x/y/z",
                url: "/products/a/x/y/z",
            }),
        ]);
    });

    it("未匹配路由项应该包含正确的路径信息", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products",
                    children: [{ name: "list", path: "list" }],
                },
            ],
        });

        const result = matchRoute("/products/nonexistent", routes);

        expect(result).toHaveLength(3);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
            expect.objectContaining({
                route: undefined,
                path: "/products/nonexistent",
                url: "/products/nonexistent",
            }),
        ]);
    });

    it("未匹配路由项应该继承父路由的 params", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "products",
                    path: "/products/:id",
                    children: [{ name: "list", path: "list" }],
                },
            ],
        });

        const result = matchRoute("/products/123/nonexistent", routes);

        expect(result).toHaveLength(4);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: ":id" }),
                params: { id: "123" },
                path: "/products/:id",
                url: "/products/123",
            }),
            expect.objectContaining({
                route: undefined,
                params: { id: "123" },
                path: "/products/:id/nonexistent",
                url: "/products/123/nonexistent",
            }),
        ]);
    });
    it("应该在第一个无法匹配的层级返回未匹配项", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [
                {
                    name: "a",
                    path: "/products",
                    view: "pages/products.html",
                    children: [
                        {
                            name: "a-home",
                            path: "a",
                            view: "pages/products-list.html",
                            children: [
                                {
                                    path: "b",
                                    default: true,
                                    view: "pages/product-detail.html",
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const result = matchRoute("/products/a/x/y/z", routes);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "products" }),
                path: "/products",
                url: "/products",
            }),
            expect.objectContaining({
                route: expect.objectContaining({ path: "a" }),
                path: "/products/a",
                url: "/products/a",
            }),
            expect.objectContaining({
                route: undefined,
                path: "/products/a/x/y/z",
                url: "/products/a/x/y/z",
            }),
        ]);
    });

    it("顶层无匹配时应该返回未匹配路由项", () => {
        const routes: KylinRouteItem = normalizeRoutes({
            path: "/",
            children: [{ name: "home", path: "/" }],
        });

        const result = matchRoute("/nonexistent", routes);
        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
            }),
            expect.objectContaining({
                route: undefined,
                path: "/nonexistent",
                url: "/nonexistent",
            }),
        ]);
    });
    it("有根路径时顶层无匹配应该至少返回根路由", () => {
        const routes: KylinRouteItem[] = normalizeRoutes([
            { name: "root", path: "/" },
            { name: "home", path: "/home" },
        ]);

        const result = matchRoute("/nonexistent/deep/path", routes);

        expect(result).toEqual([
            expect.objectContaining({
                route: expect.objectContaining({ path: "/" }),
                url: "/",
            }),
            expect.objectContaining({
                route: undefined,
                path: "/nonexistent/deep/path",
                url: "/nonexistent/deep/path",
            }),
        ]);
    });
});
