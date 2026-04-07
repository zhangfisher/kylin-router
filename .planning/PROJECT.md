# Kylin Router

## What This Is

Kylin Router 是一个基于 Lit 和 History API 的现代化前端路由库，采用 Outlet 渲染模式和 Mixin 架构设计。它为 Web Components 应用提供完整的企业级路由解决方案，支持嵌套路由、动态参数、守卫、缓存、动画等全功能，同时保持框架无关和轻量级特性。

适用于需要灵活路由方案的 Web Components 应用，特别是基于 Lit 构建的企业级项目和需要微前端架构的复杂应用。

## Core Value

**灵活且强大的 Web Components 路由解决方案** - 通过 Outlet 模式和 Mixin 架构，提供企业级路由功能的同时保持开发体验和代码可维护性。

如果其他特性都可以取舍，路由必须能够：**可靠地根据 URL 变化渲染正确的组件，并提供完整的导航生命周期管理**。

## Requirements

### Validated

#### 核心路由功能
- ✓ **路由表定义与匹配** - 支持 path、component、children 等配置 [Phase 1]
- ✓ **动态路由参数** - 支持 `/user/:id` 模式和参数解析 [Phase 1]
- ✓ **404 处理** - 未匹配路由的兜底页面 [Phase 1]
- ✓ **编程式导航** - push、replace、back、forward 方法 [Phase 1]
- ✓ **Hash 模式支持** - createHashHistory 和路径规范化 [Phase 1]
- ✓ **动态路由注册** - addRoute/removeRoute API [Phase 1]
- ✓ **默认重定向** - 默认路由重定向和循环检测 [Phase 1]
- ✓ **远程路由表** - loadRemoteRoutes 支持同步/异步加载 [Phase 1]

#### 现有基础设施
- ✓ **TypeScript 严格模式** - 类型安全和完整的类型推断
- ✓ **Mixin 架构设计** - 模块化的特性组合机制
- ✓ **上下文传播系统** - 基于 `@lit/context` 的依赖注入
- ✓ **History API 集成** - 浏览器前进后退支持
- ✓ **组件基础设施** - `KylinRouterElementBase` 基类和上下文获取机制

### Active

#### 核心路由功能
- [ ] **嵌套路由** - 支持多层路由嵌套和路径继承
- [ ] **路由守卫** - beforeEach、beforeResolve、afterEach 钩子

#### 组件渲染系统
- [ ] **Outlet 渲染机制** - 基于 `<kylin-outlet>` 的动态组件渲染
- [ ] **本地组件支持** - 渲染任意 HTML 元素或 Web Component
- [ ] **远程加载支持** - fetch URL + lit/html 渲染到 outlet
- [ ] **渲染错误处理** - 组件渲染失败时的错误边界

#### 高级特性
- [ ] **路由缓存** - KeepAlive 机制保持组件状态
- [ ] **转场动画** - 路由切换时的过渡效果
- [ ] **加载状态** - Loading 组件和加载动画
- [ ] **数据预加载** - 路由切换前的数据预取
- [ ] **预加载机制** - 预加载未来可能访问的路由

#### 错误处理
- [ ] **404 处理** - 未匹配路由的兜底页面
- [ ] **加载失败处理** - 远程组件加载失败的重试和降级
- [ ] **错误边界** - 全局错误监听和恢复机制

#### 开发体验
- [ ] **完整的 TypeScript 支持** - 类型定义和泛型支持
- [ ] **调试工具** - 开发环境下的路由信息和调试辅助
- [ ] **链接组件** - `<kylin-link>` 声明式导航

#### 文档与测试
- [ ] **API 文档** - 完整的 JSDoc/TSDoc 注释
- [ ] **使用示例** - 常见场景的代码示例
- [ ] **架构文档** - 设计思路和最佳实践
- [ ] **单元测试** - 核心功能的单元测试覆盖
- [ ] **集成测试** - 路由流程的集成测试

### Out of Scope

- **Vue/React 集成** - 专注于 Web Components 生态，不提供其他框架的适配层
- **服务端渲染 (SSR)** - 当前专注于客户端渲染，SSR 在未来版本考虑
- **Hash 路由模式** - 优先支持 HTML5 History 模式，hash 模式可选
- **路由代码分割** - 构建时的代码分割由打包工具处理
- **IE 浏览器支持** - 仅支持现代浏览器（Chrome、Firefox、Safari、Edge 最新版）

## Context

**项目背景：**
- 现有前端路由方案（如 React Router、Vue Router）过于复杂且与特定框架强耦合
- Web Components 生态缺乏完整的路由解决方案
- 企业内部需要轻量级、灵活且功能完整的路由库来支持微前端架构

**技术环境：**
- 基于 Lit 3.3.2 和 Web Components 标准
- 使用 TypeScript 严格模式确保代码质量
- History 5.3.0 提供浏览器历史管理
- Vite 8.0.1 作为构建工具

**现有代码状态：**
- 已完成基础架构设计和 Mixin 机制
- 核心类 `KylinRouter` 和基础组件已定义
- 特性模块化设计已确立（`src/features/` 目录）
- 需要实现各个特性的具体逻辑

**设计决策：**
- **Mixin 架构** - 每个特性独立为一个 Mixin 类，在 `KylinRouter` 中组合
- **Outlet 模式** - 通过 `<kylin-outlet>` 组件声明路由渲染位置
- **上下文传播** - 使用 `@lit/context` 实现路由实例的依赖注入
- **Light DOM** - 使用 Light DOM 而非 Shadow DOM，便于样式和事件处理

## Constraints

- **技术栈**: 必须使用 Lit 3.3.2 和 History 5.3.0 - 与现有代码和生态保持一致
- **框架无关**: 不依赖 Vue、React 等框架 - 保持 Web Components 原生特性
- **模块化**: 特性按功能拆分到 `src/features/` - 确保代码可维护性
- **现代浏览器**: 仅支持 ES2021+ 浏览器 - 充分利用现代 Web API
- **TypeScript**: 完整的类型定义 - 确保类型安全和开发体验
- **轻量级**: 功能优先，但注意避免不必要的依赖和代码膨胀

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mixin 架构模式 | 通过 ts-mixer 实现特性的模块化组合，每个特性独立开发和测试 | ✅ Implemented - RouterContext mixin 提供依赖注入 |
| @lit/context 依赖注入 | 提供类型安全的上下文传播机制，替代传统的 prop drilling | ✅ Implemented - context-request 事件系统 |
| Hash/History 模式统一 | 通过模式选择提供一致的开发体验，支持不同部署环境 | ✅ Implemented - createBrowserHistory/createHashHistory 统一 API |
| 动态路由注册 | 运行时动态添加/删除路由，支持配置驱动的路由管理 | ✅ Implemented - addRoute/removeRoute API |
| 循环检测机制 | 防止无限重定向导致浏览器挂起，设置最大重定向次数 | ✅ Implemented - MAX_REDIRECTS = 10 |
| Outlet 渲染模式 | 类似 React Router 的 Outlet 概念，提供声明式的路由渲染位置 | — Pending |
| Light DOM 策略 | 避免 Shadow DOM 的样式隔离问题，便于全局样式和事件穿透 | — Pending |
| 远程 HTML 加载 | 支持从 URL fetch HTML 字符串，使用 lit/html 渲染，支持微前端场景 | — Pending |
| 功能优先策略 | 企业级项目功能完整性优先于极致性能优化 | — Pending |

## Evolution

本文档在阶段转换和里程碑边界时进行演进。

**每次阶段转换后**（通过 `/gsd-transition`）：
1. 需求失效？→ 移至 Out of Scope 并说明原因
2. 需求验证？→ 移至 Validated 并标注阶段
3. 新需求浮现？→ 添加至 Active
4. 决策记录？→ 添加至 Key Decisions
5. "What This Is" 仍然准确？→ 如有偏移则更新

**每次里程碑完成后**（通过 `/gsd-complete-milestone`）：
1. 审查所有章节
2. Core Value 检查 - 仍然是正确的优先级吗？
3. 审计 Out of Scope - 原因仍然有效吗？
4. 用当前状态更新 Context（用户、反馈、指标）

---
*Last updated: 2026-04-07 after Phase 1 completion*
