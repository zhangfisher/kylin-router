# Architecture Patterns

**Domain:** Web Components 路由库
**Researched:** 2026-04-07
**Overall confidence:** MEDIUM

## Recommended Architecture

前端路由库应采用**分层架构**结合**Mixin 模式**和**Outlet 渲染模式**，基于 Web Components 标准构建。

### 架构分层图

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (Application Layer)            │
│  开发者使用路由组件和 API 构建 SPA 应用                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  组件层 (Component Layer)                │
│  kylin-link, kylin-outlet, kylin-loading 等路由组件      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   特性层 (Feature Layer)                 │
│  Hooks, Loader, KeepAlive, Transition, Preload 特性     │
│  通过 Mixin 模式组合到核心路由器                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              核心路由层 (Core Router Layer)              │
│  KylinRouter - 路由匹配、导航控制、历史管理              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              基础设施层 (Infrastructure Layer)           │
│  History API, Context 系统, 基础组件类                    │
└─────────────────────────────────────────────────────────┘
```

## Component Boundaries

### 核心路由层 (Core Router Layer)

| 组件 | 职责 | 通信对象 |
|------|------|----------|
| **KylinRouter** | 路由匹配、导航控制、历史管理、特性编排 | History API, Feature mixins, 组件层 |
| **RouteMatcher** | 路径匹配、参数解析、路由优先级处理 | KylinRouter, 路由配置 |
| **NavigationController** | push/replace/back/forward 导航方法 | History API, 导航守卫 |

**关键特性：**
- 单例模式，每个应用一个路由器实例
- 通过 Mixin 模式组合特性功能
- 管理 History API 监听器和清理

### 特性层 (Feature Layer)

| 特性 | 职责 | 通信对象 | 依赖 |
|------|------|----------|------|
| **ContextMixin** | 路由实例上下文传播 | 上下文消费者组件 | @lit/context |
| **HooksMixin** | 生命周期钩子管理 | 导航流程, 用户代码 | 无 |
| **LoaderMixin** | 组件加载逻辑 | kylin-outlet, 远程 URL | fetch API |
| **KeepAliveMixin** | 组件缓存管理 | kylin-outlet, 组件实例 | Map 存储 |
| **TransitionMixin** | 路由切换动画 | kylin-outlet, CSS 动画 | Web Animations API |
| **PreloadMixin** | 路由预加载逻辑 | 鼠标悬停, 智能预测 | Intersection Observer |

**关键特性：**
- 每个 Mixin 独立开发和测试
- 通过 ts-mixer 或类似工具组合
- 可选特性，按需启用

### 组件层 (Component Layer)

| 组件 | 职责 | 通信对象 | 使用场景 |
|------|------|----------|----------|
| **kylin-link** | 声明式导航链接 | KylinRouter, Context | 模板中的导航链接 |
| **kylin-outlet** | 路由渲染容器 | KylinRouter, LoaderMixin | 路由组件渲染位置 |
| **kylin-loading** | 加载状态显示 | LoaderMixin, TransitionMixin | 路由切换时的加载提示 |
| **KylinRouterElementBase** | 基础组件类 | Context 系统 | 所有路由组件的基类 |

**关键特性：**
- 继承自 LitElement
- 使用 Light DOM 而非 Shadow DOM
- 通过 Context 获取路由器实例

### 基础设施层 (Infrastructure Layer)

| 组件 | 职责 | 通信对象 |
|------|------|----------|
| **HistoryManager** | 封装 History API 5.3.0 | KylinRouter |
| **ContextSystem** | 基于 @lit/context 的依赖注入 | 所有组件 |
| **TypeUtilities** | TypeScript 类型工具和辅助函数 | 所有层 |

## Data Flow

### 路由初始化流程

```
1. 应用创建 KylinRouter 实例
   ↓
2. 路由器附加到宿主元素 (data-kylin-router)
   ↓
3. Context Provider 附加到宿主元素
   ↓
4. History 实例初始化 (browser 或 hash 模式)
   ↓
5. 设置清理数组存储取消订阅函数
   ↓
6. 初始路由匹配和渲染
```

### 组件上下文获取流程

```
1. 组件继承 KylinRouterElementBase
   ↓
2. connectedCallback() 触发上下文请求
   ↓
3. 同步查找：遍历 DOM 查找路由器实例
   ↓ (失败时)
4. 异步回退：dispatchEvent(context-request)
   ↓
5. 路由器响应回调，组件获得路由器实例
   ↓
6. 组件可以使用路由器 API
```

### 导航流程

```
1. 用户点击 kylin-link 或调用导航方法
   ↓
2. History API 触发 URL 变化
   ↓
3. onRouteUpdate 监听器被触发
   ↓
4. 执行 beforeEach 导航守卫
   ↓ (通过时)
5. 匹配新路由和参数
   ↓
6. 执行 beforeResolve 守卫
   ↓ (通过时)
7. LoaderMixin 准备加载组件
   ↓
8. TransitionMixin 准备动画
   ↓
9. kylin-outlet 渲染新组件
   ↓
10. 执行 afterEach 钩子
   ↓
11. Context 更新所有子组件
```

### 组件渲染流程

```
1. kylin-outlet 接收路由变化
   ↓
2. KeepAliveMixin 检查缓存
   ↓ (缓存命中)
3. 恢复缓存的组件实例
   ↓ (缓存未命中)
4. LoaderMixin 加载组件
   ↓ (本地组件)
5. 动态导入组件模块
   ↓ (远程组件)
6. fetch URL 获取 HTML 字符串
   ↓
7. 使用 lit/html 渲染到 outlet
   ↓
8. TransitionMixin 执行切换动画
   ↓
9. 组件挂载完成
```

## Patterns to Follow

### Pattern 1: Mixin 特性组合

**What:** 每个 router 特性独立实现为 Mixin 类，通过 ts-mixer 组合到 KylinRouter

**When:** 需要模块化、可扩展、可测试的功能组合时

**Example:**
```typescript
import { mix } from 'ts-mixer';

// 独立特性 Mixin
class HooksMixin {
  private beforeHooks: Hook[] = [];
  beforeEach(fn: Hook) {
    this.beforeHooks.push(fn);
  }
}

class LoaderMixin {
  async loadComponent(route: Route) {
    // 加载逻辑
  }
}

// 组合到主路由器
class KylinRouter extends mix(HooksMixin, LoaderMixin) {
  // 组合了所有特性的功能
}
```

**Benefits:**
- 特性解耦，独立开发和测试
- 按需启用，减小包体积
- 易于扩展新特性

### Pattern 2: Outlet 渲染模式

**What:** 通过声明式 `<kylin-outlet>` 组件标记路由渲染位置，类似 Angular Router

**When:** 需要嵌套路由和灵活的渲染控制时

**Example:**
```typescript
// 父组件
class AppComponent extends LitElement {
  render() {
    return html`
      <header>App Header</header>
      <kylin-outlet></kylin-outlet>
      <footer>App Footer</footer>
    `;
  }
}

// 用户组件
class UserComponent extends LitElement {
  render() {
    return html`
      <h1>User Profile</h1>
      <kylin-outlet></kylin-outlet>
    `;
  }
}
```

**Benefits:**
- 声明式路由配置
- 支持嵌套路由
- 灵活的渲染控制

### Pattern 3: Context 依赖注入

**What:** 使用 `@lit/context` 实现路由实例的依赖注入，避免 prop drilling

**When:** 需要在组件树中传递路由器实例时

**Example:**
```typescript
import { createContext, consume } from '@lit/context';

// 创建上下文
export const routerContext = createContext<KylinRouter>('router');

// 提供者
@customElement('app-root')
class AppRoot extends LitElement {
  @provide({ context: routerContext })
  router = new KylinRouter(this);
}

// 消费者
@customElement('user-link')
class UserLink extends LitElement {
  @consume({ context: routerContext })
  router?: KylinRouter;
}
```

**Benefits:**
- 避免 prop drilling
- 类型安全的依赖注入
- 支持异步上下文解析

### Pattern 4: 渐进式组件加载

**What:** 支持本地组件动态导入和远程 HTML 加载两种方式

**When:** 需要代码分割或微前端集成时

**Example:**
```typescript
// 路由配置
const routes = [
  {
    path: '/user',
    component: () => import('./components/user.js') // 本地动态导入
  },
  {
    path: '/remote',
    component: 'https://cdn.example.com/remote-component.html' // 远程加载
  }
];

// 加载逻辑
async loadComponent(route) {
  if (typeof route.component === 'function') {
    // 本地动态导入
    const module = await route.component();
    return module.default;
  } else if (typeof route.component === 'string') {
    // 远程 HTML 加载
    const html = await fetch(route.component).then(r => r.text());
    return html;
  }
}
```

**Benefits:**
- 支持代码分割
- 集成微前端
- 按需加载，优化性能

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shadow DOM 隔离路由器

**What:** 将路由器放在 Shadow DOM 内部，导致外部无法访问

**Why bad:**
- 破坏上下文传播
- 难以全局管理路由状态
- 样式和事件处理复杂化

**Instead:** 使用 Light DOM 或手动管理上下文穿透

### Anti-Pattern 2: 紧耦合的 Mixin 依赖

**What:** Mixin 之间直接依赖，导致难以独立测试和复用

**Why bad:**
- 破坏 Mixin 的独立性
- 组合顺序敏感
- 难以理解和维护

**Instead:** 通过事件或回调通信，保持 Mixin 独立

### Anti-Pattern 3: 同步组件加载

**What:** 在路由切换时同步加载组件，阻塞 UI

**Why bad:**
- 导致界面卡顿
- 用户体验差
- 无法显示加载状态

**Instead:** 使用异步加载 + Loading 状态

### Anti-Pattern 4: 全局路由器单例硬编码

**What:** 导出全局单例，导致测试困难和多实例问题

**Why bad:**
- 难以单元测试
- 无法支持多路由器实例
- 状态污染

**Instead:** 使用依赖注入和实例化管理

## Scalability Considerations

| 关注点 | 100 用户 | 10K 用户 | 1M 用户 |
|--------|----------|----------|---------|
| **路由数量** | 内存存储全部路由 | 内存存储，使用 Map 优化 | 按需加载路由配置 |
| **组件缓存** | 缓存全部组件 | LRU 缓存策略 | 限制缓存数量，自动清理 |
| **上下文传播** | DOM 遍历查找 | 缓存上下文引用 | 使用 WeakMap 优化内存 |
| **预加载** | 禁用 | 预加载下一级路由 | 智能预测，按需预加载 |
| **动画** | 全部启用 | 按设备能力降级 | 移动端禁用复杂动画 |

## 构建顺序建议

基于依赖关系，建议按以下顺序构建：

### 阶段 1: 基础设施 (Foundation)
1. **HistoryManager** - 封装 History API
2. **ContextSystem** - 上下文传播机制
3. **KylinRouterElementBase** - 基础组件类

### 阶段 2: 核心路由 (Core Routing)
4. **RouteMatcher** - 路径匹配逻辑
5. **KylinRouter (基础版)** - 路由器和导航方法
6. **kylin-link** - 声明式导航链接

### 阶段 3: 渲染系统 (Rendering)
7. **kylin-outlet (基础版)** - 简单的组件渲染
8. **LoaderMixin** - 组件加载逻辑
9. **kylin-loading** - 加载状态组件

### 阶段 4: 高级特性 (Advanced Features)
10. **HooksMixin** - 导航守卫
11. **KeepAliveMixin** - 组件缓存
12. **TransitionMixin** - 切换动画

### 阶段 5: 性能优化 (Performance)
13. **PreloadMixin** - 路由预加载
14. **智能缓存策略** - LRU 和自动清理

## Sources

### Web Components Routing
- [Routing with Lit | Bits and Pieces](https://blog.bitsrc.io/routing-with-litelement-2a29465ec778) (MEDIUM confidence)
- [Navigation Lifecycle using Vaadin Router, LitElement and TypeScript | Dev.to](https://dev.to/thisdotmedia_staff/navigation-lifecycle-using-vaadin-router-litelement-and-typescript-3a2l) (MEDIUM confidence)
- [@lit-labs/router GitHub Discussion](https://github.com/lit/lit/discussions/3354) (MEDIUM confidence)

### Router Architecture Patterns
- [Key Components Of Frontend Architecture | Medium](https://altersquare.medium.com/key-components-of-frontend-architecture-65077848b1cd) (LOW confidence)
- [A Guide to Modern Frontend Architecture Patterns | LogRocket](https://blog.logrocket.com/guide-modern-frontend-architecture-patterns/) (LOW confidence)

### Mixin and Composition Patterns
- [Mixins Are Dead. Long Live Composition | Dan Abramov](https://medium.com/@dan_abramov/mixins-are-dead-long-live-higher-order-components-94a0d2f9e750) (MEDIUM confidence)
- [Mixins Considered Harmful – React Blog](https://zh-hans.legacy.reactjs.org/blog/2016/07/13/mixins-considered-harmful.html) (MEDIUM confidence)

### Component Loading and Lazy Loading
- [Optimizing React Apps with Code Splitting and Lazy Loading | Medium](https://medium.com/@ignatovich.dm/optimizing-react-apps-with-code-splitting-and-lazy-loading-e8c8791006e3) (LOW confidence)
- [How to implement lazy loading in React Router | CoreUI](https://coreui.io/answers/how-to-implement-lazy-loading-in-react-router/) (LOW confidence)

### Dependency Injection in Web Components
- [Web Components + Dependency Injection | Marek Miałkowski](https://medium.com/@marekmial15/web-components-dependency-injection-7c03cf9b4613) (MEDIUM confidence)
- [Asynchronous Dependency Injection and Pending Event | elfsternberg.com](https://elfsternberg.com/blog/dependency-injection-with-lit/) (MEDIUM confidence)

### Vaadin Router Documentation
- [How to implement routing in Hilla Lit | Vaadin Docs](https://vaadin.com/docs/latest/hilla/lit/guides/routing) (HIGH confidence)
- [Routing and Web Components: Exploring Vaadin Router | Codeburst](https://codeburst.io/routing-and-web-components-7eb16539e589) (MEDIUM confidence)

**注：** 由于搜索 API 限制，部分信息基于已有的领域知识和有限的搜索结果。建议在实施前进一步验证特定模式的适用性。
