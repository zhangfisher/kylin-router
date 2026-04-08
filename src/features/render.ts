/**
 * 用于渲染页面的类
 *
 * 主要使用@lit/html来渲染html字符串页面
 *
 */

import { html, render } from "lit";
import type { KylinRouter } from "@/router";
import type { LoadResult, RenderContext, RenderMode, RenderOptions, RouteItem } from "@/types";

export class Render {
    /**
     * 主渲染方法 - 根据 LoadResult 渲染到 outlet（公共方法）
     * @param loadResult - 组件加载结果
     * @param outlet - 目标 outlet 元素
     * @param options - 渲染选项
     */
    async renderToOutlet(
        this: KylinRouter,
        loadResult: LoadResult,
        outlet: HTMLElement,
        options?: RenderOptions,
    ): Promise<void> {
        // 检查加载结果
        if (!loadResult.success) {
            this.renderError(outlet, loadResult.error);
            return;
        }

        // 获取渲染内容
        const content = loadResult.content;
        if (!content) {
            this.renderError(outlet, new Error("No content to render"));
            return;
        }

        // 获取当前路由
        const route = this.router.routes.current.route;
        if (!route) {
            this.renderError(outlet, new Error("No current route"));
            return;
        }

        // 确定渲染模式
        const mode = this.determineRenderMode(outlet, route, options);

        // 根据内容类型分发
        if (typeof content === "string") {
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
        this: KylinRouter,
        template: any,
        _context: RenderContext,
        outlet: HTMLElement,
        mode: RenderMode,
    ): void {
        // 替换模式：清空 outlet
        if (mode === "replace") {
            outlet.innerHTML = "";
        }

        // 使用 lit 的 render 函数渲染
        render(template, outlet);

        // 触发子 outlet 渲染（并行渲染策略）
        this.triggerChildOutletRender(outlet);
    }

    /**
     * 创建渲染上下文（公共方法）
     * @param route - 当前路由对象
     * @returns 渲染上下文
     */
    createRenderContext(this: KylinRouter, route: RouteItem): RenderContext {
        // 创建基础上下文
        const context: RenderContext = {
            router: this.router,
            route: {
                ...route,
                data: route.data || {},
            },
            // 展开 route.data 的所有字段为局部变量（D-04）
            ...(route.data || {}),
        };

        return context;
    }

    /**
     * 编译模板字符串为 lit 模板
     * @param htmlString - HTML 字符串
     * @param _context - 渲染上下文（未使用，使用增强上下文）
     * @returns lit 模板
     */
    private compileTemplate(this: KylinRouter, htmlString: string, _context: RenderContext): any {
        // 创建增强的渲染上下文（包含快捷变量）
        const route = this.router.routes.current.route;
        if (!route) {
            return html`${htmlString}`;
        }

        const enhancedContext = this.createEnhancedContext(route);

        // 使用模板变量插值系统
        return this.interpolateTemplate(htmlString, enhancedContext);
    }

    /**
     * 确定渲染模式
     * @param outlet - outlet 元素
     * @param route - 路由对象
     * @param options - 渲染选项
     * @returns 渲染模式
     */
    private determineRenderMode(
        this: KylinRouter,
        outlet: HTMLElement,
        route: RouteItem,
        options?: RenderOptions,
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
        if (outlet.hasAttribute("data-outlet-append")) {
            return "append";
        }

        return "replace"; // 默认替换模式（D-07）
    }

    /**
     * 渲染 HTML 元素
     * @param elementName - 元素名称
     * @param outlet - 目标 outlet
     * @param mode - 渲染模式
     */
    private renderElement(
        this: KylinRouter,
        elementName: string,
        outlet: HTMLElement,
        mode: RenderMode,
    ): void {
        const element = document.createElement(elementName);

        if (mode === "replace") {
            outlet.innerHTML = "";
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
    private renderError(this: KylinRouter, outlet: HTMLElement, error: Error | null): void {
        const errorMessage = error?.message || "Unknown error";
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
    private triggerChildOutletRender(this: KylinRouter, outlet: HTMLElement): void {
        // 查找子 outlet 元素
        const childOutlets = outlet.querySelectorAll("kylin-outlet");

        // 触发子 outlet 的路由变化事件
        childOutlets.forEach((childOutlet) => {
            const event = new CustomEvent("route-change", {
                detail: {
                    route: this.router.routes.current.route,
                    params: this.router.routes.current.params,
                    query: this.router.routes.current.query,
                },
                bubbles: true,
            });
            childOutlet.dispatchEvent(event);
        });
    }

    /**
     * 模板变量插值系统
     * 支持 ${variable} 语法，自动从上下文中查找变量值
     * @param templateString - 模板字符串
     * @param context - 渲染上下文
     * @returns lit 模板
     */
    private interpolateTemplate(
        this: KylinRouter,
        templateString: string,
        context: RenderContext,
    ): any {
        // 使用正则表达式匹配 ${} 占位符
        const pattern = /\$\{([^}]+)\}/g;

        // 替换所有占位符
        let match;
        const parts: string[] = [];
        let lastIndex = 0;

        while ((match = pattern.exec(templateString)) !== null) {
            // 添加占位符前的文本
            parts.push(templateString.slice(lastIndex, match.index));

            // 获取变量路径
            const variablePath = match[1].trim();

            // 从上下文中获取变量值
            const value = this.getVariableFromContext(context, variablePath);

            // 将值转换为字符串（lit 会自动转义）
            parts.push(String(value ?? ""));

            lastIndex = match.index + match[0].length;
        }

        // 添加剩余文本
        parts.push(templateString.slice(lastIndex));

        // 返回组合后的 HTML 字符串
        return html`${parts.join("")}`;
    }

    /**
     * 从上下文中获取变量值
     * 支持嵌套路径访问：user.name、route.data.userId
     * @param context - 渲染上下文
     * @param path - 变量路径
     * @returns 变量值
     */
    private getVariableFromContext(this: KylinRouter, context: RenderContext, path: string): any {
        // 特殊变量快捷方式
        if (path === "params") {
            return context.route.params || {};
        }
        if (path === "query") {
            return context.route.query || {};
        }
        if (path === "router") {
            return context.router;
        }
        if (path === "route") {
            return context.route;
        }

        // 支持嵌套路径：route.data.userId
        const parts = path.split(".");
        let value: any = context;

        for (const part of parts) {
            if (value == null) {
                return undefined;
            }
            value = value[part];
        }

        return value;
    }

    /**
     * 创建渲染上下文的辅助方法
     * 提供特殊的快捷变量
     * @param route - 当前路由对象
     * @returns 增强的渲染上下文
     */
    private createEnhancedContext(this: KylinRouter, route: RouteItem): RenderContext {
        const baseContext = this.createRenderContext(route);

        // 添加快捷变量
        return {
            ...baseContext,
            params: route.params || {},
            query: route.query || {},
        };
    }
}
