# Feature Research

**Domain:** 前端路由库（Web Components）
**Researched:** 2026-04-07
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **路由匹配与URL解析** | 所有路由库的核心功能，用户期望能将 URL 映射到组件 | MEDIUM | 支持 `/users/:id` 动态参数、查询参数解析、hash 处理 |
| **嵌套路由** | 现代应用的标配，支持多层布局和页面嵌套 | HIGH | 需要 Outlet 模式支持父子路由渲染 |
| **编程式导航** | 用户期望能通过代码控制页面跳转 | LOW | push、replace、back、forward 方法 |
| **声明式导航** | 提供链接组件，支持 SEO 和可访问性 | LOW | `<kylin-link>` 组件，拦截默认行为 |
| **路由生命周期钩子** | 权限控制、数据预取、页面切换逻辑的必备能力 | MEDIUM | beforeEach、beforeResolve、afterEach 钩子 |
| **404 处理** | 未匹配路由的兜底页面，用户期望有友好的错误提示 | LOW | 通配符路由或 catch-all 机制 |
| **History API 支持** | 现代浏览器的标准，支持前进后退按钮 | MEDIUM | 基于 History 5.x 库的实现 |
| **TypeScript 类型支持** | 2026 年的标配，用户期望完整的类型推断 | MEDIUM | 泛型支持、路由配置类型推导 |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Outlet 渲染模式** | 类似 React Router v6 的 Outlet 概念，提供声明式的路由渲染位置 | MEDIUM | 与现有 Web Components 路由库的差异化点 |
| **Mixin 架构设计** | 模块化的特性组合机制，用户可以按需引入功能 | HIGH | 通过 ts-mixer 实现特性的独立开发和测试 |
| **远程组件加载** | 支持从 URL fetch HTML 字符串，使用 lit/html 渲染 | HIGH | 支持微前端场景，动态加载远程组件 |
| **路由缓存（KeepAlive）** | 保持组件状态，避免重复渲染和数据请求 | HIGH | 类似 Vue 的 `<KeepAlive>`，提升用户体验 |
| **转场动画系统** | 提供流畅的页面切换体验，支持自定义动画 | MEDIUM | 基于 View Transitions API 或 CSS 动画 |
| **数据预加载** | 路由切换前的数据预取，提升页面加载速度 | MEDIUM | 在路由守卫中预取数据，避免空白页面 |
| **智能预加载** | 预加载用户可能访问的路由，实现瞬时导航 | HIGH | 基于用户行为预测，预加载组件和数据 |
| **上下文传播系统** | 基于 `@lit/context` 的依赖注入，避免 prop drilling | MEDIUM | 类型安全的上下文传播机制 |
| **Light DOM 策略** | 避免 Shadow DOM 的样式隔离问题，便于全局样式和事件穿透 | LOW | 简化样式处理和事件监听 |
| **框架无关性** | 纯 Web Components 实现，可与任何框架或原生 JS 配合使用 | MEDIUM | 不依赖 Vue、React 等框架 |
| **完整的错误边界** | 组件渲染失败时的优雅降级和错误恢复 | MEDIUM | 全局错误监听和错误组件渲染 |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Hash 路由模式** | 兼容旧浏览器或特殊部署场景 | 2026 年已无必要，History API 是标准，SEO 差 | 使用 HTML5 History 模式，服务器配置 fallback |
| **服务端渲染（SSR）** | 提升 SEO 和首屏加载速度 | 极大增加复杂度，与 Web Components 的客户端定位冲突 | 使用预渲染或静态站点生成，未来版本考虑 |
| **代码分割集成** | 减少初始加载包大小 | 应该由 Vite/webpack 等构建工具处理，路由库不应侵入构建流程 | 依赖构建工具的动态 import |
| **Vue/React 适配层** | 吸引更广泛的用户群体 | 与"框架无关"定位冲突，增加维护成本 | 专注于 Web Components 生态 |
| **复杂的状态管理集成** | 期望路由库管理全局状态 | 职责不清，应该由专门的状态管理库处理 | 提供 hooks 让用户集成自己的状态管理 |
| **路由元信息系统** | 定义路由的标题、图标等元数据 | 容易过度设计，大多数场景下组件内部处理即可 | 简单的配置对象，不引入复杂的元信息系统 |
| **过度细粒度的权限控制** | 基于角色的路由级权限 | 业务逻辑应该在应用层处理，路由层只提供基础守卫 | 提供灵活的路由守卫，不内置权限系统 |

## Feature Dependencies

```
[路由匹配与URL解析]
    └──requires──> [History API 支持]
                   └──enhances──> [编程式导航]
                                   └──enhances──> [声明式导航]

[嵌套路由]
    └──requires──> [Outlet 渲染模式]
                   └──enhances──> [路由生命周期钩子]
                                   └──requires──> [TypeScript 类型支持]

[路由缓存（KeepAlive）]
    └──enhances──> [数据预加载]
                   └──conflicts──> [智能预加载]（缓存策略可能冲突）

[转场动画系统]
    └──enhances──> [路由生命周期钩子]

[远程组件加载]
    └──requires──> [Outlet 渲染模式]
                   └──requires──> [完整的错误边界]
                                   └──requires──> [路由生命周期钩子]

[Mixin 架构设计]
    └──underlies──> [所有特性模块]
```

### Dependency Notes

- **[路由匹配] requires [History API 支持]:** 路由匹配需要监听 URL 变化，这是 History API 提供的能力
- **[嵌套路由] requires [Outlet 渲染模式]:** 嵌套路由需要一个渲染位置来展示子路由组件
- **[路由缓存] enhances [数据预加载]:** 缓存可以避免重复的数据请求，与预加载配合效果更好
- **[路由缓存] conflicts [智能预加载]:** 缓存策略可能与预加载策略冲突，需要协调机制
- **[远程组件加载] requires [完整的错误边界]:** 远程加载可能失败，必须有错误处理机制
- **[Mixin 架构] underlies [所有特性模块]:** Mixin 架构是基础设施，所有特性都基于此实现

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **路由匹配与URL解析** — 核心功能，没有这个无法称为路由库
- [ ] **History API 支持** — URL 监听和操作的基础
- [ ] **编程式导航** — 基本的页面跳转能力
- [ ] **声明式导航** — 提供 `<kylin-link>` 组件
- [ ] **嵌套路由** — 现代应用的基本需求
- [ ] **Outlet 渲染模式** — 嵌套路由的必要支持
- [ ] **404 处理** — 基本的错误处理
- [ ] **TypeScript 类型支持** — 开发体验的基础

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **路由生命周期钩子** — 用户反馈需要权限控制和数据预取
- [ ] **路由缓存（KeepAlive）** — 用户反馈需要保持页面状态
- [ ] **数据预加载** — 用户反馈需要提升页面加载速度
- [ ] **完整的错误边界** — 用户反馈需要更好的错误处理
- [ ] **上下文传播系统** — 用户反馈需要依赖注入机制

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **远程组件加载** — 微前端场景，需要验证市场需求
- [ ] **转场动画系统** — 提升用户体验，但非核心功能
- [ ] **智能预加载** — 性能优化，复杂度高，需要验证收益
- [ ] **Mixin 架构设计** — 内部架构优化，对用户不可见

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 路由匹配与URL解析 | HIGH | MEDIUM | P1 |
| History API 支持 | HIGH | MEDIUM | P1 |
| 编程式导航 | HIGH | LOW | P1 |
| 声明式导航 | HIGH | LOW | P1 |
| 嵌套路由 | HIGH | HIGH | P1 |
| Outlet 渲染模式 | HIGH | MEDIUM | P1 |
| 404 处理 | MEDIUM | LOW | P1 |
| TypeScript 类型支持 | HIGH | MEDIUM | P1 |
| 路由生命周期钩子 | HIGH | MEDIUM | P2 |
| 路由缓存（KeepAlive） | MEDIUM | HIGH | P2 |
| 数据预加载 | MEDIUM | MEDIUM | P2 |
| 完整的错误边界 | MEDIUM | MEDIUM | P2 |
| 上下文传播系统 | MEDIUM | MEDIUM | P2 |
| 远程组件加载 | LOW | HIGH | P3 |
| 转场动画系统 | LOW | MEDIUM | P3 |
| 智能预加载 | LOW | HIGH | P3 |
| Mixin 架构设计 | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch（v1 MVP）
- P2: Should have, add when possible（v1.x）
- P3: Nice to have, future consideration（v2+）

## Competitor Feature Analysis

| Feature | React Router v6 | Vue Router v4 | Vaadin Router | Our Approach |
|---------|----------------|---------------|---------------|--------------|
| 路由模式 | History/Hash/Memory | History/Hash | History | 优先 History，Hash 可选 |
| 动态参数 | ✅ `/users/:id` | ✅ `/users/:id` | ✅ `/users/:id` | ✅ 相同 |
| 嵌套路由 | ✅ Outlet 模式 | ✅ Router View | ✅ 子路由配置 | ✅ Outlet 模式 |
| 路由守卫 | ✅ loader/action | ✅ beforeEach/afterEach | ✅ 回调函数 | ✅ 类似 Vue Router |
| 声明式导航 | ✅ `<Link>` | ✅ `<RouterLink>` | ❌ 需手动实现 | ✅ `<kylin-link>` |
| 框架集成 | React 专用 | Vue 专用 | 框架无关 | ✅ 框架无关（Web Components） |
| TypeScript | ✅ 完整支持 | ✅ 完整支持 | ⚠️ 部分支持 | ✅ 完整支持 |
| SSR 支持 | ✅（Remix） | ✅（Nuxt.js） | ❌ | ❌ v1 不支持 |
| 数据预加载 | ✅ loader | ✅ navigation guards | ❌ | ✅ 路由守卫中实现 |
| 路由缓存 | ❌ | ✅ `<KeepAlive>` | ❌ | ✅ 计划支持 |
| 远程组件 | ❌ | ❌ | ❌ | ✅ 差异化功能 |

## Sources

- [React Router Main Concepts](https://reactrouter.com/en/main/start/concepts) - HIGH confidence，官方文档
- [Vaadin Router GitHub](https://github.com/vaadin/router) - HIGH confidence，官方仓库
- [前端路由核心功能对比](https://zhuanlan.zhihu.com/p/1955952678027900349) - MEDIUM confidence，技术文章
- [Vue Router vs React Router 对比](https://juejin.cn/post/7104242876007055396) - MEDIUM confidence，掘金文章
- [React Router Complete Guide 2026](https://www.boundev.com/blog/react-router-tutorial-complete-guide-2026) - MEDIUM confidence，2026 年最新指南
- [GoRouter Advanced Tutorial 2026](https://techwithsam.medium.com/gorouter-advanced-tutorial-2026-bottom-nav-nested-routes-auth-redirects-typed-navigation-9bebad5b4993) - MEDIUM confidence，2026 年最佳实践
- [Mastering Smooth Page Transitions with View Transitions API](https://dev.to/krish_kakadiya_5f0eaf6342/mastering-smooth-page-transitions-with-the-view-transitions-api-in-2026-31of) - MEDIUM confidence，转场动画
- [Next.js Prefetching Guide](https://nextjs.org/docs/app/guides/prefetching) - HIGH confidence，预加载策略
- [Microfrontends & Module Federation in 2026](https://kawaldeepsingh.medium.com/microfrontends-module-federation-in-2026-a-practical-playbook-for-frontend-teams-4445c93fe61f) - MEDIUM confidence，微前端趋势
- [TanStack Router vs React Router 2026](https://betterstack.com/community/guides/scaling-nodejs/tanstack-router-vs-react-router/) - MEDIUM confidence，路由库对比
- [Go项目设计反模式](https://tonybai.com/2025/04/21/go-project-design-antipatterns/) - MEDIUM confidence，设计陷阱
- [技术选型与过度设计陷阱](https://juejin.cn/post/7620621154106277898) - MEDIUM confidence，架构设计
- [React Router SSR Security CVE](https://access.redhat.com/security/cve/cve-2026-21884) - HIGH confidence，安全问题

---
*Feature research for: Kylin Router - Web Components 路由库*
*Researched: 2026-04-07*
