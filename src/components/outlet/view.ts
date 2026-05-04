import type { KylinOutlet } from ".";

export class OutletViewLoader {
    outlet: KylinOutlet;
    hash: string;
    container: HTMLElement;
    constructor(outlet: KylinOutlet, hash: string) {
        this.hash = hash;
        this.outlet = outlet;
        this.container = this._createContainer();
    }
    private _createContainer() {
        const container = document.createElement("div");
        container.setAttribute("id", this.hash);
        container.classList.add("kylin-view");
        // 增加Loading指示器
        const loading = document.createElement("kylin-loading");
        container.appendChild(loading);
        this.outlet.appendChild(container);
        return container;
    }
    abort() {
        this.container.remove();
    }
    resolve(view: string | HTMLElement, data: Record<string, any> | undefined) {
        if (data) {
            this.container.setAttribute("x-data", data.hash);
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
        this._removeLoading();
    }
    private _removeLoading() {
        const loading = this.container.querySelector("kylin-loading");
        if (loading) loading.remove();
    }
}
