# 快速任务：重构路由视图渲染方式

> **创建时间：** 2026-04-11
> **优先级：** 高
> **预计工时：** 4-6小时
> **状态：** 待执行

## 任务概述

重构 kylin-router 的路由视图渲染机制，从基于 `path` 属性的渲染改为基于路由分层的递归渲染。

## 核心变更

### 1. 移除 kylin-outlet 的 path 属性
- **现状：** kylin-outlet 通过 `path` 属性匹配路由，从 `viewContent` 中读取内容
- **目标：** kylin-outlet 变为纯粹的渲染容器，不再有 path 属性

### 2. 新的路由渲染逻辑
```
根路由渲染：
  在路由表中找到根路由
  → 加载 view 和 data
  → 在 host 内部查找 kylin-outlet
  → 将 view 内容插入到 kylin-outlet 内部
  → RouteItem.el 指向 WeakRef(根 kylin-outlet)

嵌套路由渲染（如 /a/b/c）：
  按路由分层处理（根 → a → b → c）
  → 每层处理：加载 view 和 data
  → 在父路由.el 内部查找 kylin-outlet
  → 将当前层 view 插入
  → RouteItem.el 指向 WeakRef(当前 kylin-outlet)
  → 如有 data 则设置 x-data
  → 递归处理直到最后一层
```

### 3. 自动插入 kylin-outlet
- host 元素初始化时，如果内部没有 kylin-outlet，自动插入一个

## 影响范围

### 需要修改的文件

1. **src/router.ts**
   - 修改 `renderToOutlets()` 方法
   - 新增递归渲染逻辑 `_renderRouteHierarchy()`
   - 修改路由匹配后的事件触发逻辑

2. **src/components/outlet/index.ts**
   - 移除 `path` 属性
   - 简化 `_handleRouteChange` 方法
   - 移除 `_matchesPath` 方法
   - 保留 `renderView` 方法供 Router 调用

3. **src/features/render.ts**
   - 修改 `renderToOutlet` 方法
   - 调整渲染逻辑，不再依赖 path 匹配

4. **src/types/routes.ts**
   - RouteItem 接口新增 `el?: WeakRef<HTMLElement>` 属性

### 不需要修改的文件

- `src/features/loader.ts` - 组件加载逻辑保持不变
- `src/features/data.ts` - 数据加载逻辑保持不变
- `src/features/hooks.ts` - 钩子系统保持不变
- `src/components/link/index.ts` - 链接组件保持不变

## 实施步骤

### Phase 1: 准备工作 (30分钟)

#### Task 1.1: 更新类型定义
- [ ] 在 `src/types/routes.ts` 的 `RouteItem` 接口中添加 `el?: WeakRef<HTMLElement>`
- [ ] 更新相关类型注释

#### Task 1.2: 创建工具函数
- [ ] 在 `src/utils/` 创建 `findOutletInElement.ts`
- [ ] 实现 `findOutletInElement(element: HTMLElement): kylin-outlet | null`
- [ ] 逻辑：在 element 内部深度查找第一个 `kylin-outlet` 元素

### Phase 2: 核心渲染逻辑重构 (2-3小时)

#### Task 2.1: 重构 router.ts 渲染方法
- [ ] 修改 `renderToOutlets()` 方法为 `_renderRouteHierarchy()`
- [ ] 实现递归渲染逻辑：
  ```typescript
  protected async _renderRouteHierarchy(
    matchedRoutes: Array<{route: RouteItem, params: Record<string, string>}>
  ): Promise<void>
  ```
- [ ] 逻辑：
  1. 从 host 开始查找 kylin-outlet
  2. 如果没有找到，自动创建一个
  3. 遍历 matchedRoutes，逐层渲染
  4. 每层：
     - 加载当前层的 view 和 data
     - 在父层的 el 内部查找 kylin-outlet
     - 渲染 view 内容
     - 设置 RouteItem.el = WeakRef(outlet)
     - 如果有 data，设置 x-data

#### Task 2.2: 修改路由更新流程
- [ ] 在 `onRouteUpdate` 中调用 `_renderRouteHierarchy` 而不是 `renderToOutlets`
- [ ] 传递 `matchedRoutes` 而不是单个 route
- [ ] 移除 `findOutlets()` 和 `findOutletByPath()` 方法（不再需要）

### Phase 3: 简化 outlet 组件 (1小时)

#### Task 3.1: 移除 path 属性相关代码
- [ ] 移除 `@property({ type: String, reflect: true }) path?: string`
- [ ] 移除 `_matchesPath()` 方法
- [ ] 简化 `_handleRouteChange` 方法，不再检查 path 匹配

#### Task 3.2: 简化事件监听
- [ ] 保留 `route-change` 事件监听（用于数据更新等场景）
- [ ] 但不再主动触发渲染（渲染由 Router 控制）

### Phase 4: 自动插入 outlet (30分钟)

#### Task 4.1: 实现 auto-insert-outlet 逻辑
- [ ] 在 `attach()` 方法中，检查 host 内部是否有 kylin-outlet
- [ ] 如果没有，自动创建并插入一个
- [ ] 确保这个默认 outlet 在最顶层

### Phase 5: 更新测试和示例 (1小时)

#### Task 5.1: 更新单元测试
- [ ] 修改现有测试，移除 path 相关测试
- [ ] 添加递归渲染的测试用例
- [ ] 测试自动插入 outlet 的逻辑

#### Task 5.2: 更新示例文档
- [ ] 更新 `example/public/app/hooks-demo.html` 等
- [ ] 移除 outlet 的 path 属性使用
- [ ] 添加嵌套路由的示例

## 验证点

### 功能验证
- [ ] 根路由能正确渲染
- [ ] 嵌套路由（如 /a/b/c）能正确分层渲染
- [ ] 每层的 RouteItem.el 正确指向对应的 outlet
- [ ] 数据（x-data）正确设置在对应的 outlet 上
- [ ] host 没有 outlet 时能自动插入

### 性能验证
- [ ] WeakRef 正确使用，不会造成内存泄漏
- [ ] 递归渲染不会造成性能问题
- [ ] 路由切换时旧的路由元素正确清理

### 兼容性验证
- [ ] 现有的导航守卫功能正常
- [ ] 数据加载功能正常
- [ ] 钩子系统功能正常
- [ ] 模态路由功能正常

## 风险评估

### 高风险区域
1. **递归渲染逻辑** - 需要仔细处理边界情况（如 outlet 找不到）
2. **WeakRef 生命周期** - 需要确保 outlet 被移除时，WeakRef 正确失效
3. **事件系统** - 需要确保 route-change 事件仍然能正常触发

### 回滚计划
如果重构出现问题，可以通过 git 快速回滚到重构前的版本。建议：
1. 在开始前创建一个 git 分支：`git checkout -b refactor/outlet-rendering`
2. 每完成一个 Phase 就提交一次
3. 如果某个 Phase 有问题，可以回滚到上一个 Phase 的提交

## 向后兼容性

### 破坏性变更
- **移除 `kylin-outlet` 的 `path` 属性** - 这是一次破坏性变更
- 用户需要移除所有 outlet 上的 `path` 属性

### 迁移指南

**旧代码：**
```html
<kylin-outlet path="/user"></kylin-outlet>
<kylin-outlet path="/user/profile"></kylin-outlet>
```

**新代码：**
```html
<kylin-outlet></kylin-outlet>
<!-- 路由会自动根据嵌套结构渲染到对应的 outlet -->
```

**嵌套路由示例：**
```typescript
const routes = [
  {
    name: 'user',
    path: '/user',
    view: () => import('./UserLayout.js'),
    children: [
      {
        name: 'profile',
        path: 'profile',
        view: () => import('./UserProfile.js'),
      }
    ]
  }
]
```

```html
<!-- UserLayout.js -->
<div class="user-layout">
  <h1>User Layout</h1>
  <kylin-outlet></kylin-outlet>  <!-- 子路由会渲染在这里 -->
</div>
```

## 备注

- **关键约束：** 使用 WeakRef 避免 DOM 元素无法被 GC 回收
- **性能考虑：** 递归渲染时要注意深度，避免过深的嵌套
- **测试覆盖：** 确保所有现有的钩子、数据加载等功能在新的渲染方式下仍然正常工作

## 参考资料

- 当前实现：`src/router.ts` 的 `renderToOutlets()` 方法
- Outlet 组件：`src/components/outlet/index.ts`
- 渲染特性：`src/features/render.ts`
- 路由匹配：`src/features/routes.ts` 的 `matchedRoutes` 逻辑
