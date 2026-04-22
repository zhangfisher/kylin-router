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

export type KylinRouteDataSource =
    | string
    | Record<string, any>
    | ((route: KylinMatchedRouteItem) => Record<string, any> | Promise<Record<string, any>>);

export type KylinRouteDataOptions = {
    /**
     * 数据来源
     *
     * - string: 一个URL地址，从该地址读取数据，返回一个{}
     * - {}: 静态数据
     * - Function: 返回{}的函数
     */
    from: KylinRouteDataSource;
    /**
     * 加载超时时间，单位毫秒
     * 默认：5000ms
     */
    timeout?: number;
    /**
     *
     * 默认情况下，data会被转为为所有outlet的x-data属性
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
     * 视图缓存时间（毫秒）
     * 默认为 0，表示不缓存
     * 大于 0 表示缓存指定毫秒数，超时后失效
     */
    cache?: number;
    /**
     * 当启用缓存时，缓存的过期时间
     * 默认0代表不过期。
     */
    expires?: number;
    /**
     * 当加载失败时提供一些默认值
     * 加载成功后可以使用Object.assign(default,data)合并，以避免加载数据的缺失
     */
    default?: Record<string, any>;
    /**
     * 是否预加载
     *
     * - true: 在路由实例创建时自动预加载进缓存，这可以加速数据加载
     * - false: 默认值，不预加载
     */
    preload?: boolean;
    hash?: string;
};
