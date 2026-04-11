# 执行计划：路由视图渲染重构

## 快速参考

**任务文件：** `.claude/quick-tasks/refactor-outlet-rendering.md`
**创建分支：** `git checkout -b refactor/outlet-rendering`
**预计工时：** 4-6小时

## 5个Phase概览

| Phase | 任务 | 工时 | 关键产出 |
|-------|------|------|----------|
| 1 | 准备工作 | 30min | 类型定义、工具函数 |
| 2 | 核心渲染逻辑 | 2-3h | `_renderRouteHierarchy()` 方法 |
| 3 | 简化outlet组件 | 1h | 移除path属性 |
| 4 | 自动插入outlet | 30min | auto-insert逻辑 |
| 5 | 更新测试示例 | 1h | 测试用例、示例文档 |

## 快速开始

```bash
# 1. 创建分支
git checkout -b refactor/outlet-rendering

# 2. 开始 Phase 1
# 参考详细任务文档：.claude/quick-tasks/refactor-outlet-rendering.md

# 3. 每个 Phase 完成后提交
git add .
git commit -m "refactor(outlet-rendering): phase X - description"

# 4. 完成后合并到主分支
git checkout master
git merge refactor/outlet-rendering
```

## 核心代码结构

### 新增：递归渲染方法

```typescript
// src/router.ts
protected async _renderRouteHierarchy(
  matchedRoutes: Array<{
    route: RouteItem;
    params: Record<string, string>;
    remainingPath: string;
  }>
): Promise<void> {
  let parentElement = this.host;

  for (const match of matchedRoutes) {
    // 查找或创建 outlet
    let outlet = this._findOrCreateOutlet(parentElement);

    // 加载组件和数据
    await this._loadRouteView(match.route);
    await this._loadRouteData(match.route);

    // 渲染到 outlet
    const loadResult = (match.route as any).viewContent;
    await this.renderToOutlet(loadResult, outlet, {
      mode: (match.route as any).renderMode
    });

    // 设置 RouteItem.el
    match.route.el = new WeakRef(outlet);

    // 如果有数据，设置 x-data
    if (match.route.data) {
      (outlet as any).addStore(
        this._generateRouteHash(match.route),
        match.route.data
      );
    }

    // 下一层在当前 outlet 内部查找
    parentElement = outlet;
  }
}

protected _findOrCreateOutlet(parent: HTMLElement): kylin-outlet {
  const outlet = parent.querySelector('kylin-outlet');
  if (outlet) return outlet as any;

  // 自动创建
  const newOutlet = document.createElement('kylin-outlet');
  parent.appendChild(newOutlet);
  return newOutlet as any;
}
```

### 修改：RouteItem 类型

```typescript
// src/types/routes.ts
export interface RouteItem {
  // ... 其他属性
  el?: WeakRef<HTMLElement>;  // 新增：指向渲染的 outlet
}
```

### 简化：Outlet 组件

```typescript
// src/components/outlet/index.ts
@customElement("kylin-outlet")
export class KylinOutletElement extends KylinRouterElementBase {
  // 移除：@property({ type: String, reflect: true }) path?: string;

  private async _handleRouteChange(event: Event) {
    const customEvent = event as CustomEvent;
    const { route } = customEvent.detail;

    // 移除：path 匹配检查
    // 移除：_matchesPath() 调用

    // 保留：数据更新等逻辑（如果需要）
    // 渲染现在由 Router 的 _renderRouteHierarchy 控制
  }
}
```

## 关键验证点

### 功能测试
- [ ] 访问 `/` → 根路由渲染到 host 的 outlet
- [ ] 访问 `/a/b/c` → 三个路由分别渲染到对应的 outlet
- [ ] 每层的 `route.el` 正确指向 outlet
- [ ] 数据正确设置 x-data

### 性能测试
- [ ] WeakRef 不会造成内存泄漏
- [ ] 深层嵌套（5+层）性能可接受
- [ ] 路由切换时旧元素正确清理

### 兼容性测试
- [ ] 导航守卫正常
- [ ] 数据加载正常
- [ ] 钩子系统正常
- [ ] 模态路由正常

## 风险提示

1. **递归深度** - 如果路由嵌套超过10层，可能出现性能问题
2. **outlet 查找** - 如果父组件没有 outlet，需要自动创建
3. **事件系统** - 确保 `route-change` 事件仍然能触发数据更新

## 破坏性变更

**用户需要更新代码：**

```diff
- <kylin-outlet path="/user"></kylin-outlet>
- <kylin-outlet path="/user/profile"></kylin-outlet>
+ <kylin-outlet></kylin-outlet>
```

路由会自动根据嵌套结构渲染到对应的 outlet。

## 下一步

开始执行 Phase 1：准备工作

详细任务清单请查看：`.claude/quick-tasks/refactor-outlet-rendering.md`
