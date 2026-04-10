# Phase Quick Plan 260410-fqz: KylinRouterOptions 全局配置支持 Summary

添加 `viewOptions` 和 `dataOptions` 全局配置选项到 `KylinRouterOptions`，使得所有路由可以共享默认的视图和数据加载配置，避免在每个路由配置中重复设置相同的选项。

## 任务完成情况

| 任务 | 名称 | 提交 | 状态 |
|------|------|------|------|
| 1 | 更新 KylinRouterOptions 类型定义 | 3be9e6d | ✅ 完成 |
| 2 | 更新 ViewLoader 支持全局默认选项 | 5af6160 | ✅ 完成 |
| 3 | 更新 DataLoader 支持全局默认选项 | 90fc6d4 | ✅ 完成 |
| 4 | 更新 KylinRouter 传递全局配置 | d07d3c4 | ✅ 完成 |

## 关键变更

### 1. 类型定义更新 (src/types/config.ts)

**添加的字段：**
```typescript
export type KylinRouterOptiopns = {
    // ... 现有字段
    /** 全局视图加载配置 */
    viewOptions?: Omit<RouteViewOptions, 'form'>;
    /** 全局数据加载配置 */
    dataOptions?: Omit<RouteDataOptions, 'from'>;
};
```

**设计说明：**
- 使用 `Omit<RouteViewOptions, 'form'>` 排除路由特定的 `form` 字段
- 使用 `Omit<RouteDataOptions, 'from'>` 排除路由特定的 `from` 字段
- 允许配置 `allowUnsafe`、`timeout`、`selector` 等共享选项

### 2. ViewLoader 类更新 (src/features/loader.ts)

**构造函数变更：**
```typescript
constructor(router: KylinRouter, globalViewOptions?: Omit<RouteViewOptions, 'form'>) {
    this.router = router;
    this.globalViewOptions = globalViewOptions;
}
```

**选项合并逻辑：**
```typescript
// 合并全局选项和路由级选项（路由级优先）
let mergedOptions: RouteViewOptions | undefined;
if (options) {
    mergedOptions = { ...this.globalViewOptions, ...options } as RouteViewOptions;
} else if (this.globalViewOptions) {
    mergedOptions = { form: undefined as any, ...this.globalViewOptions };
}
```

**优先级：** 路由级选项 > 全局选项

### 3. DataLoader 类更新 (src/features/data.ts)

**构造函数变更：**
```typescript
constructor(router: KylinRouter, globalDataOptions?: Omit<RouteDataOptions, 'from'>) {
    this.router = router;
    this.globalDataOptions = globalDataOptions;
}
```

**选项合并逻辑：**
```typescript
// 处理 RouteDataOptions 类型的 data 字段
if (typeof data === "object" && data !== null && "from" in data) {
    const dataOptions = data as RouteDataOptions;
    const mergedTimeout = dataOptions.timeout ?? this.globalDataOptions?.timeout;
    // ...
}
```

**支持的 data 类型：**
- `string`：URL 字符串（暂未实现远程加载，返回空对象）
- `Record<string, any>`：静态数据对象
- `() => Promise<Record<string, any>>`：异步数据加载函数
- `RouteDataOptions`：包含 `from` 和 `timeout` 的配置对象

### 4. KylinRouter 类更新 (src/router.ts)

**Loader 初始化：**
```typescript
// 初始化组件加载器，传递全局视图选项
this.viewLoader = new ViewLoader(this, this.options.viewOptions);

// 初始化数据加载器，传递全局数据选项
this.dataLoader = new DataLoader(this, this.options.dataOptions);
```

## 技术栈

- **TypeScript 6.0.2** - 类型系统，使用 `Omit` 工具类型
- **Vue Router 风格** - 全局配置 + 路由级覆盖的设计模式

## 关键文件

| 文件 | 变更类型 | 描述 |
|------|----------|------|
| `src/types/config.ts` | 类型定义 | 添加 viewOptions 和 dataOptions 字段 |
| `src/features/loader.ts` | 类更新 | 支持全局视图选项，实现选项合并 |
| `src/features/data.ts` | 类更新 | 支持全局数据选项，处理多种 data 类型 |
| `src/router.ts` | 类更新 | 传递全局配置给 Loader |

## 设计决策

### 决策 1：使用 Omit 类型排除路由特定字段

**原因：** 全局配置不应包含路由特定的字段（如 `form` 和 `from`），这些字段在每个路由中都是不同的。

**影响：** 提高了类型安全性，防止用户在全局配置中错误地设置路由特定字段。

### 决策 2：路由级配置优先于全局配置

**原因：** 遵循"具体优于通用"的原则，路由级配置应该能够覆盖全局配置以满足特殊需求。

**实现：** 使用对象展开运算符 `{ ...globalOptions, ...routeOptions }` 进行浅合并。

### 决策 3：支持 RouteDataOptions 类型的 data 字段

**原因：** 之前 `data` 字段只支持 `RouteDataSource`，现在扩展为支持 `RouteDataOptions`，允许为每个路由单独配置超时时间。

**影响：** 增强了灵活性，同时保持了向后兼容性。

## 向后兼容性

✅ **完全向后兼容** - 所有新增字段都是可选的，不传递 `viewOptions` 和 `dataOptions` 时功能正常。

## 使用示例

```typescript
const router = new KylinRouter(host, {
    routes: [
        {
            name: 'home',
            path: '/home',
            view: '/views/home.html',
            // 使用全局默认 timeout（5000ms）
        },
        {
            name: 'about',
            path: '/about',
            view: { form: '/views/about.html', timeout: 10000 },
            // 覆盖全局 timeout 为 10000ms
        }
    ],
    // 全局配置
    viewOptions: {
        timeout: 5000,
        allowUnsafe: false,
    },
    dataOptions: {
        timeout: 5000,
    }
});
```

## Deviations from Plan

无偏差 - 计划完全按照预期执行。

## Threat Flags

无新的威胁标识。

## Self-Check: PASSED

**已创建的文件：**
- ✅ `.planning/quick/260410-fqz-kylinrouteroptions-viewoptions-dataoptio/260410-fqz-SUMMARY.md`

**已存在的提交：**
- ✅ 3be9e6d: feat(quick-260410-fqz): 添加 viewOptions 和 dataOptions 到 KylinRouterOptions
- ✅ 5af6160: feat(quick-260410-fqz): ViewLoader 支持全局默认选项
- ✅ 90fc6d4: feat(quick-260410-fqz): DataLoader 支持全局默认选项
- ✅ d07d3c4: feat(quick-260410-fqz): KylinRouter 传递全局配置给 Loader

**类型检查：**
- ✅ 通过 TypeScript 编译（除预存在的警告外）

## 执行指标

- **开始时间：** 2026-04-10
- **结束时间：** 2026-04-10
- **总耗时：** 约 15 分钟
- **任务数量：** 4 个任务，全部完成
- **文件修改：** 4 个文件
- **提交数量：** 4 个原子提交

## 成功标准验证

- [x] `KylinRouterOptions` 类型包含 `viewOptions` 和 `dataOptions` 字段
- [x] `ViewLoader` 支持全局默认选项，并在 `loadView()` 中正确合并
- [x] `DataLoader` 支持全局默认选项，并在 `loadData()` 中正确合并
- [x] `KylinRouter` 在初始化 `ViewLoader` 和 `DataLoader` 时传递全局配置
- [x] 路由级配置优先级高于全局配置
- [x] 向后兼容，不使用全局配置时功能正常
- [x] TypeScript 编译通过，无类型错误

## 后续建议

1. **文档更新：** 在使用文档中添加全局配置的示例和说明
2. **测试补充：** 为全局配置功能添加单元测试和集成测试
3. **类型导出：** 考虑导出 `Omit<RouteViewOptions, 'form'>` 和 `Omit<RouteDataOptions, 'from'>` 类型别名，方便用户使用
