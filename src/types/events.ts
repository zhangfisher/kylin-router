import type { Update } from "history";
import type { RouteItem } from "./index";

export type KylinRouterEvents = {
    "navigation-start": { path?: string; navigationType?: "push" | "replace" | "pop" };
    "route-change": {
        route: RouteItem | undefined;
        params: Record<string, string>;
        query: Record<string, string>;
        location: Update;
    };
    "navigation-end": {
        location: Update;
        navigationType: "push" | "replace" | "pop";
    };
};
