# Phase 1: Context（上下文传播）- Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 实现核心路由功能和上下文传播系统，包括：
- 路由表定义与匹配算法
- 动态路由参数解析
- 编程式和声明式导航
- 404 未匹配路由处理
- History 和 Hash 两种路由模式
- 动态路由注册
- 默认路径重定向
- 远程路由表加载

Context 传播系统已实现，Phase 1 需要完成与之配合的路由核心功能。

</domain>

<decisions>
## Implementation Decisions

### 路由匹配策略

- **D-01:** 使用混合匹配策略 - 叶子节点完全匹配，父节点支持前缀匹配以支持嵌套路由
- **D-02:** 同时支持冒号语法（`:param`）和尖括号语法（`<param>`）用于动态参数，尖括号用于复杂约束
- **D-03:** 支持通配符（`*`）匹配多层路径，常用于 404 兜底
- **D-04:** 嵌套路由的子路由自动检测路径继承 - 以 `/` 开头为绝对路径，否则为相对路径
- **D-05:** 路由匹配优先级采用混合策略 - 具体路径优先于参数化路径，参数化路径优先于通配符；具体度相同时按配置顺序
- **D-06:** 支持路由级参数验证，在路由配置中定义参数类型或正则约束（如 `/user/:id(\\d+)`）
- **D-07:** 路径规范化自动移除末尾斜杠，`/user/` 和 `/user` 视为相同路径
- **D-08:** 路径匹配不区分大小写，`/User` 和 `/user` 视为相同路径

### 路由表结构设计

- **D-09:** 使用嵌套式结构组织路由表，路由通过 `children` 字段嵌套形成树形结构
- **D-10:** 无效路由配置静默处理，使用默认值而不发出警告
- **D-11:** 路由冲突（重复 path/name）采用后者覆盖策略，后配置的路由覆盖先配置的路由
- **D-12:** RouteItem 的 `meta` 字段完全由应用层自定义，路由器不定义预定义键
- **D-13:** 支持路由组件懒加载和预加载，`component` 字段支持返回 Promise 的函数，并提供 `preload` 方法
- **D-14:** 支持路由别名，一个路由配置可以有多个 `path` 指向
- **D-15:** 通过嵌套路由实现分组功能，不支持专门的分组机制
- **D-16:** 版本管理由应用层处理，路由器不提供内置的版本控制功能
- **D-17:** 支持多种路由配置格式（对象数组、函数返回、远程加载），在内部统一转换为 RouteItem 结构
- **D-18:** 同时提供开发调试工具和 TypeScript 类型检查，确保开发体验

### 导航流程设计

- **D-19:** 导航流程包含 6 个步骤：路径解析 → 参数提取 → 路由匹配 → 守卫执行 → 组件加载 → 渲染
- **D-20:** 路由守卫灵活处理 - 返回 `false` 阻止导航，返回路径字符串重定向，提供最大灵活性
- **D-21:** 导航错误处理通过新的路由参数 `failure` 决定，取值：`error`=在当前 outlet 显示错误，`redirect`=重定向，`back`=回退，`none`=保持，`(e:Error,location)函数`=自定义处理或返回 HTMLElement
- **D-22:** 导航竞态条件采用取消旧导航策略，新的导航开始时自动取消旧的导航
- **D-23:** 导航时滚动到 `kylin-outlet` 组件所在的位置
- **D-24:** 守卫执行顺序从内到外 - 组件级守卫优先于路由级守卫，路由级守卫优先于全局守卫
- **D-25:** 异步导航采用阻塞模式，显示全局加载指示器并阻止用户交互直到导航完成
- **D-26:** 同时提供导航状态 API（如 `isLoading`、`isNavigating`、`currentRoute`）和事件系统（`navigation-start`、`navigation-end`）
- **D-27:** 仅通过守卫返回 `false` 阻止导航，不提供专门的取消导航 API
- **D-28:** `<kylin-link>` 组件智能判断 - 内部路由调用 `router.push()`，外部链接直接跳转

### Hash 模式实现

- **D-29:** Hash 模式同时支持 `#/path` 和 `#path` 两种格式，自动规范化
- **D-30:** Hash 模式支持基础路径（`base`）配置，所有路由路径相对于这个 base
- **D-31:** History 模式和 Hash 模式的 API 和行为完全统一，只需在初始化时选择模式
- **D-32:** Hash 模式下的滚动位置恢复与 History 模式完全一致

### 404 处理机制

- **D-33:** 同时支持通配符路由（`*`）和专门的 `notFound` 字段配置 404 页面，通配符路由优先
- **D-34:** 访问未匹配路由时重定向到 `/404`，URL 会改变
- **D-35:** 嵌套路由中子路由未匹配时继承父级的 404 配置
- **D-36:** 懒加载路由的组件加载失败时使用错误边界处理，与 404 分开处理

### 动态路由注册

- **D-37:** 动态路由 API 使用基础方法设计 - `addRoute(route)`、`removeRoute(name)`
- **D-38:** 动态添加的路由与静态路由使用统一的优先级规则，不区分动态/静态
- **D-39:** 删除当前正在访问的路由时自动重定向到默认路由或 404 页面
- **D-40:** 只提供单个路由的添加和删除操作，不支持批量操作

### 默认路径重定向

- **D-41:** 默认路径通过根路由配置中的 `defaultRoute` 字段指定
- **D-42:** 默认路径重定向触发完整的导航流程，包括守卫、组件加载等
- **D-43:** 自动检测循环重定向，超过阈值后抛出错误防止浏览器挂起
- **D-44:** 支持嵌套路由配置自己的默认路径

### Claude's Discretion

- 参数解析算法的具体实现细节
- 路由匹配算法的性能优化策略
- 开发调试工具的具体功能和实现方式
- 错误提示信息的文案和格式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` - v1 需求定义，包含所有 45 个需求项的详细描述
- `.planning/ROADMAP.md` - Phase 1 详细信息和成功标准

### 代码库分析
- `.planning/codebase/STRUCTURE.md` - 代码库结构和关键文件位置
- `.planning/codebase/CONVENTIONS.md` - 编码约定和设计模式
- `.planning/codebase/ARCHITECTURE.md` - 架构模式和层级结构

### 现有实现
- `src/features/context.ts` - Context 传播系统的现有实现
- `src/components/base/index.ts` - KylinRouterElementBase 基类和上下文获取机制
- `src/router.ts` - KylinRouter 主类和 Mixin 架构
- `src/types.ts` - RouteItem 和 KylinRouterOptions 类型定义

### 项目配置
- `.planning/PROJECT.md` - 项目愿景、约束条件和关键决策
- `CLAUDE.md` - 项目文档和技术栈说明

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Context 传播系统** - `src/features/context.ts` 已实现完整的 context 提供者机制，通过 `context-request` 事件传播 router 实例
- **基础组件类** - `src/components/base/index.ts` 提供了 `KylinRouterElementBase`，支持同步和异步获取 router 实例
- **路由器骨架** - `src/router.ts` 定义了 `KylinRouter` 类和 Mixin 架构，已集成 History API 和基础导航方法
- **类型定义** - `src/types.ts` 定义了 `RouteItem` 和 `KylinRouterOptions` 类型，包含完整的路由配置字段

### Established Patterns

- **Mixin 架构** - 通过 `ts-mixer` 实现特性的模块化组合，每个特性独立为一个 Mixin 类
- **上下文传播** - 使用自定义的 `context-request` 事件而非 `@lit/context`，避免额外依赖
- **Light DOM** - 组件使用 Light DOM 而非 Shadow DOM，便于样式和事件穿透
- **事件清理** - 使用 `_cleanups` 数组管理清理函数，在 `detach()` 中统一清理

### Integration Points

- **路由器初始化** - `KylinRouter` 构造函数接受 `host` 元素和 `options`，设置 `data-kylin-router` 属性和调用 `attachContextProvider()`
- **组件连接** - `KylinRouterElementBase.connectedCallback()` 自动触发上下文请求，获取 router 实例
- **导航方法** - `push()`、`replace()`、`back()`、`forward()` 方法已实现但需要添加路由匹配逻辑
- **History 监听** - `history.listen()` 已在 `attach()` 中设置，`onRouteUpdate()` 回调需要实现路由匹配和参数解析

</code_context>

<specifics>
## Specific Ideas

- 用户希望路由匹配支持混合策略，既支持嵌套路由的前缀匹配，也支持叶子节点的完全匹配
- 错误处理需要非常灵活，通过 `failure` 参数支持多种策略（error/redirect/back/none/自定义函数）
- 滚动行为应该滚动到 outlet 组件位置而非页面顶部，更符合 SPA 的用户体验
- 守卫执行顺序从内到外（组件级 → 路由级 → 全局），与 React Router 等主流框架相反
- Hash 模式和 History 模式应该完全统一，API 和行为保持一致
- 404 处理时重定向到 `/404`，URL 会改变，更符合传统网页行为
- 动态路由与静态路由使用统一的优先级规则，不因为添加时间不同而有所区别

</specifics>

<deferred>
## Deferred Ideas

### 下一阶段处理的功能
- **路由守卫系统（beforeEach、beforeResolve、afterEach）** - Phase 2 实现
- **嵌套路由的 Outlet 渲染机制** - Phase 2 实现
- **组件加载系统（本地和远程 HTML）** - Phase 3 实现
- **KeepAlive 缓存机制** - Phase 4 实现
- **转场动画** - Phase 5 实现

### 暂不讨论的高级特性
- **服务器配置相关的 Hash 模式限制** - 当前专注客户端实现
- **路由级代码分割** - 应由构建工具处理，不在路由器层面实现
- **浏览器历史状态管理（state）** - 当前未明确需求，延后讨论

</deferred>

---

*Phase: 01-context*
*Context gathered: 2026-04-07*
