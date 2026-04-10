---
phase: quick
plan: 260410-fqz
type: execute
wave: 1
depends_on: []
files_modified: [
  "src/types/config.ts",
  "src/router.ts",
  "src/features/loader.ts",
  "src/features/data.ts"
]
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "KylinRouterOptions 支持 viewOptions 全局配置"
    - "KylinRouterOptions 支持 dataOptions 全局配置"
    - "ViewLoader 使用全局 viewOptions 作为默认值"
    - "DataLoader 使用全局 dataOptions 作为默认值"
  artifacts:
    - path: "src/types/config.ts"
      provides: "KylinRouterOptiopns 类型定义"
      contains: "viewOptions 和 dataOptions 可选参数"
    - path: "src/router.ts"
      provides: "KylinRouter 构造函数处理全局选项"
      contains: "传递全局配置给 ViewLoader 和 DataLoader"
    - path: "src/features/loader.ts"
      provides: "ViewLoader 类"
      contains: "支持全局默认选项"
    - path: "src/features/data.ts"
      provides: "DataLoader 类"
      contains: "支持全局默认选项"
  key_links:
    - from: "KylinRouter 构造函数"
      to: "ViewLoader 构造函数"
      via: "传递 options.viewOptions"
      pattern: "new ViewLoader.*viewOptions"
    - from: "KylinRouter 构造函数"
      to: "DataLoader 构造函数"
      via: "传递 options.dataOptions"
      pattern: "new DataLoader.*dataOptions"
---

## Objective

为 `KylinRouterOptiopns` 添加 `viewOptions` 和 `dataOptions` 全局配置选项，使得所有路由可以共享默认的视图和数据加载配置。

**目的：** 避免在每个路由配置中重复设置相同的 `view` 和 `data` 选项，提供全局默认值机制。

**输出：**
- 更新 `KylinRouterOptiopns` 类型定义
- 更新 `ViewLoader` 和 `DataLoader` 以支持全局默认选项
- 确保路由级配置可以覆盖全局配置

## Context

### 相关类型定义

从 `src/types/config.ts`:
```typescript
export type KylinRouterOptiopns = {
    mode?: "hash" | "history";
    base?: string;
    routes: KylinRoutes;
    notFound?: RouteItem;
    defaultRoute?: string;
    onBeforeResolve?: BeforeEachHook;
    onBeforeEach?: BeforeEachHook;
    onAfterEach?: (to: RouteItem, from: RouteItem) => void | Promise<void>;
    onRenderEach?: RenderEachHook | RenderEachHook[];
    debug?: boolean;
    host?: HTMLElement | string;
    defaultErrorComponent?: string | (() => Promise<any>);
    defaultLoadingTemplate?: TemplateResult | string;
    // 需要添加：
    // viewOptions?: RouteViewOptions;
    // dataOptions?: RouteDataOptions;
};
```

从 `src/types/routes.ts`:
```typescript
export interface RouteViewOptions {
    form: RouteViewSource;
    allowUnsafe?: boolean;
    timeout?: number;
    selector?: string;
}

export interface RouteItem {
    // ...
    view?: RouteViewSource | RouteViewOptions;
    data?: RouteDataSource | RouteDataOptions;
}
```

从 `src/types/hooks.ts`:
```typescript
export type RouteDataOptions = {
    from: RouteDataSource;
    timeout?: number;
}
```

### 当前实现

`src/router.ts` 中：
- 构造函数已处理 `options` 参数
- `ViewLoader` 和 `DataLoader` 在 `attach()` 方法中初始化

## Tasks

<task type="auto">
  <name>Task 1: 更新 KylinRouterOptiopns 类型定义</name>
  <files>src/types/config.ts</files>
  <action>
    在 `KylinRouterOptiopns` 类型中添加两个新的可选参数：

    1. `viewOptions?: Omit<RouteViewOptions, 'form'>` - 全局视图加载配置
       - 排除 `form` 字段，因为每个路由有自己的视图源
       - 包含 `allowUnsafe`, `timeout`, `selector` 配置

    2. `dataOptions?: Omit<RouteDataOptions, 'from'>` - 全局数据加载配置
       - 排除 `from` 字段，因为每个路由有自己的数据源
       - 包含 `timeout` 配置

    使用 `Omit` 类型确保不会在全局配置中设置路由特定的 `form` 和 `from` 字段。
  </action>
  <verify>
    <automated>grep -n "viewOptions\|dataOptions" src/types/config.ts</automated>
  </verify>
  <done>
    - `KylinRouterOptiopns` 包含 `viewOptions?: Omit<RouteViewOptions, 'form'>`
    - `KylinRouterOptiopns` 包含 `dataOptions?: Omit<RouteDataOptions, 'from'>`
    - 类型定义编译通过
  </done>
</task>

<task type="auto">
  <name>Task 2: 更新 ViewLoader 支持全局默认选项</name>
  <files>src/features/loader.ts</files>
  <action>
    修改 `ViewLoader` 类以支持全局默认选项：

    1. 在构造函数中接收 `globalViewOptions?: Omit<RouteViewOptions, 'form'>` 参数
    2. 存储为实例属性 `this.globalViewOptions`
    3. 在 `loadView()` 方法中，合并全局选项和路由级选项：
       - 路由级选项优先级高于全局选项
       - 使用对象展开运算符进行浅合并：`{ ...this.globalViewOptions, ...viewOptions }`

    确保不修改传入的选项对象（保持不可变性）。
  </action>
  <verify>
    <automated>grep -n "globalViewOptions\|loadView" src/features/loader.ts | head -20</automated>
  </verify>
  <done>
    - `ViewLoader` 构造函数接受 `globalViewOptions` 参数
    - `loadView()` 方法正确合并全局和路由级选项
    - 路由级选项覆盖全局选项
  </done>
</task>

<task type="auto">
  <name>Task 3: 更新 DataLoader 支持全局默认选项</name>
  <files>src/features/data.ts</files>
  <action>
    修改 `DataLoader` 类以支持全局默认选项：

    1. 在构造函数中接收 `globalDataOptions?: Omit<RouteDataOptions, 'from'>` 参数
    2. 存储为实例属性 `this.globalDataOptions`
    3. 在 `loadData()` 方法中，合并全局选项和路由级选项：
       - 路由级选项优先级高于全局选项
       - 使用对象展开运算符进行浅合并：`{ ...this.globalDataOptions, ...dataOptions }`

    确保不修改传入的选项对象（保持不可变性）。
  </action>
  <verify>
    <automated>grep -n "globalDataOptions\|loadData" src/features/data.ts | head -20</automated>
  </verify>
  <done>
    - `DataLoader` 构造函数接受 `globalDataOptions` 参数
    - `loadData()` 方法正确合并全局和路由级选项
    - 路由级选项覆盖全局选项
  </done>
</task>

<task type="auto">
  <name>Task 4: 更新 KylinRouter 传递全局配置</name>
  <files>src/router.ts</files>
  <action>
    在 `KylinRouter` 类的 `attach()` 方法中：

    1. 修改 `ViewLoader` 初始化，传递全局视图选项：
       ```typescript
       this.viewLoader = new ViewLoader(this, this.options.viewOptions);
       ```

    2. 修改 `DataLoader` 初始化，传递全局数据选项：
       ```typescript
       this.dataLoader = new DataLoader(this, this.options.dataOptions);
       ```

    确保 `this.options` 已包含新增的 `viewOptions` 和 `dataOptions` 字段。
  </action>
  <verify>
    <automated>grep -A2 "new ViewLoader\|new DataLoader" src/router.ts</automated>
  </verify>
  <done>
    - `ViewLoader` 初始化时传递 `this.options.viewOptions`
    - `DataLoader` 初始化时传递 `this.options.dataOptions`
    - 代码编译通过，无类型错误
  </done>
</task>

## Threat Model

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 配置输入 → KylinRouter | 用户提供的全局配置选项 |
| 全局选项 → 路由选项 | 选项合并时的优先级处理 |

### STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-fqz-01 | T | Data/View options | accept | 配置选项仅控制加载行为，不涉及敏感数据，无安全风险 |
| T-quick-fqz-02 | I | Route options | accept | 路由级配置覆盖全局配置是预期行为，无注入风险 |

## Verification

1. **类型检查：** `bun run tsc --noEmit` 通过，无类型错误
2. **代码审查：** 确保选项合并逻辑正确，路由级配置优先于全局配置
3. **向后兼容：** 确保不传递 `viewOptions/dataOptions` 时仍能正常工作（可选参数）

## Success Criteria

- [x] `KylinRouterOptiopns` 类型包含 `viewOptions` 和 `dataOptions` 字段
- [x] `ViewLoader` 支持全局默认选项，并在 `loadView()` 中正确合并
- [x] `DataLoader` 支持全局默认选项，并在 `loadData()` 中正确合并
- [x] `KylinRouter` 在初始化 `ViewLoader` 和 `DataLoader` 时传递全局配置
- [x] 路由级配置优先级高于全局配置
- [x] 向后兼容，不使用全局配置时功能正常
- [x] TypeScript 编译通过，无类型错误

## Output

完成后创建 `.planning/quick/260410-fqz-kylinrouteroptions-viewoptions-dataoptio/260410-fqz-SUMMARY.md`
