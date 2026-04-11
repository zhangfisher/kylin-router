# 路由渲染流程对比

## 当前实现（基于 path 属性）

```
URL: /user/profile

┌─────────────────────────────────────┐
│ Host Element                        │
│                                     │
│  <kylin-outlet path="/user">        │ ← 通过 path 匹配路由
│    └─ UserLayout                    │
│       <kylin-outlet path="/user/profile"> ← 通过 path 匹配
│         └─ UserProfile              │
│       </kylin-outlet>               │
│  </kylin-outlet>                    │
│                                     │
│  <kylin-outlet path="/post">        │ ← 不匹配，不渲染
│  </kylin-outlet>                    │
└─────────────────────────────────────┘

问题：
- 需要 path 属性匹配路由
- 路由配置和 DOM 结构耦合
- 渲染逻辑分散在各个 outlet 中
```

## 新实现（递归渲染）

```
URL: /user/profile

路由匹配结果：
matchedRoutes = [
  { route: UserLayout, params: {}, remainingPath: '/profile' },
  { route: UserProfile, params: {}, remainingPath: '' }
]

渲染流程：

Step 1: 查找 host 中的 outlet
┌─────────────────────────────────────┐
│ Host Element                        │
│  <kylin-outlet>  ← 找到这个          │
│  </kylin-outlet>                    │
└─────────────────────────────────────┘

Step 2: 渲染第一层（UserLayout）
┌─────────────────────────────────────┐
│ Host Element                        │
│  <kylin-outlet>                     │
│    └─ UserLayout                    │ ← 渲染 UserLayout
│       <kylin-outlet>  ← 查找这个     │
│       </kylin-outlet>               │
│  </kylin-outlet>                    │
│                                     │
│ RouteItem.el = WeakRef(outlet)      │ ← 设置引用
└─────────────────────────────────────┘

Step 3: 渲染第二层（UserProfile）
┌─────────────────────────────────────┐
│ Host Element                        │
│  <kylin-outlet>                     │
│    └─ UserLayout                    │
│       <kylin-outlet>                │
│         └─ UserProfile              │ ← 渲染 UserProfile
│       </kylin-outlet>               │
│  </kylin-outlet>                    │
│                                     │
│ UserLayout.el = WeakRef(outlet1)    │
│ UserProfile.el = WeakRef(outlet2)   │ ← 设置引用
└─────────────────────────────────────┘

优势：
- 不需要 path 属性
- 路由配置独立于 DOM 结构
- 渲染逻辑集中在 Router 中
- 支持自动创建 outlet
```

## 递归渲染伪代码

```typescript
async _renderRouteHierarchy(matchedRoutes) {
  let parentElement = this.host;

  for (const match of matchedRoutes) {
    // 1. 查找或创建 outlet
    let outlet = parentElement.querySelector('kylin-outlet');

    if (!outlet) {
      // 自动创建
      outlet = document.createElement('kylin-outlet');
      parentElement.appendChild(outlet);
    }

    // 2. 加载组件和数据
    await this._loadRouteView(match.route);
    await this._loadRouteData(match.route);

    // 3. 渲染到 outlet
    const content = match.route.viewContent;
    await this.renderToOutlet(content, outlet, {
      mode: match.route.renderMode
    });

    // 4. 设置引用
    match.route.el = new WeakRef(outlet);

    // 5. 设置数据（如果有）
    if (match.route.data) {
      outlet.set('x-data', match.route.data);
    }

    // 6. 下一层在当前 outlet 内部查找
    parentElement = outlet;
  }
}
```

## 数据流对比

### 当前实现

```
Router.onRouteUpdate()
  ↓
触发 route-change 事件
  ↓
所有 outlet 监听事件
  ↓
每个 outlet 检查 path 是否匹配
  ↓
匹配的 outlet 渲染内容
```

### 新实现

```
Router.onRouteUpdate()
  ↓
获取 matchedRoutes
  ↓
递归渲染每一层
  ↓
每层：查找/创建 outlet → 渲染 → 设置引用
  ↓
完成（不需要触发事件）
```

## 内存管理

### WeakRef 的作用

```typescript
// 旧实现（可能造成内存泄漏）
route.outlet = outletElement;  // 强引用，outlet 无法被 GC

// 新实现（使用 WeakRef）
route.el = new WeakRef(outletElement);  // 弱引用
// 当 outlet 被移除时，WeakRef 自动失效，允许 GC 回收
```

### 生命周期

```
1. 路由渲染：route.el = new WeakRef(outlet)
2. 路由切换：旧 outlet 被移除
3. WeakRef 自动失效：route.el.deref() 返回 undefined
4. GC 回收：outlet 元素被回收
5. 内存释放：无内存泄漏
```

## 错误处理

### 找不到 outlet

```typescript
let outlet = parentElement.querySelector('kylin-outlet');

if (!outlet) {
  // 自动创建一个
  outlet = document.createElement('kylin-outlet');
  parentElement.appendChild(outlet);

  this.log(`Auto-inserted outlet in ${parentElement.tagName}`);
}
```

### 深层嵌套保护

```typescript
if (matchedRoutes.length > 10) {
  console.warn('Route nesting too deep (>10 layers), performance may degrade');
}
```

## 迁移示例

### 旧代码

```html
<div id="app">
  <kylin-outlet path="/user"></kylin-outlet>
  <kylin-outlet path="/post"></kylin-outlet>
  <kylin-outlet path="/about"></kylin-outlet>
</div>
```

### 新代码

```html
<div id="app">
  <kylin-outlet></kylin-outlet>
  <!-- 所有路由都会渲染到这个 outlet 或其子 outlet -->
</div>
```

### 路由配置（不变）

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
];
```

### UserLayout.js（不变）

```javascript
export default class UserLayout extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h1>User Layout</h1>
      <kylin-outlet></kylin-outlet>  <!-- 子路由渲染在这里 -->
    `;
  }
}
```

## 性能对比

| 指标 | 当前实现 | 新实现 |
|------|----------|--------|
| 初始渲染 | 需要匹配所有 outlet | 直接递归渲染 |
| 路由切换 | 触发多个事件监听器 | 单次递归调用 |
| 内存占用 | 可能存在强引用泄漏 | WeakRef 自动清理 |
| DOM 操作 | 分散在各个 outlet | 集中在 Router |
| 代码复杂度 | outlet 需要匹配逻辑 | outlet 纯粹容器 |
