import type { Update } from "history";
import type { RouteItem } from "./index";
import type { ModalStackItem } from "./routes";

export type KylinRouterEvents = {
    "navigation/start": { path?: string; navigationType?: "push" | "replace" | "pop" };
    "navigation/end": {
        location: Update;
        navigationType: "push" | "replace" | "pop";
    };
    "route/change": {
        route: RouteItem | undefined;
        params: Record<string, string>;
        query: Record<string, string>;
        location: Update;
    };
    "modal/open": {
        route: RouteItem;
        stackItem: ModalStackItem;
    };
    "modal/close": {
        route: RouteItem;
        stackItem: ModalStackItem;
    };
    "data/loading": {
        route: RouteItem;
    };
    "data/loaded": {
        route: RouteItem;
    };
    "view/loading": {
        route: RouteItem;
    };
    "view/loaded": {
        route: RouteItem;
    };
};
