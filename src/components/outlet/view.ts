import type { KylinOutlet } from ".";
import Alpine from "alpinejs";

export type OutletViewLoaderOptions = {
    viewHash: string;
    dataHash: string | undefined;
    keepAlive?: boolean;
};
export class OutletViewLoader {
    outlet: KylinOutlet;
    container: HTMLElement;
    options: OutletViewLoaderOptions;
    constructor(outlet: KylinOutlet, options?: OutletViewLoaderOptions) {
        this.options = Object.assign(
            {
                keepAlive: false,
            },
            options,
        );
        this.outlet = outlet;
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
            if (this.options.keepAlive) return container;
            container.remove();
        } else {
            container = document.createElement("div");
            container.setAttribute("id", this.viewHash);
            container.classList.add("kylin-view");
            // 注意：不在这里设置 x-data，等到 resolve 时再设置
            // 增加Loading指示器
            this._showLoading(container);
            this.outlet.appendChild(container);
        }
        this.container = container;
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

    resolve(view: string | HTMLElement, data: Record<string, any> | undefined) {
        console.log("[ViewLoader] resolve called:", {
            viewHash: this.viewHash,
            dataHash: this.dataHash,
            hasData: !!data,
            dataKeys: data ? Object.keys(data) : [],
            containerId: this.container.id,
            hasXData: this.container.hasAttribute("x-data"),
        });

        // 先插入视图内容
        if (typeof view === "string") {
            this.container.innerHTML = view;
        } else if (view instanceof HTMLElement) {
            this.container.innerHTML = "";
            this.container.appendChild(view);
        }

        // 关键修改：不在容器上设置 x-data，而是在父元素（kylin-outlet）上设置
        // 这样 Alpine 可以在 outlet 级别初始化，内部所有元素都能访问数据
        if (data && this.dataHash) {
            console.log("[ViewLoader] Setting x-data on parent outlet element");

            // 在 kylin-outlet 上设置 x-data，直接使用 store 的名字
            // Alpine 会自动查找同名的 store
            const outletElement = this.outlet;
            outletElement.setAttribute("x-data", this.dataHash);

            console.log("[ViewLoader] Outlet x-data set to:", this.dataHash);
            console.log("[ViewLoader] Calling Alpine.initTree on outlet");

            // 在 outlet 上初始化 Alpine
            Alpine.initTree(outletElement);
            console.log("[ViewLoader] Alpine.initTree on outlet completed");

            // 验证
            const outletData = (outletElement as any)._x_dataStack;
            console.log("[ViewLoader] Outlet _x_dataStack:", outletData);
        } else {
            console.log("[ViewLoader] No data or dataHash");
        }

        this.outlet.view = this.viewHash;
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
