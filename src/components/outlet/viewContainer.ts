import type { KylinOutlet } from ".";

export type ViewContainerOptions = {
    viewHash: string;
    dataHash: string | undefined;
    keepAlive?: boolean;
};
export class ViewContainer {
    outlet: KylinOutlet;
    container: HTMLElement;
    options: ViewContainerOptions;
    /**
     * 标记容器是否为新建（未初始化 Alpine）
     * 用于避免 Alpine 重复初始化
     */
    private _isNewContainer: boolean;
    constructor(outlet: KylinOutlet, options?: ViewContainerOptions) {
        this.options = Object.assign(
            {
                keepAlive: true,
            },
            options,
        );
        this.outlet = outlet;
        this._isNewContainer = false;
        this.container = this._createContainer();
    }
    get viewHash() {
        return this.options.viewHash;
    }
    get dataHash() {
        return this.options.dataHash;
    }
    private _createContainer() {
        let container = this._getContainer() as HTMLElement | null;
        if (container) {
            if (this.options.keepAlive) {
                // 复用已存在的容器，标记为非新建（已初始化过 Alpine）
                this._isNewContainer = false;
                return container;
            }
            container.remove();
        }
        // 创建新容器
        this._isNewContainer = true;
        container = document.createElement("div");
        container.setAttribute("id", this.viewHash);
        container.classList.add("kylin-view");
        this._showLoading(container);
        this.container = container;
        //
        this.outlet.appendChild(container);
        this._active();
        return container;
    }
    private _showLoading(el?: HTMLElement) {
        if (!el) el = this.container;
        let loading = el.querySelector("kylin-loading");
        if (!loading) {
            loading = document.createElement("kylin-loading");
            loading.style.zIndex = "9";
            el.appendChild(loading);
        }
        return loading;
    }
    private _hideLoading(el?: HTMLElement) {
        if (!el) el = this.container;
        const loading = el.querySelector("kylin-loading");
        if (loading) loading.remove();
    }
    private _getContainer() {
        return this.outlet.querySelector(`[id=${this.viewHash}]`);
    }
    private _getContainers() {
        return this.outlet.querySelectorAll(`:scope > .kylin-view`);
    }
    private _active() {
        const views = this._getContainers();
        views.forEach((view) => {
            view.classList.remove("active");
        });
        this.container.classList.add("active");
    }

    abort() {
        this.container.remove();
    }

    resolve(view: string | HTMLElement, data: Record<string, any> | undefined, cssVars?: string[]) {
        // 设置 x-data 属性
        // 有自定义数据函数：使用 dataHash
        // 无自定义数据函数：使用内联空对象，Alpine 会自动创建响应式对象
        // 这样可以确保 x-inject-data 指令能找到当前容器的数据作用域
        if (this.dataHash && data && Object.keys(data).length > 0) {
            // 有数据：使用自己的 dataHash
            this.container.setAttribute("x-data", this.dataHash);
        } else {
            // 使用内联空对象，Alpine 会自动创建响应式对象
            // 按需创建，无预注册内存开销
            // 确保 x-inject-data 指令能找到当前容器的数据作用域
            this.container.setAttribute("x-data", "{}");
        }

        // 设置 scoped CSS 相关属性 自动注入 x-cssvar 指令
        if (cssVars && cssVars.length > 0) {
            this.container.setAttribute("x-cssvar", cssVars.join(", "));
        }

        // 然后插入视图内容
        if (typeof view === "string") {
            this.container.innerHTML = view;
        } else if (view instanceof HTMLElement) {
            this.container.innerHTML = "";
            this.container.appendChild(view);
        }
        // 标记为已初始化（Alpine 初始化由渲染根统一处理）
        this._isNewContainer = false;

        this.outlet.view = this.viewHash;
        return this.container;
    }
    /**
     * 拒绝视图加载，显示错误页面
     * @param error - 错误对象
     * @param errorElement - 已渲染的错误元素（从 router.options.errorPages 获取，必定存在）
     */
    reject(error: any, errorElement: HTMLElement) {
        this.container.innerHTML = "";
        this.container.appendChild(errorElement);
    }
    finally() {
        this._hideLoading();
    }
}
