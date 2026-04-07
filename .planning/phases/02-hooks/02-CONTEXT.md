# Phase 2: Hooks（导航生命周期钩子）- Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 实现路由守卫系统,在导航前后执行验证、数据预取和清理逻辑,包括:
- 全局钩子管理(beforeEach、renderEach、afterEach)
- 路由级守卫(beforeEnter、afterLeave)
- 异步守卫处理机制
- 守卫取消和重定向
- 嵌套路由守卫执行
- 数据预加载(renderEach钩子)
- 钩子错误边界和恢复

Context 传播系统已在 Phase 1 完成,Phase 2 需要实现与之配合的钩子系统。

</domain>

<decisions>
## Implementation Decisions

### 钩子API设计

- **D-01:** 使用配置对象模式注册钩子 - router.hooks对象包含beforeEach、renderEach、afterEach三个数组
- **D-02:** 钩子函数签名采用next回调模式 - `hook(to, from, next, router)`,通过next()、next(false)、next('/path')控制导航
- **D-03:** 路由级守卫使用beforeEnter/afterLeave字段 - 与Vue Router保持一致,支持单个函数或函数数组
- **D-04:** 框架无关设计 - 暂不支持组件级钩子,专注于全局和路由级两个层次
- **D-05:** 钩子通过router.hooks对象管理 - router.hooks.beforeEach、router.hooks.afterEach、router.hooks.beforeResolve对应hook[]
- **D-06:** 同类型多个钩子按注册顺序(FIFO)执行 - 符合直觉,适合日志等场景
- **D-07:** 支持三种钩子类型 - beforeEach(导航前)、renderEach(渲染前,可修改内容)、afterEach(导航完成后)
- **D-08:** 钩子函数接收四个参数 - to、from、next回调、router实例,包含完整导航上下文
- **D-09:** 钩子可以在任何时候注册 - 包括路由器初始化后和导航过程中,提供最大灵活性

### 异步守卫处理

- **D-10:** 采用混合执行策略 - 路由级守卫串行执行(有依赖关系),全局守卫并行执行(无依赖关系)
- **D-11:** 异步守卫固定30秒超时 - 防止无限等待,超时后视为守卫失败
- **D-12:** 错误处理根据next参数调用返回值决定 - 取消导航、重定向到错误、忽略错误、重定向到指定页面
- **D-13:** 默认提供全局加载指示器 - 异步守卫执行时自动显示并阻止用户交互,同时支持自定义

### 守卫取消机制

- **D-14:** 守卫取消导航时回退到配置路径 - 在路由配置中指定fallbackPath,避免停留在无效状态
- **D-15:** 采用智能重定向机制 - next('/path')设置重定向标志,已通过的守卫可以选择跳过
- **D-16:** 使用固定阈值检测循环 - 超过10次重定向后抛出错误,与Phase 1的MAX_REDIRECTS一致
- **D-17:** 守卫失败时自动清理已执行的守卫 - 防止资源泄漏,确保系统状态一致

### 数据预加载机制

- **D-18:** renderEach钩子在组件加载后触发 - 数据预加载与组件加载并行,性能最优
- **D-19:** 数据预加载失败时继续渲染组件 - 组件负责处理错误状态,提供更好的容错性
- **D-20:** 预加载数据通过route.data传递给组件 - 显式传递,类型安全,组件通过route.data访问

### 钩子性能优化

- **D-21:** 不缓存守卫执行结果 - 每次导航都重新执行,确保数据实时性和安全性
- **D-22:** 不提供钩子执行的性能监控 - 保持路由器轻量,避免不必要的复杂度
- **D-23:** 不限制嵌套路由层级 - 由开发者自行控制性能和复杂度

### 嵌套路由守卫

- **D-24:** 父路由守卫优先执行 - 父路由beforeEnter → 子路由beforeEnter,符合直觉
- **D-25:** 子路由守卫失败时回退到父路由 - 父路由继续渲染,提供更好的容错性

### 钩子与路由状态

- **D-26:** 钩子通过router参数访问路由状态 - to.state、from.state、router.state等,显式传递
- **D-27:** 钩子通过next()传递状态修改 - next({ state: {...} })将状态对象合并到导航状态中

### 钩子测试支持

- **D-28:** 不提供专门的钩子测试工具 - 通过文档和示例代码展示如何测试钩子,保持轻量

### 钩子错误边界

- **D-29:** 采用混合错误处理模式 - 提供全局错误边界作为兜底,同时支持钩子自己处理错误
- **D-30:** 所有钩子错误自动记录到控制台 - 包含钩子类型、错误信息和堆栈,开发环境友好

### Claude's Discretion

- 钩子注册和注销的具体实现细节
- next回调函数的类型定义和类型检查
- 错误提示信息的文案和格式
- 加载指示器的默认样式和行为
- 测试文档和示例代码的具体内容

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` - v1 需求定义,包含所有 45 个需求项的详细描述,特别是 GUARD-01 到 GUARD-07
- `.planning/ROADMAP.md` - Phase 2 详细信息和成功标准

### 代码库分析
- `.planning/codebase/STRUCTURE.md` - 代码库结构和关键文件位置
- `.planning/codebase/CONVENTIONS.md` - 编码约定和设计模式,特别是 Mixin 架构和命名约定
- `.planning/codebase/ARCHITECTURE.md` - 架构模式和层级结构

### 现有实现
- `src/features/context.ts` - Context 传播系统的参考实现,使用事件监听模式
- `src/features/hooks.ts` - Hooks 骨架文件,需要实现钩子系统
- `src/router.ts` - KylinRouter 主类和 Mixin 架构
- `src/types.ts` - RouteItem 和 KylinRouterOptions 类型定义

### Phase 1 上下文
- `.planning/phases/01-context/01-CONTEXT.md` - Phase 1 的实现决策,特别是导航流程和守卫相关的决策

### 项目配置
- `.planning/PROJECT.md` - 项目愿景、约束条件和关键决策
- `CLAUDE.md` - 项目文档和技术栈说明

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Context 传播系统** - `src/features/context.ts` 提供了参考实现,使用事件监听模式管理清理函数
- **Mixin 架构** - 通过 `ts-mixer` 实现特性的模块化组合,Hooks 类作为 Mixin 集成到 KylinRouter
- **清理机制** - `_cleanups` 数组模式用于管理钩子注销,在 `detach()` 中统一清理
- **路由器骨架** - `src/router.ts` 已定义导航方法,需要在 `onRouteUpdate()` 中集成钩子系统

### Established Patterns

- **事件监听模式** - Context 特性使用 `addEventListener` 和 `_cleanups` 管理生命周期
- **Light DOM** - 组件使用 Light DOM 而非 Shadow DOM,便于样式和事件穿透
- **异步处理** - 导航流程支持 Promise 和异步操作,钩子需要支持同步和异步两种模式
- **错误处理** - 使用 try-catch 和错误边界模式,钩子需要集成到错误处理流程中

### Integration Points

- **路由器初始化** - 在 `KylinRouter` 构造函数中初始化 `router.hooks` 对象和钩子数组
- **导航流程集成** - 在 `onRouteUpdate()` 方法中按顺序执行 beforeEach → beforeResolve → afterEach
- **路由匹配** - 钩子需要访问匹配的路由配置和参数,与 Phase 1 的路由匹配系统集成
- **组件渲染** - renderEach 钩子需要在组件加载后、渲染前执行,与 Phase 3 的组件加载系统配合

</code_context>

<specifics>
## Specific Ideas

- 用户希望支持三种钩子:beforeEach、renderEach、afterEach,其中renderEach是创新点,用于在渲染前修改要渲染的内容
- 钩子管理采用router.hooks对象模式,每个钩子类型对应一个数组,支持动态注册和移除
- 守卫执行采用混合策略:路由级守卫串行(有依赖),全局守卫并行(无依赖),平衡性能和功能
- 数据预加载与组件加载并行(renderEach在组件加载后执行),性能最优但组件需要处理加载状态
- 错误处理非常灵活,根据next参数调用返回值决定:取消、重定向、忽略等,给开发者最大控制权
- 嵌套路由守卫执行顺序与Phase 1决策一致:从内到外(组件级 → 路由级 → 全局),但由于不支持组件级钩子,实际是路由级 → 全局
- 框架无关设计,暂不支持组件级钩子,专注于全局和路由级两个层次,保持Web Components原生特性
- 不缓存守卫结果、不限制嵌套层级、不提供性能监控,保持路由器轻量和简洁

</specifics>

<deferred>
## Deferred Ideas

### 下一阶段处理的功能
- **组件级钩子系统** - 由于框架无关设计,暂不支持组件级钩子,未来可能在特定框架集成层考虑
- **KeepAlive 缓存机制** - Phase 4 实现,可能影响钩子的执行频率和缓存策略
- **转场动画** - Phase 5 实现,可能需要在钩子执行过程中控制动画时机

### 暂不讨论的高级特性
- **钩子性能监控和优化工具** - 当前保持轻量,未来可能提供独立的性能监控包
- **钩子调试工具和可视化** - 当前通过控制台日志,未来可能提供专门的调试工具
- **服务器端钩子和数据预取** - 当前专注客户端,SSR相关功能留待v2+

</deferred>

---

*Phase: 02-hooks*
*Context gathered: 2026-04-07*
