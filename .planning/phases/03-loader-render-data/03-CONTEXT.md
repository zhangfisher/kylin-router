# Phase 3: Loader + Render + Data（组件加载系统）- Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 实现完整的组件加载、渲染和数据管理系统，包括：
- 本地组件动态导入和渲染
- 远程 HTML 加载和渲染
- 加载状态和错误边界处理
- 自动重试机制
- 模态路由系统
- 与 renderEach 钩子的数据集成

Context 传播系统已在 Phase 1 完成，Hooks 系统已在 Phase 2 完成，Phase 3 需要实现与之配合的组件加载系统。

</domain>

<decisions>
## Implementation Decisions

### 组件定义与加载

- **D-01:** 路由配置中的 component 字段支持两种类型：普通 HTML 元素（如 'div'、'span'）和 URL 字符串（如 'https://example.com/user-profile.html'）
- **D-02:** 从 URL 加载的 HTML 使用智能提取策略：如果是完整的 HTML 文件（包含 <html> 标签），则只取 <body> 内容；如果存在 data-outlet 属性的元素，则选择该元素
- **D-03:** 加载的内容本质是 lit 模板，支持将数据传递给模板进行渲染
- **D-04:** lit 模板接收 router 和 route 变量作为上下文，route.data 的所有字段展开为模板的局部变量，简化数据访问
- **D-05:** 嵌套路由时（多个 outlet 同时加载），使用并行渲染策略，所有层级的 outlet 同时开始加载和渲染，最大化性能
- **D-06:** 组件卸载时根据路由配置的 keepalive 字段决定：如果 keepalive=true，则缓存组件实例（KeepAlive 机制在 Phase 4 详细实现）；否则丢弃组件

### 组件渲染策略

- **D-07:** 默认使用替换模式，新组件替换 outlet 中的旧组件
- **D-08:** 如果新内容支持 data-outlet-append 属性，则使用追加模式，新组件添加到现有内容之后
- **D-09:** 从 URL 加载的远程 HTML 使用 lit/html 的 html`` 模板函数渲染，支持 ${} 插值和表达式

### 加载状态显示

- **D-10:** <kylin-loading> 组件支持自定义模板，开发者可以提供任意内容作为加载指示器，如 <kylin-loading><div class="custom-spinner">自定义加载...</div></kylin-loading>
- **D-11:** 嵌套路由时，只在最外层的 outlet 显示加载指示器，内层的 outlet 不显示，避免多个加载指示器造成混乱
- **D-12:** 组件加载超时使用多层级配置：路由配置 > outlet 属性 > 默认值（5 秒），提供灵活性同时有合理的默认值

### 错误处理与重试

- **D-13:** 组件渲染失败时使用两级配置的错误边界：路由配置的 errorComponent 字段优先于全局配置的 defaultErrorComponent
- **D-14:** 组件加载失败时使用混合重试策略：默认固定重试 3 次，每次间隔 1 秒；支持在路由配置中自定义重试策略（如 retry: { max: 5, delay: 2000 }）；提供手动重试方法 retry() 供错误边界组件调用
- **D-15:** 远程 HTML 加载的安全性通过 allowUnsafeHTML 配置控制：默认进行安全检查（如移除 <script> 标签），开发者可以通过配置 { allowUnsafeHTML: true } 跳过安全检查

### 模态路由系统

- **D-16:** 使用路由配置中的 modal 字段声明模态路由，如 { path: '/user/:id', component: UserProfile, modal: true }
- **D-17:** 模态路由的组件渲染到 host 元素下的专用容器 <div class="kylin-modals"></div> 中，专门用于模态框管理
- **D-18:** 模态路由的背景遮罩通过 backdrop 配置字段控制，如 { modal: true, backdrop: true }，可配置是否显示背景遮罩
- **D-19:** 支持多层模态，形成一个模态栈，新模态覆盖在旧模态之上，关闭模态时自动回到前一个模态
- **D-20:** 用户可以通过多种方式关闭模态路由：调用 router.back() 关闭当前模态并返回到前一个路由或模态；或调用专门的 router.closeModal() 方法，提供明确的语义

### 数据管理与竞态控制

- **D-21:** renderEach 钩子预加载的数据支持多种传递方式：通过 router.setData(key, value) 设置数据；直接修改 route.data 对象；通过 renderEach 钩子的第二个参数传递数据
- **D-22:** 多个数据源（renderEach、router.setData、route.data）的数据使用深合并策略，递归合并所有层级的属性，保留嵌套结构，避免数据被意外覆盖
- **D-23:** 导航竞态条件通过版本号机制检测和处理：每次导航版本号 +1，只接受最新版本的响应，旧版本的响应会被丢弃
- **D-24:** 当检测到竞态条件时，使用 AbortController 取消旧的网络请求，释放网络资源，避免浪费带宽
- **D-25:** 数据预加载（renderEach 钩子）的超时使用多层级配置：钩子配置 > 路由配置 > 默认值（10 秒），与组件加载超时策略保持一致

### Claude's Discretion

- lit 模板的具体渲染实现细节（如如何高效地将 router 和 route 对象传递给模板）
- 版本号机制的具体实现方式（如如何存储和比较版本号）
- AbortController 的具体集成方式（如如何在 fetch 请求中使用 signal）
- 深合并算法的具体实现细节（如如何处理数组和特殊对象）
- 模态栈的具体数据结构和管理方式
- 错误提示信息的文案和格式
- 加载指示器的默认行为和样式
- 测试文档和示例代码的具体内容

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` - v1 需求定义，包含所有 45 个需求项的详细描述，特别是 LOAD-01 到 LOAD-05、UX-03、MODAL-01 到 MODAL-03、ERROR-01 到 ERROR-02
- `.planning/ROADMAP.md` - Phase 3 详细信息和成功标准

### 代码库分析
- `.planning/codebase/STRUCTURE.md` - 代码库结构和关键文件位置
- `.planning/codebase/CONVENTIONS.md` - 编码约定和设计模式，特别是 Mixin 架构和命名约定
- `.planning/codebase/ARCHITECTURE.md` - 架构模式和层级结构

### 现有实现
- `src/features/context.ts` - Context 传播系统的参考实现，了解事件监听模式
- `src/features/hooks.ts` - Hooks 系统的实现，了解 renderEach 钩子的工作方式
- `src/features/loader.ts` - Loader 骨架文件，需要实现组件加载逻辑
- `src/features/render.ts` - Render 骨架文件，需要实现渲染逻辑
- `src/features/data.ts` - DataLoader 骨架文件，需要实现数据管理逻辑
- `src/components/base/index.ts` - KylinRouterElementBase 基类和上下文获取机制
- `src/components/outlet/index.ts` - KylinOutletElement 组件，需要集成渲染逻辑
- `src/components/loading/index.ts` - KylinLoadingElement 组件，需要扩展功能
- `src/router.ts` - KylinRouter 主类和 Mixin 架构

### Phase 1 上下文
- `.planning/phases/01-context/01-CONTEXT.md` - Phase 1 的实现决策，特别是导航流程和路由匹配相关的决策

### Phase 2 上下文
- `.planning/phases/02-hooks/02-CONTEXT.md` - Phase 2 的实现决策，特别是 renderEach 钩子和数据预加载相关的决策

### 项目配置
- `.planning/PROJECT.md` - 项目愿景、约束条件和关键决策
- `CLAUDE.md` - 项目文档和技术栈说明

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Context 传播系统** - `src/features/context.ts` 提供了完整的 context 提供者机制，通过 `context-request` 事件传播 router 实例
- **Hooks 系统** - `src/features/hooks.ts` 实现了 renderEach 钩子，用于在组件渲染前执行数据预取
- **基础组件类** - `src/components/base/index.ts` 提供了 `KylinRouterElementBase`，支持同步和异步获取 router 实例
- **路由器骨架** - `src/router.ts` 定义了 `KylinRouter` 类和 Mixin 架构，已集成 History API 和基础导航方法
- **Outlet 组件** - `src/components/outlet/index.ts` 已定义 `KylinOutletElement`，有 `path`、`timeout`、`cacheable` 属性
- **Loading 组件** - `src/components/loading/index.ts` 已定义 `KylinLoadingElement`，但功能简单

### Established Patterns

- **Mixin 架构** - 通过 `ts-mixer` 实现特性的模块化组合，每个特性独立为一个 Mixin 类
- **上下文传播** - 使用自定义的 `context-request` 事件而非 `@lit/context`，避免额外依赖
- **Light DOM** - 组件使用 Light DOM 而非 Shadow DOM，便于样式和事件穿透
- **事件清理** - 使用 `_cleanups` 数组管理清理函数，在 `detach()` 中统一清理
- **异步处理** - 导航流程支持 Promise 和异步操作，钩子和数据加载需要支持异步模式

### Integration Points

- **路由器初始化** - 在 `KylinRouter` 构造函数中初始化 Loader、Render、DataLoader 特性
- **导航流程集成** - 在 `onRouteUpdate()` 方法中按顺序执行路由匹配 → 守卫执行 → 组件加载 → 数据预加载 → 渲染
- **renderEach 钩子** - 数据预加载在 renderEach 钩子中执行，加载的数据通过 route.data 传递给组件
- **Outlet 渲染** - `KylinOutletElement` 需要监听路由变化，并根据 route.component 决定如何渲染
- **模态路由** - 需要在 host 元素下创建 `<div class="kylin-modals"></div>` 容器，专门用于模态框渲染

</code_context>

<specifics>
## Specific Ideas

- 用户希望支持两种组件类型：普通 HTML 元素（简单直接）和 URL 字符串（微前端场景，fetch 远程 HTML）
- 远程 HTML 加载使用智能提取：完整 HTML 文件只取 body，存在 data-outlet 属性的元素则选择该元素（类似 qiankun 的做法）
- 默认替换模式，但通过 data-outlet-append 属性支持追加模式，提供灵活性
- lit 模板接收 router 和 route 变量，route.data 展开为局部变量，简化数据访问（如 `${userId}` 而不是 `${route.data.userId}`）
- 嵌套 outlet 使用并行渲染，最大化性能，但只在外层显示加载指示器，避免混乱
- 模态路由使用专用容器 `<div class="kylin-modals"></div>`，支持多层模态栈，新模态覆盖旧模态
- 导航竞态使用版本号机制 + AbortController，既保证数据新鲜度又释放网络资源
- 深合并策略确保数据不会被意外覆盖，保留嵌套结构
- 多层级配置策略（路由配置 > outlet 属性 > 默认值）在多个地方保持一致，提供统一的配置体验
- KeepAlive 通过路由配置的 keepalive 字段控制，与 Phase 4 的 KeepAlive 特性配合

</specifics>

<deferred>
## Deferred Ideas

### 下一阶段处理的功能
- **KeepAlive 缓存机制的详细实现** - Phase 4 实现，包括缓存策略、LRU 算法、缓存生命周期管理
- **转场动画** - Phase 5 实现，可能需要在组件加载和渲染过程中控制动画时机
- **路由配置的验证和类型检查** - 当前依赖 TypeScript，未来可能提供运行时验证
- **性能监控和优化工具** - 当前保持轻量，未来可能提供独立的性能监控包

### 暂不讨论的高级特性
- **服务器端渲染（SSR）** - 当前专注客户端，SSR 相关功能留待 v2+
- **路由级代码分割** - 应由构建工具处理，不在路由器层面实现
- **组件级别的数据预加载** - 当前通过 renderEach 钩子实现，暂不支持组件级的 data loader
- **更复杂的模态路由场景** - 当前支持基本的模态栈，高级场景（如模态之间的数据传递）留待未来

</deferred>

---

*Phase: 03-loader-render-data*
*Context gathered: 2026-04-08*
