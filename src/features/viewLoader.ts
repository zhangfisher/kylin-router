/**
 * Loader 特性 - 组件加载系统
 *
 * 提供本地组件和远程 HTML 的加载能力
 * 支持多种组件格式：HTML 元素名、动态导入函数、远程 URL
 *
 * @module features/loader
 */

import type { KylinRouter } from "@/router";
import type { KylinRouteViewOptions, KylinRouteItem, KylinMatchedRouteItem } from "@/types/routes";
import { asyncSignal, type IAsyncSignal } from "asyncsignal";
import { getRouteVars } from "@/utils/getRouteVars";
import { prefixBaseUrl } from "@/utils/prefixBaseUrl";

/**
 * 类型守卫：检查 view 是否为 ViewOptions
 */
function isViewOptions(view: any): view is KylinRouteViewOptions {
    return typeof view === "object" && view !== null && "from" in view;
}
/**
 * Loader 类 - 负责组件加载逻辑
 */
export class ViewLoader {
    /** AbortController 用于取消加载请求 */
    protected abortController?: AbortController;
    router: KylinRouter;
    /** 全局视图加载配置 */
    protected options: Required<Omit<KylinRouteViewOptions, "from">>;

    constructor(router: KylinRouter) {
        this.router = router;
        this.options = Object.assign(
            { allowUnsafe: true, timepout: 5000, cache: 0 },
            this.router.options.viewOptions,
        ) as Required<Omit<KylinRouteViewOptions, "from">>;
    }
    /**
     * 判断视图缓存是否过期
     * @param view
     * @returns
     */
    private _viewIsExpired(view: KylinRouteItem["_view"]) {
        if (view) {
            return Date.now() - view.timestamp > this.options.cache;
        } else {
            return true;
        }
    }

    private _getRouteViewOptions(matched: KylinMatchedRouteItem) {
        if (!matched.route._viewOptions) {
            matched.route._viewOptions = Object.assign(
                {
                    cache: 0,
                    allowUnsafe: true,
                    timeout: 5000,
                },
                {
                    ...this.options,
                    ...(isViewOptions(matched.route.view)
                        ? matched.route.view
                        : {
                              from: matched.route.view,
                          }),
                },
            ) as Required<KylinRouteViewOptions>;
        }
        return matched.route._viewOptions;
    }
    /**
     * 初始化路由视图缓存
     * @param matched
     */
    private _initRouteViewCache(matched: KylinMatchedRouteItem) {
        if (typeof matched.route._view !== "object") {
            matched.route._view = {
                value: null,
                timestamp: 0,
                signal: null,
                error: null,
            };
        }
    }
    async loadViews(routes: KylinMatchedRouteItem[]) {
        routes.forEach((matched) => {
            const viewOptions = this._getRouteViewOptions(matched);
            this._initRouteViewCache(matched);
            const _view = matched.route._view!;
            // 如果视图过期缓存
            if (viewOptions.cache > 0) {
                if (this._viewIsExpired(_view)) {
                    _view.value = null; // 清空缓存
                } else if (_view.value) {
                    // 使用缓存的视图, 在渲染时可以通过await _view.signal.signal()来获取视图内容
                    _view.signal = asyncSignal.resolve(_view.value);
                    return;
                }
            }
            // 如果信号已存在且正在进行中，则取消
            if (_view.signal?.isPending()) {
                _view.signal.abort();
            }
            this.loadView(matched, viewOptions);
        });
    }

    /**
     * 主加载方法 - 根据 view 类型分发到不同加载策略
     * @param view - 视图源配置（ViewSource）
     * @param options - 视图加载选项（可选）
     * @returns 加载结果的 Promise
     */
    loadView(matched: KylinMatchedRouteItem, viewOptions: Required<KylinRouteViewOptions>) {
        const viewSource =
            typeof viewOptions.from === "function"
                ? viewOptions.from(matched)
                : () => viewOptions.from;

        const _view = matched.route._view as Exclude<KylinRouteItem["_view"], undefined>;

        Promise.resolve(viewSource)
            .then((from) => {
                // 开始新的加载
                _view.signal = asyncSignal();
                // 检测 view 类型，字符串代表url
                if (typeof from === "string") {
                    // 进行URL处理和插值
                    const url = prefixBaseUrl(
                        from.params(getRouteVars(matched)),
                        this.router.options.base,
                    );
                    this.loadRemoteView(url, viewOptions, _view.signal!)
                        .then((result) => {
                            // 加载后的的是一个字符串模板
                            if (typeof result === "string") {
                                _view.value = result;
                                _view.timestamp = Date.now();
                                _view.signal?.resolve(result);
                            }
                        })
                        .catch((e) => {
                            _view.signal?.reject(e);
                            _view.error = e;
                        })
                        .finally(() => {
                            _view.signal?.destroy();
                            _view.signal = null;
                        });
                } else if (from instanceof HTMLElement) {
                    _view.value = from;
                    _view.timestamp = 0; // 静态HTML不需要超时处理
                    _view.signal?.destroy();
                    _view.signal = null;
                }
            })
            .catch((err) => {
                _view.error = err;
            });
    }
    /**
     * 远程 HTML 加载 - 从 URL 获取 HTML 内容
     * @param url - 远程 HTML 的 URL
     * @param routeOptions - 路由级加载选项
     * @param globalOptions - 全局加载选项
     * @returns 加载结果的 Promise
     */
    private loadRemoteView(
        url: string,
        viewOptions: KylinRouteViewOptions,
        signal: IAsyncSignal,
    ): Promise<string | undefined> {
        let tmId: any;
        return new Promise<string | undefined>((resolve, reject) => {
            const { timeout = 0, selector, allowUnsafe } = viewOptions;
            if (timeout > 0) {
                tmId = setTimeout(() => {
                    reject(new Error("Load timeout"));
                }, timeout);
            }
            fetch(url, {
                signal: signal.getAbortSignal(),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `Load view ${url} error: ${response.status} ${response.statusText}`,
                        );
                    }
                    response.text().then((html) => {
                        html = this.extractContent(html, selector);
                        if (!allowUnsafe) {
                            html = this.sanitizeHTML(html);
                        }
                        resolve(html);
                    });
                })
                .catch((e) => {
                    if (e.name === "AbortError") {
                        resolve(undefined);
                    } else {
                        reject(e);
                    }
                })
                .finally(() => {
                    clearTimeout(tmId);
                });
        });
    }

    /**
     * 智能内容提取 - 从 HTML 中提取有效内容
     * @param html - 原始 HTML 字符串
     * @param selector - 自定义选择器（可选）
     * @returns 提取后的内容
     */
    private extractContent(html: string, selector?: string): string {
        // 如果提供了自定义选择器，使用它
        if (selector) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const element = doc.querySelector(selector);
            return element ? element.innerHTML : html;
        }

        // 检查是否包含完整的 HTML 文档
        if (html.includes("<html") || html.includes("<HTML")) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            // 提取 body 内容
            const body = doc.body;
            return body ? body.innerHTML : html;
        }

        // 检查是否有 data-outlet 属性的元素（D-02）
        const outletMatch = html.match(/<[^>]+data-outlet[^>]*>([\s\S]*?)<\/[^>]+>/);
        if (outletMatch) {
            return outletMatch[1];
        }

        // 检查是否有 body 标签（但没有 html 标签）
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            return bodyMatch[1];
        }

        // 返回原始内容
        return html;
    }

    /**
     * 安全清理 - 移除危险的 HTML 元素和属性
     * @param html - 原始 HTML 字符串
     * @returns 清理后的安全 HTML
     */
    private sanitizeHTML(html: string): string {
        // 移除 <script> 标签及其内容
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

        // 移除危险的 HTML 事件处理属性（如 onclick、onerror）
        html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
        html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

        // 移除 javascript: 协议的链接
        html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
        html = html.replace(/href\s*=\s*javascript:[^\s>]*/gi, 'href="#"');

        // 移除 iframe、object、embed 等可能危险的标签
        html = html.replace(/<(iframe|object|embed|form)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "");
        html = html.replace(/<(iframe|object|embed|form)\b[^>]*/gi, "");

        return html;
    }

    /**
     * 清理 AbortController
     */
    cleanup(): void {}
}
