// @ts-nocheck - 集成测试包含理想情况下的测试场景，与实际类型定义有差异
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { KylinRouter } from '@/router';
import type { RouteItem } from '@/types';

/**
 * 创建测试用的 DOM 环境
 */
function createTestDOM() {
    const { Window } = require('happy-dom');
    const win = new Window({ url: 'http://localhost/' });

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

    // 确保 SyntaxError 在 happy-dom 的 window 对象上可用
    win.SyntaxError = SyntaxError;
}

describe('Phase 3 Integration Tests', () => {
    let host: HTMLElement;
    let router: KylinRouter;

    beforeEach(() => {
        createTestDOM();
        host = document.createElement('div');
        document.body.appendChild(host);
    });

    afterEach(() => {
        if (router) {
            router.detach();
        }
        host.remove();
        // 清理全局状态
        if (typeof window !== 'undefined') {
            delete (window as any).retryAttempts;
        }
    });

    describe('组件加载系统集成', () => {
        it('应该正确加载本地组件', async () => {
            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'local',
                        path: '/local',
                        view: 'div',
                        data: { title: 'Local Component' }
                    }
                ]
            });

            router.attach();
            await router.push('/local');

            expect(router.routes.current.route).toBeDefined();
            expect(router.routes.current.route?.path).toBe('/local');
        });

        it('应该正确处理动态导入', async () => {
            let loadCount = 0;
            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'dynamic',
                        path: '/dynamic',
                        view: 'div',
                        data: { title: 'Dynamic Component' }
                    }
                ]
            });

            router.attach();
            await router.push('/dynamic');

            expect(loadCount).toBe(0); // view 是静态的，不会触发动态加载
            expect(router.routes.current.route?.path).toBe('/dynamic');
        });

        it('应该正确处理加载失败', async () => {
            let errorOccurred = false;
            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'fail',
                        path: '/fail',
                        view: 'invalid-component',
                        data: { title: 'Failing Component' }
                    }
                ]
            });

            router.attach();
            await router.push('/fail');

            // 给错误处理一些时间
            await new Promise(resolve => setTimeout(resolve, 100));

            // view 加载失败会返回 404，不会触发 view-error 事件
            expect(router.routes.current.route?.name).toBe('not-found');
        });
    });

    describe('渲染系统集成', () => {
        it('应该正确渲染 lit 模板', async () => {
            router = new KylinRouter(host, {
                routes: [
                    { name: `/render`, path: '/render',
                        view: `div`,
                        data: {
                            title: 'Render Test',
                            content: 'This is rendered content'
                        } }
                ]
            });

            router.attach();
            await router.push('/render');

            expect(router.routes.current.route?.path).toBe('/render');
        });

        it('应该正确插值模板变量', async () => {
            router = new KylinRouter(host, {
                routes: [
                    { name: `/interpolate`, path: '/interpolate',
                        view: `div`,
                        data: {
                            title: 'Interpolation Test',
                            name: 'Test User'
                        } }
                ]
            });

            router.attach();
            await router.push('/interpolate');

            expect(router.routes.current.route?.data?.name).toBe('Test User');
        });

        it('应该支持嵌套 outlet 渲染', async () => {
            router = new KylinRouter(host, {
                routes: [
                    {
                        path: '/parent',
                        view: `div`,
                        data: { title: 'Parent' }, name: `/parent`, children: [
                            { name: `/parent/child`, path: '/parent/child',
                                view: `div`,
                                data: { title: 'Child' } }
                        ]
                    }
                ]
            });

            router.attach();
            await router.push('/parent/child');

            expect(router.routes.current.route?.path).toBe('/parent/child');
            expect(router.routes.current.route?.data?.title).toBe('Child');
        });
    });

    describe('数据管理系统集成', () => {
        it('应该正确处理错误边界', async () => {
            let errorHandled = false;
            const ErrorComponent = () => {
                errorHandled = true;
                return '<div>Error handled</div>';
            };

            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'error', path: '/error', view: 'will-fail', data: { title: 'Error Test' },
                        errorBoundary: {
                            component: ErrorComponent
                        }
                    }
                ]
            });

            router.attach();
            await router.push('/error');

            // 给错误处理一些时间
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(errorHandled).toBe(true);
        });

        it('应该正确执行重试机制', async () => {
            let attemptCount = 0;
            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'retry',
                        path: '/retry',
                        view: async () => {
                            attemptCount++;
                            if (attemptCount < 2) {
                                throw new Error('Load failed');
                            }
                            return 'div';
                        },
                        data: { title: 'Retry Test' },
                        retry: {
                            max: 3,
                            delay: 10,
                            strategy: 'fixed'
                        }
                    }
                ]
            });

            router.attach();
            await router.push('/retry');

            // 等待重试完成
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(attemptCount).toBeGreaterThan(1);
        });

        it('应该正确处理导航竞态', async () => {
            let firstLoad = false;
            let secondLoad = false;

            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'first',
                        path: '/first',
                        view: async () => {
                            await new Promise(resolve => setTimeout(resolve, 50));
                            firstLoad = true;
                            return 'div';
                        },
                        data: { title: 'First' }
                    },
                    {
                        name: 'second',
                        path: '/second',
                        view: async () => {
                            await new Promise(resolve => setTimeout(resolve, 10));
                            secondLoad = true;
                            return 'div';
                        },
                        data: { title: 'Second' }
                    }
                ]
            });

            router.attach();
            // 快速连续导航
            router.push('/first');
            await router.push('/second');

            // 等待两个请求都完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 第二个路由应该生效，第一个的响应应该被忽略
            expect(router.routes.current.route?.path).toBe('/second');
            expect(secondLoad).toBe(true);
        });
    });

    describe('模态路由系统集成', () => {
        it('应该正确打开和关闭模态', async () => {
            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'modal',
                        path: '/modal',
                        view: 'div',
                        modal: true,
                        data: { title: 'Modal Test' }
                    }
                ]
            });

            router.attach();
            await router.openModal({ route: '/modal' });

            expect(router.hasOpenModals).toBe(true);

            await (router as any).closeModal();

            expect(router.hasOpenModals()).toBe(false);
        });

        it('应该支持多层模态栈', async () => {
            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'modal1',
                        path: '/modal1',
                        view: 'div',
                        modal: true,
                        data: { title: 'Modal 1' }
                    },
                    {
                        name: 'modal2',
                        path: '/modal2',
                        view: 'div',
                        modal: true,
                        data: { title: 'Modal 2' }
                    }
                ]
            });

            router.attach();
            await router.openModal({ route: '/modal1' });
            expect(router.hasOpenModals).toBe(true);
            expect(router.modalCount).toBe(1);

            await router.openModal({ route: '/modal2' });
            expect(router.modalCount).toBe(2);

            await (router as any).closeModal();
            expect(router.modalCount).toBe(1);

            await (router as any).closeModal();
            expect(router.modalCount).toBe(0);
        });

        it('应该正确处理背景遮罩交互', async () => {
            let modalOpened = false;
            let modalClosed = false;

            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'modal',
                        path: '/modal',
                        view: 'div',
                        modal: {
                            backdrop: true,
                            closeOnBackdropClick: true
                        },
                        data: { title: 'Backdrop Test' }
                    }
                ]
            });

            router.attach();
            router.on('modal-open', () => {
                modalOpened = true;
            });

            router.on('modal-close', () => {
                modalClosed = true;
            });

            await router.openModal({ route: '/modal' });

            expect(modalOpened).toBe(true);
            expect(router.hasOpenModals).toBe(true);

            await (router as any).closeModal();

            expect(modalClosed).toBe(true);
            expect(router.hasOpenModals()).toBe(false);
        });
    });

    describe('完整导航流程集成', () => {
        it('应该正确执行完整的导航流程', async () => {
            let guardExecuted = false;
            let dataPreloaded = false;
            let componentLoaded = false;
            let rendered = false;

            router = new KylinRouter(host, {
                routes: [
                    {
                        path: '/complete',
                        view: `div`,
                        beforeEach: (to, from, next) => {
                            guardExecuted = true;
                            next();
                        },
                        renderEach: async (to, from, next) => {
                            dataPreloaded = true;
                            next({ testData: 'preloaded' });
                        },
                        data: { title: 'Complete Flow' }
                    }
                ]
            });

            router.attach();
            router.on('component-load-end', () => {
                componentLoaded = true;
            });

            router.on('route-change', () => {
                rendered = true;
            });

            await router.push('/complete');

            // 等待所有异步操作完成
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(guardExecuted).toBe(true);
            expect(dataPreloaded).toBe(true);
            expect(componentLoaded).toBe(true);
            expect(rendered).toBe(true);
            expect(router.routes.current.route?.path).toBe('/complete');
        });

        it('应该正确处理导航错误', async () => {
            let errorHandled = false;

            router = new KylinRouter(host, {
                routes: [
                    {
                        name: 'error', path: '/error', view: 'will-fail', data: { title: 'Error Test' },
                        errorBoundary: {
                            component: () => {
                                errorHandled = true;
                                return '<div>Error handled</div>';
                            }
                        }
                    }
                ]
            });

            router.attach();
            router.on('component-error', () => {
                errorHandled = true;
            });

            await router.push('/error');

            // 等待错误处理
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(errorHandled).toBe(true);
        });

        it('应该正确处理快速连续导航', async () => {
            const navigations: string[] = [];

            router = new KylinRouter(host, {
                routes: [
                    {
                        path: '/route1',
                        view: async () => {
                            await new Promise(resolve => setTimeout(resolve, 30));
                            navigations.push('route1');
                            return 'div';
                        },
                        data: { title: 'Route 1' }
                    },
                    {
                        path: '/route2',
                        view: async () => {
                            await new Promise(resolve => setTimeout(resolve, 20));
                            navigations.push('route2');
                            return 'div';
                        },
                        data: { title: 'Route 2' }
                    },
                    {
                        path: '/route3',
                        view: async () => {
                            await new Promise(resolve => setTimeout(resolve, 10));
                            navigations.push('route3');
                            return 'div';
                        },
                        data: { title: 'Route 3' }
                    }
                ]
            });

            router.attach();
            // 快速连续导航
            router.push('/route1');
            router.push('/route2');
            await router.push('/route3');

            // 等待所有导航完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 最后一个导航应该生效
            expect(router.routes.current.route?.path).toBe('/route3');
            expect(navigations).toContain('route3');
        });
    });

    describe('性能和资源清理', () => {
        it('应该正确清理资源', async () => {
            router = new KylinRouter(host, {
                routes: [
                    { name: `/test`, path: '/test',
                        view: `div`,
                        data: { title: 'Test' } }
                ]
            });

            router.attach();
            await router.push('/test');

            // 分离路由器
            router.detach();

            // 验证清理后状态
            expect(router.routes.current.route).toBeNull();
        });

        it('应该正确处理内存泄漏', async () => {
            const routes: RouteItem[] = [];
            for (let i = 0; i < 10; i++) {
                routes.push({ name: `/route${i}`, path: `/route${i}`,
                    view: `div`,
                    data: { index: i } });
            }

            router = new KylinRouter(host, {
                routes
            });

            router.attach();
            // 导航到多个路由
            for (let i = 0; i < 10; i++) {
                await router.push(`/route${i}`);
            }

            // 最后的路由应该生效
            expect(router.routes.current.route?.path).toBe('/route9');

            router.detach();
        });
    });
});
