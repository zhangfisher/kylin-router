/**
 * 用于渲染页面的类
 *
 * 主要使用@lit/html来渲染html字符串页面
 *
 */

import { html, render } from 'lit';
import type { KylinRouter } from "@/router";
import type {
    LoadResult,
    RenderContext,
    RenderMode,
    RenderOptions,
    RouteItem
} from "@/types";

export class Render {
    constructor(private router: KylinRouter) {}

    /**
     * 主渲染方法 - 根据 LoadResult 渲染到 outlet
     * @param loadResult - 组件加载结果
     * @param outlet - 目标 outlet 元素
     * @param options - 渲染选项
     */
    async renderToOutlet(
        loadResult: LoadResult,
        outlet: HTMLElement,
        options?: RenderOptions
    ): Promise<void> {
        // 检查加载结果
        if (!loadResult.success) {
            this.renderError(outlet, loadResult.error);
            return;
        }

        // 获取渲染内容
        const content = loadResult.content;
        if (!content) {
            this.renderError(outlet, new Error('No content to render'));
            return;
        }

        // 获取当前路由
        const route = this.router.routes.current.route;
        if (!route) {
            this.renderError(outlet, new Error('No current route'));
            return;
        }

        // 确定渲染模式
        const mode = this.determineRenderMode(outlet, route, options);

        // 根据内容类型分发
        if (typeof content === 'string') {
            // HTML 字符串：可能是元素名或远程 HTML
            if (this.isHtmlElementName(content)) {
                this.renderElement(content, outlet, mode);
            } else {
                // 远程 HTML 内容
                const context = this.createRenderContext(route);
                const template = this.compileTemplate(content, context);
                this.renderTemplate(template, context, outlet, mode);
            }
        } else {
            // TemplateResult：直接渲染
            const context = this.createRenderContext(route);
            this.renderTemplate(content, context, outlet, mode);
        }
    }

    /**
     * 渲染 lit 模板到 outlet
     * @param template - lit 模板
     * @param _context - 渲染上下文（未使用，保留用于未来扩展）
     * @param outlet - 目标 outlet 元素
     * @param mode - 渲染模式
     */
    private renderTemplate(
        template: any,
        _context: RenderContext,
        outlet: HTMLElement,
        mode: RenderMode
    ): void {
        // 替换模式：清空 outlet
        if (mode === 'replace') {
            outlet.innerHTML = '';
        }

        // 使用 lit 的 render 函数渲染
        render(template, outlet);

        // 触发子 outlet 渲染（并行渲染策略）
        this.triggerChildOutletRender(outlet);
    }

    /**
     * 创建渲染上下文
     * @param route - 当前路由对象
     * @returns 渲染上下文
     */
    createRenderContext(route: RouteItem): RenderContext {
        // 创建基础上下文
        const context: RenderContext = {
            router: this.router,
            route: {
                ...route,
                data: route.data || {}
            },
            // 展开 route.data 的所有字段为局部变量（D-04）
            ...(route.data || {})
        };

        return context;
    }

    /**
     * 编译模板字符串为 lit 模板
     * @param htmlString - HTML 字符串
     * @param context - 渲染上下文
     * @returns lit 模板
     */
    private compileTemplate(htmlString: string, context: RenderContext): any {
        // 使用模板变量插值系统
        return this.interpolateTemplate(htmlString, context);
    }

    /**
     * 确定渲染模式
     * @param outlet - outlet 元素
     * @param route - 路由对象
     * @param options - 渲染选项
     * @returns 渲染模式
     */
    private determineRenderMode(
        outlet: HTMLElement,
        route: RouteItem,
        options?: RenderOptions
    ): RenderMode {
        // 优先级：options.mode > route.renderMode > data-outlet-append 属性 > 默认 replace
        if (options?.mode) {
            return options.mode;
        }

        // 使用类型断言访问 renderMode 属性
        if ((route as any).renderMode) {
            return (route as any).renderMode;
        }

        // 检查 data-outlet-append 属性（D-08）
        if (outlet.hasAttribute('data-outlet-append')) {
            return 'append';
        }

        return 'replace'; // 默认替换模式（D-07）
    }

    /**
     * 渲染 HTML 元素
     * @param elementName - 元素名称
     * @param outlet - 目标 outlet
     * @param mode - 渲染模式
     */
    private renderElement(
        elementName: string,
        outlet: HTMLElement,
        mode: RenderMode
    ): void {
        const element = document.createElement(elementName);

        if (mode === 'replace') {
            outlet.innerHTML = '';
            outlet.appendChild(element);
        } else {
            outlet.appendChild(element);
        }

        // 触发子 outlet 渲染
        this.triggerChildOutletRender(outlet);
    }

    /**
     * 渲染错误信息
     * @param outlet - 目标 outlet
     * @param error - 错误对象
     */
    private renderError(outlet: HTMLElement, error: Error | null): void {
        const errorMessage = error?.message || 'Unknown error';
        const errorHtml = html`
            <div class="kylin-render-error">
                <h3>渲染错误</h3>
                <p>${errorMessage}</p>
            </div>
        `;
        render(errorHtml, outlet);
    }

    /**
     * 检查字符串是否为 HTML 元素名
     * @param str - 字符串
     * @returns 是否为元素名
     */
    private isHtmlElementName(str: string): boolean {
        // 简单检查：不包含 <、>、空格等 HTML 特征字符
        return !/[<>\s]/.test(str) && /^[a-z][a-z0-9-]*$/i.test(str);
    }

    /**
     * 触发子 outlet 渲染（并行渲染策略 D-05）
     * @param outlet - 父 outlet 元素
     */
    private triggerChildOutletRender(outlet: HTMLElement): void {
        // 查找子 outlet 元素
        const childOutlets = outlet.querySelectorAll('kylin-outlet');

        // 触发子 outlet 的路由变化事件
        childOutlets.forEach(childOutlet => {
            const event = new CustomEvent('route-change', {
                detail: {
                    route: this.router.routes.current.route,
                    params: this.router.routes.current.params,
                    query: this.router.routes.current.query
                },
                bubbles: true
            });
            childOutlet.dispatchEvent(event);
        });
    }

    /**
     * 模板变量插值（在 Task 3 中实现）
     * @param templateString - 模板字符串
     * @param _context - 渲染上下文（未使用，保留用于未来扩展）
     * @returns lit 模板
     */
    private interpolateTemplate(templateString: string, _context: RenderContext): any {
        // 简单实现：直接返回 HTML 字符串作为 unsafeHTML
        // 在 Task 3 中将实现完整的插值系统
        return html`${templateString}`;
    }
}
