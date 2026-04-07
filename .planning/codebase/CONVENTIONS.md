# 编码约定

**分析日期：** 2026-04-07

## 命名模式

**文件：**
- PascalCase 用于组件文件：`components/base/index.ts`
- camelCase 用于工具文件：`utils/traverseOutlet.ts`
- 统一使用 `.ts` 扩展名

**函数：**
- camelCase 用于所有函数：`_getRouterSync()`、`_requestRouterContext()`、`calculateOutletLevel()`
- 私有函数以下划线前缀开头
- 类方法使用帕斯卡命名构造函数

**变量：**
- camelCase 用于普通变量：`allOutlets`、`maxLevel`
- 私有变量以下划线前缀开头：`_contextRequested`、`_cleanups`
- 类属性使用帕斯卡命名构造函数

**类型：**
- 接口使用 PascalCase：`RouteItem`、`KylinRouterOptiopns`
- 类型别名使用 PascalCase：`OutletRefs`、`ContextCallback`
- 泛型使用描述性名称：`ValueType`、`RouteItem`

## 代码风格

**格式化：**
- 工具：`oxfmt` (Oxlint formatter)
- Tab 宽度：4 空格
- 严格模式：启用所有 TypeScript 严格检查
- 代码检查：`oxlint` 自定义配置

**TypeScript 配置：**
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "experimentalDecorators": true,
  "verbatimModuleSyntax": true
}
```

**规则禁用：**
- `typescript/no-floating-promises`: 禁用
- `typescript/no-redundant-type-constituents`: 禁用

## 设计模式和惯用语法

**组件定义：**
```typescript
@customElement("kylin-outlet")
export class KylinOutletElement extends KylinRouterElementBase {
    static styles = styles;
    
    @property({ type: String, reflect: true })
    path?: string;
    
    @property({ type: Number })
    timeout: number = 5000;
}
```

**基类继承：**
- `KylinRouterElementBase` 为所有路由组件提供基础功能
- 使用 Light DOM 而不是 Shadow DOM：`createRenderRoot() { return this; }`
- 通过 context 获取 router 实例

**Mixin 模式：**
```typescript
export class KylinRouter extends Mixin(Context, Hooks, ComponentLoader, KeepAlive, Transition, Preload) {
    // 混入多个功能模块
}
```

**异步处理：**
- 使用 `Promise<boolean>` 进行导航守卫
- 同步/异步获取 router 实例的双模式支持

**事件处理：**
```typescript
private _requestRouterContext() {
    const contextRequestEvent = new CustomEvent("context-request", {
        context: "KylinRouter",
        contextTarget: this,
        callback: this._contextCallback,
    } as any);
    this.dispatchEvent(contextRequestEvent);
}
```

## 错误处理方法

**错误类型：**
- 构造函数参数验证：`throw new Error("KylinRouter must be initialized with an HTMLElement as host")`
- 路由导航守卫：返回 `boolean | Promise<boolean>`
- 异步加载错误：未显式捕获，依赖 Promise 链式处理

**错误边界：**
- 深层嵌套查找性能测试：验证查找时间合理性
- DOM 层级穿越：使用 while 循环安全遍历父元素
- 内存泄漏防护：使用 `WeakRef` 避免内存泄漏

**类型安全：**
- 严格 TypeScript 模式
- 可选链操作符：`this.router?.push()`
- 类型断言：`(host as any).router = this`

**清理机制：**
```typescript
detach() {
    this._cleanups.forEach((unsubscribe) => unsubscribe());
    this._cleanups = [];
    this.removeContextProvider();
    if (this.host instanceof HTMLElement) {
        delete (this.host as any).router;
    }
}
```

## 文档注释

**TSDoc 模式：**
```typescript
/**
 * KylinRouter 组件基类
 *
 * - 为所有继承此基类的组件提供获取router实例
 * - 使用Light DOM而不是Shadow DOM,以便样式和事件能够穿透到组件内部
 *
 * 使用示例：
 * - 继承此类即可自动获取 router 实例
 * - 在 render() 或其他方法中通过 this.router 访问路由 
 */
```

**参数文档：**
```typescript
/**
 * 同步获取 router 实例
 * 向上遍历 DOM 树，按优先级查找：
 * 1. 具有 data-kylin-router 属性的元素（router 宿主元素）
 * 2. 具有 router 实例的 KylinRouterElementBase 祖先元素
 *
 * @returns router 实例或 undefined
 */
```

**JSDoc 配置：**
- `ignorePrivate: false` - 检查私有成员
- `ignoreReplacesDocs: true` - 忽略重复文档
- `overrideReplacesDocs: true` - 覆盖文档

---

*Convention analysis: 2026-04-07*