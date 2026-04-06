import type { OutletRefs } from "@/utils/traverseOutlet";
import { createBrowserHistory } from "history";
import type { Update } from "history";
import type { KylinRouterOptiopns } from "./types";
import { Mixin } from "ts-mixer";
import { RouterContext } from "./features";

export class KylinRouter extends Mixin(RouterContext) {
    private _subscribers: Array<() => void> = [];
    host: HTMLElement;
    history = createBrowserHistory();

    outlets?: OutletRefs;

    constructor(host: HTMLElement, options: KylinRouterOptiopns | KylinRouterOptiopns["routes"]) {
        super();
        this.host = host;
        if (host instanceof HTMLElement) {
            this.attachContextProvider();
        } else {
            throw new Error("KylinRouter must be initialized with an HTMLElement as host");
        }
    }
    get location() {
        return this.history.location;
    }
    onRouteUpdate(_location: Update) {}

    push(path: string) {
        this.history.push(path);
    }
    replace(path: string) {
        this.history.replace(path);
    }
    back() {
        this.history.back();
    }
    forward() {
        this.history.forward();
    }
    go(delta: number) {
        this.history.go(delta);
    }
    detach() {
        this._subscribers.forEach((unsubscribe) => unsubscribe());
        this._subscribers = [];
        this.removeContextProvider();
    }
    attach() {
        this._subscribers.push(this.history.listen(this.onRouteUpdate.bind(this)));
        this.attachContextProvider();
    }
}
