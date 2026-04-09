# Roadmap: Kylin Router

## Overview

Kylin Router v1.0 开发旅程从基础设施构建开始，逐步实现核心路由功能、生命周期管理、组件加载系统、性能优化，最终交付用户体验增强。每个阶段基于 `src/features/` 下的特性模块组织，确保模块化和可维护性。从 Context 上下文传播系统开始，建立依赖注入基础；然后实现 Hooks 路由守卫系统，提供完整的导航生命周期；接着构建 Loader/Render/Data 组件加载系统，支持本地和远程组件渲染；之后添加 KeepAlive/Preload 性能优化特性；最后实现 Transition/Model 用户体验增强功能。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Context（上下文传播）** - 建立路由实例的依赖注入系统
- [x] **Phase 1.1: Refactor Routes（代码重构）** - 消除 router.ts 与 Routes mixin 的代码重复
- [ ] **Phase 2: Hooks（生命周期钩子）** - 实现路由守卫和导航生命周期管理
- [ ] **Phase 3: Loader + Render + Data（组件加载系统）** - 构建完整的组件加载、渲染和数据管理功能
- [ ] **Phase 4: KeepAlive + Preload（性能优化）** - 实现路由缓存和智能预加载机制
- [ ] **Phase 5: Transition + Model（用户体验增强）** - 添加转场动画和模态窗口功能

## Phase Details

### Phase 1: Context（上下文传播）
**Goal**: 建立路由实例的依赖注入系统，使组件树中的任意元素都能访问路由状态和方法
**Depends on**: Nothing（第一阶段）
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-07, CORE-08, CORE-09, CORE-10, CORE-11, CORE-12, GUARD-07, ERROR-03
**Success Criteria** (what must be TRUE):
  1. 用户可以定义路由表，包含 path、component、children 等配置
  2. 路由器支持动态路由参数（如 `/user/:id`）并正确解析参数值
  3. 用户可以通过编程式导航（push、replace、back、forward）切换路由
  4. 用户可以通过 `<kylin-link>` 组件进行声明式导航
  5. 路由器在未匹配到路由时显示 404 页面或兜底组件
  6. 组件可以通过 context-request 事件获取路由实例，访问路由状态和方法
  7. 事件监听器在断开时自动清理，防止内存泄漏
**Plans**: 3 plans

**Plan List:**
- [x] 01-01-PLAN.md — 实现路由核心系统（路由匹配算法、参数解析、404 处理）
- [x] 01-02-PLAN.md — 实现导航系统（编程式导航 API、声明式导航组件）
- [x] 01-03-PLAN.md — 实现高级路由功能（Hash 模式、动态路由注册、默认重定向、远程路由表）

### Phase 1.1: Refactor Routes（代码重构）INSERTED
**Goal**: 消除 router.ts 与 Routes mixin 之间的代码重复，提高代码可维护性
**Depends on**: Phase 1（需要在 Routes mixin 完成后进行重构）
**Requirements**: REFACTOR-01
**Success Criteria** (what must be TRUE):
  1. router.ts 中所有路由管理逻辑移除，通过 Routes mixin 提供
  2. 重复代码删除，仅保留 KylinRouter 特有的逻辑
  3. 所有功能保持完全一致
  4. 类型定义保持兼容
  5. 测试全部通过
**Plans**: 1 plan

**Plan List:**
- [x] 1.1-01-PLAN.md — 重构 router.ts，移除与 Routes mixin 重复的代码

### Phase 2: Hooks（生命周期钩子）
**Goal**: 实现路由守卫系统，在导航前后执行验证、数据预取和清理逻辑
**Depends on**: Phase 1.1（需要在代码重构完成后，确保清晰的代码结构）
**Requirements**: GUARD-01, GUARD-02, GUARD-03, GUARD-04, GUARD-05, GUARD-06, CORE-05, CORE-06, UX-06, UX-07, ERROR-04
**Success Criteria** (what must be TRUE):
  1. 路由器支持 beforeEach 钩子，在导航前执行权限验证等逻辑
  2. 路由器支持 renderEach 钩子，在组件渲染前执行数据预取
  3. 路由器支持 afterEach 钩子，在导航完成后执行清理逻辑
  4. 路由守卫支持异步操作（权限验证、数据预加载）
  5. 路由守卫可以取消导航或重定向到其他路由
  6. 路由器支持多层嵌套路由，路径自动继承和匹配
  7. 路由级守卫（beforeEnter、afterLeave）与全局钩子协同工作
  8. 嵌套路由的守卫执行顺序正确，父路由守卫优先执行
  9. 数据预加载机制正常工作，预加载数据通过 route.data 传递给组件
  10. 路由器检测路由守卫无限循环，设置最大重定向次数防止浏览器挂起
**Plans**: 4 plans

**Plan List:**
- [x] 02-01-PLAN.md — 实现全局钩子系统（beforeEach、renderEach、afterEach）
- [x] 02-02-PLAN.md — 实现路由级守卫系统（beforeEnter、afterLeave）
- [x] 02-03-PLAN.md — 实现数据预加载机制（renderEach + route.data）
- [ ] 02-04-PLAN.md — 完善钩子系统集成、测试和文档

### Phase 3: Loader + Render + Data（组件加载系统）
**Goal**: 构建完整的组件加载、渲染和数据管理系统，支持本地和远程组件
**Depends on**: Phase 2（需要稳定的导航流程和 Outlet 渲染机制）
**Requirements**: LOAD-01, LOAD-02, LOAD-03, LOAD-04, LOAD-05, UX-03, MODAL-01, MODAL-02, MODAL-03, ERROR-01, ERROR-02
**Success Criteria** (what must be TRUE):
  1. 路由器支持本地组件动态导入，使用 lit/html 渲染到 outlet
  2. 路由器支持远程 HTML 加载，通过 fetch URL 获取内容
  3. 路由器在组件加载失败时显示错误边界组件
  4. 路由器实现自动重试机制，加载失败时重试加载
  5. 路由器提供 `<kylin-loading>` 组件显示加载状态
  6. 路由器支持模态路由渲染，在 host 元素下的 `<div class="kylin-modals">` 中打开模态框
  7. 模态路由支持背景遮罩和关闭交互
  8. 模态路由可以与普通路由共存，支持多层模态
  9. 路由器实现全局错误边界，捕获组件渲染错误
  10. 路由器在导航竞态条件时丢弃旧响应，避免状态混乱
**Plans**: 5 plans
**Plan List:**
- [x] 03-01-PLAN.md — 实现组件加载系统（本地组件、动态导入、远程 HTML）
- [x] 03-02-PLAN.md — 实现组件渲染系统（lit 模板、变量插值、嵌套 outlet）
- [x] 03-03-PLAN.md — 实现错误处理和重试机制（错误边界、重试策略、导航竞态控制）
- [x] 03-04-PLAN.md — 实现模态路由系统（模态容器、模态栈、背景遮罩）
- [ ] 03-05-PLAN.md — 创建使用示例和集成测试

### Phase 4: KeepAlive + Preload（性能优化）
**Goal**: 实现路由缓存和智能预加载机制，提升应用性能和用户体验
**Depends on**: Phase 3（需要稳定的组件加载和渲染系统）
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05
**Success Criteria** (what must be TRUE):
  1. 路由器支持 KeepAlive 缓存机制，保持组件状态避免重复渲染
  2. KeepAlive 缓存策略支持 LRU 算法，防止内存过度占用
  3. 路由器支持智能预加载，根据用户行为预测并预加载路由
  4. 路由器支持鼠标悬停预加载，提升导航响应速度
  5. 路由器自动恢复滚动位置，在返回时保持浏览位置
**Plans**: TBD

### Phase 5: Transition + Model（用户体验增强）
**Goal**: 添加转场动画和高级用户体验特性，使路由切换更加流畅自然
**Depends on**: Phase 4（所有核心功能稳定后，添加锦上添花的特性）
**Requirements**: UX-01, UX-02, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. 路由器支持转场动画，路由切换时显示过渡效果
  2. 路由器基于 View Transitions API 实现动画效果
  3. 路由器提供开发工具，支持路由可视化调试
  4. 路由器在开发环境提供警告系统，提示常见错误
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5
| 3. Loader+Render+Data（组件加载系统） | 4/5 | In Progress|  |
| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Context（上下文传播） | 3/3 | ✅ Completed | 2026-04-07 |
| 1.1. Refactor Routes（代码重构） | 1/1 | ✅ Completed | 2026-04-07 |
| 2. Hooks（生命周期钩子） | 1/4 | In Progress|  |
| 3. Loader+Render+Data（组件加载系统） | 0/TBD | Not started | - |
| 4. KeepAlive+Preload（性能优化） | 0/TBD | Not started | - |
| 5. Transition+Model（用户体验增强） | 0/TBD | Not started | - |

---

*Roadmap updated: 2026-04-07 after Phase 2 planning*
