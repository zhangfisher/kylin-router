import type { KylinOutlet } from ".";

export type OutletViewLoaderOptions = {
    hash: string;
    keepAlive?: boolean;
};
export class OutletViewLoader {
    outlet: KylinOutlet;
    hash: string;
    container: HTMLElement;
    options: OutletViewLoaderOptions;
    constructor(outlet: KylinOutlet, options?: OutletViewLoaderOptions) {
        this.options = Object.assign(
            {
                keepAlive: false,
            },
            options,
        );
        const { hash } = this.options;
        this.hash = hash;
        this.outlet = outlet;
        this.container = this._createContainer();
    }
    private _createContainer() {
        let container = this._getContainer() as HTMLElement | null;
        if (container) {
            if (this.options.keepAlive) return container;
            container.remove();
        } else {
            container = document.createElement("div");
            container.setAttribute("id", this.hash);
            container.classList.add("kylin-view");
            // 增加Loading指示器
            const loading = document.createElement("kylin-loading");
            this._showLoading(this.container);
            container.appendChild(loading);
            this.outlet.appendChild(container);
        }
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
        return this.outlet.querySelector(`[id=${this.hash}]`);
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

    resolve(view: string | HTMLElement, data: Record<string, any> | undefined) {
        if (data) {
            this.container.setAttribute("x-data", this.hash);
        } else {
            this.container.removeAttribute("x-data");
        }

        // 插入视图内容到容器
        if (typeof view === "string") {
            this.container.innerHTML = view;
        } else if (view instanceof HTMLElement) {
            this.container.innerHTML = "";
            this.container.appendChild(view);
        }
        this.outlet.view = this.hash;
        return this.container;
    }
    reject(error: any) {
        this.container.innerHTML = `<div style="padding: 20px; background: #fee; color: #c00; border-radius: 4px;">
            <h3>渲染错误</h3>
            <p>${error.message}</p>
        </div>`;
    }
    finally() {
        this._hideLoading();
    }
}
