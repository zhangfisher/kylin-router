import type { KylinMatchedRouteItem } from "./types";

export class KylinRouterError extends Error {
    status: number;
    route?: KylinMatchedRouteItem[];
    constructor(message: string, statusCode?: number, route?: KylinMatchedRouteItem[]) {
        super(message);
        this.status = statusCode || 0;
        this.route = route;
    }
}
