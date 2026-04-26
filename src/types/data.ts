/**
 * 预加载的数据类型
 * 由 renderEach 钩子填充，组件可以通过 route.data 访问这些数据
 *
 * @remarks
 * 这是一个灵活的数据类型，允许存储任意结构的数据。
 * 建议在具体应用中定义更精确的数据类型以获得更好的类型安全性。
 *
 * @param string - 简单的url数据,从远程加载数据
 * @param Record<string, any> - 任意键值对数据
 * @param () => Record<string, any> | Promise<Record<string, any>> - 支持同步或异步函数返回数据
 */

import type { KylinMatchedRouteItem } from "./routes";
import type { BaseLoaderOptions } from "@/features/baseLoader";

export type KylinRouteDataSource =
    | string
    | Record<string, any>
    | ((route: KylinMatchedRouteItem) => Record<string, any> | Promise<Record<string, any>>);

export interface KylinRouteDataOptions extends BaseLoaderOptions<KylinRouteDataSource> {
    /**
     *
     * 默认情况下，data会被转为为所有outlet的x-data属性，
     * 即使用Alpine.data(data)创建一个局部数据对象
     *
     * 如果store=<string>，则在全局$store创建一个store
     *
     * 如store="auth"
     *
     * 则会使用Alpine.store("auth",data)
     *
     * 这样在整个应用中，就可以使用$store.auth来访问数据了
     *
     */
    store?: string;
    /**
     * 当加载失败时提供一些默认值
     * 加载成功后可以使用Object.assign(default,data)合并，以避免加载数据的缺失
     */
    default?: Record<string, any>;
}
