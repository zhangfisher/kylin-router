import type { Update } from "history";
import type { KylinRouteItem } from "./index";
import type { ModalStackItem } from "./routes";

export type KylinRouterEvents = {
    "navigation:start": { path?: string; navigationType?: "push" | "replace" | "pop" };
    "navigation:end": {
        location: Update;
        navigationType: "push" | "replace" | "pop";
    };
    /**
     * 路由表加载完成
     */
    "routes:loaded": undefined;
    "route:updated": {
        route: KylinRouteItem | undefined;
        params: Record<string, string>;
        query: Record<string, string>;
        location: Update;
    };
    "modal:open": {
        route: KylinRouteItem;
        stackItem: ModalStackItem;
    };
    "modal:close": {
        route: KylinRouteItem;
        stackItem: ModalStackItem;
    };
    "data:loading": {
        route: KylinRouteItem;
    };
    "data:loaded": {
        route: KylinRouteItem;
    };
    "data:error": {
        route: KylinRouteItem;
        error: Error;
    };
    "view:loading": {
        route: KylinRouteItem;
    };
    "view:loaded": {
        route: KylinRouteItem;
    };
    "view:error": {
        route: KylinRouteItem;
    };
    /**
     * rvtf
     */
    "hook:error": KylinRouteItem;
};
