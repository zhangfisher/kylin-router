# 技术栈研究

**领域：** 前端路由库
**研究日期：** 2026-04-07
**置信度：** HIGH

## 推荐技术栈

### 核心框架

| 技术 | 版本 | 用途 | 推荐理由 |
|------|------|------|----------|
| **Lit** | 3.3.2 | Web Components 基础框架 | 轻量级（~5KB）、快速渲染、完整的 Web Components 标准支持、21.4k+ GitHub stars、企业级成熟度 |
| **History** | 5.3.0 | 客户端路由历史管理 | React Router v7 底层依赖、8.3k+ GitHub stars、行业标准 API、390万+ npm 使用量 |
| **TypeScript** | 6.0.2 | 类型安全语言 | 严格模式提供完整类型推断、2025年前端开发标准、生态系统主导地位 |

### 架构支持库

| 库 | 版本 | 用途 | 使用场景 |
|------|------|------|----------|
| **@lit/context** | 1.1.6 | 上下文传播系统 | 类型安全的依赖注入、替代 prop drilling、路由实例传递到子组件 |
| **ts-mixer** | 6.0.4 | 类 Mixin 工具 | 实现特性的模块化组合、多重继承模式、按需加载路由特性 |
| **mitt** | 3.0.1 | 事件发射器 | 组件间通信、路由事件系统、轻量级（~200 bytes） |

### 开发工具

| 工具 | 用途 | 配置建议 |
|------|------|----------|
| **Vite** | 构建工具与开发服务器 | 支持 HMR、快速热更新、ES2023 目标、路径别名 `@/*` |
| **Bun** | 包管理器和测试运行器 | 1.3.11 版本、快速安装、原生 TypeScript 测试 |
| **Happy DOM** | 测试环境 DOM 实现 | 20.8.9 版本、轻量级 JSDOM 替代、与 Bun 测试集成 |

## 安装

```bash
# 核心依赖
bun add lit@^3.3.2 history@^5.3.0

# 架构支持
bun add @lit/context@^1.1.6 ts-mixer@^6.0.4 mitt@^3.0.1

# 开发依赖
bun add -D typescript@^6.0.2 vite@^8.0.1 happy-dom@^20.8.9 @types/node@^25.5.2
```

## 替代方案

| 推荐 | 替代方案 | 何时使用替代方案 |
|------|----------|------------------|
| **Lit + History** | **React Router v7** | 项目已有 React 生态、需要 SSR 支持 |
| **Lit + History** | **TanStack Router** | 需要完整的类型安全路由、数据加载集成、文件路由 |
| **History 5.3.0** | **Navigation API** | 现代浏览器环境、实验性功能、不兼容旧浏览器 |
| **TypeScript** | **JavaScript** | 快速原型、无类型需求、非企业级项目 |

## 不推荐使用

| 避免使用 | 原因 | 推荐替代 |
|----------|------|----------|
| **@lit-labs/router** | 官方标记为实验性、维护状态不明确、生产环境风险 | **自定义 History 5.3.0 集成** |
| **Vaadin Router** | 框架耦合、定制性差、与 Mixin 架构不兼容 | **基于 History 的自研方案** |
| **Hash 路由模式** | SEO 不友好、URL 不美观、不符合 2025 年标准 | **HTML5 History 模式** |
| **JavaScript (无类型)** | 企业级项目需要类型安全、重构风险高、维护成本大 | **TypeScript 严格模式** |
| **JSDOM** | 重量级、启动慢、内存占用大 | **Happy DOM** |

## 技术栈变体模式

**如果构建微前端架构：**
- 使用 **Module Federation** 或 **原生 ES Modules**
- 因为支持独立部署和版本管理

**如果需要 SSR 支持：**
- 考虑 **@lit-labs/ssr** + **@lit-labs/ssr-client**
- 因为 Lit 官方服务端渲染方案

**如果优先考虑类型安全：**
- 采用 **TypeScript 严格模式** + **完整的泛型定义**
- 因为 2025 年路由库的核心竞争力在于类型推断

## 版本兼容性

| 包 A | 兼容版本 | 兼容性说明 |
|------|----------|------------|
| **lit 3.3.2** | TypeScript 6.0.2 ✅ | Lit 完全支持 TypeScript 严格模式 |
| **history 5.3.0** | TypeScript 6.0.2 ✅ | 官方 @types/history 包已包含 |
| **@lit/context 1.1.6** | lit 3.3.2 ✅ | 官方兼容性测试通过 |
| **ts-mixer 6.0.4** | TypeScript 6.0.2 ✅ | 完全支持装饰器和类混入 |
| **Vite 8.0.1** | ES2023 目标 ✅ | 支持 Lit 的现代特性 |

## 2025 年路由库技术栈关键趋势

### 1. **类型安全至上**
- **TanStack Router** 开创了 100% 类型推断路由的先河
- 路由参数、查询参数、导航状态全部自动推断
- 编译时错误检查成为标准

### 2. **数据加载集成**
- 路由级别的数据预取（TanStack Router、React Router v7）
- 并行数据加载、智能缓存、Stale-While-Revalidate
- 解决请求瀑布问题

### 3. **轻量级与性能**
- Lit 的 ~5KB 体积成为 Web Components 生态标杆
- 快速渲染（仅更新动态部分）
- 自动代码分割

### 4. **Web Components 标准化**
- 浏览器原生支持、互操作性
- Shadow DOM 样式隔离
- 跨框架使用

### 5. **现代构建工具**
- Vite 成为主流构建工具（快速 HMR）
- Bun 作为包管理器和测试运行器
- ES2023 作为目标运行时

## 与 Kylin Router 现有技术栈的对比

| 技术维度 | 现有选择 | 2025 年标准 | 符合度 |
|----------|----------|-------------|--------|
| **Web Components 框架** | Lit 3.3.2 | Lit 3.x | ✅ 完全符合 |
| **历史管理** | History 5.3.0 | History 5.x | ✅ 完全符合 |
| **类型系统** | TypeScript 6.0.2 | TypeScript 严格模式 | ✅ 完全符合 |
| **构建工具** | Vite 8.0.1 | Vite 8.x | ✅ 完全符合 |
| **包管理器** | Bun 1.3.11 | Bun（趋势） | ✅ 完全符合 |
| **上下文管理** | @lit/context 1.1.6 | @lit/context | ✅ 完全符合 |
| **测试环境** | Happy DOM 20.8.9 | Happy DOM（推荐） | ✅ 完全符合 |

**结论：** Kylin Router 的现有技术栈完全符合 2025 年前端路由库的最佳实践，无需进行重大技术栈调整。

## 技术栈决策原则

### 选择 Lit 的原因
1. **轻量级** - ~5KB 体积，符合路由库的核心定位
2. **标准合规** - 完全基于 Web Components 标准，未来兼容性好
3. **性能优异** - 仅更新动态部分，渲染速度快
4. **生态成熟** - 21.4k+ GitHub stars，企业级应用广泛
5. **框架无关** - 可在任何框架或无框架环境使用

### 选择 History 5.3.0 的原因
1. **行业标准** - React Router v7 底层依赖，390万+ 使用量
2. **API 稳定** - 成熟的 API 设计，长期维护
3. **完整功能** - 支持 pushState、replaceState、popstate 事件
4. **类型完整** - 官方 TypeScript 支持
5. **浏览器兼容** - 良好的降级支持

### 选择 TypeScript 严格模式的原因
1. **类型安全** - 路由参数、配置全部类型推断
2. **开发体验** - 自动补全、编译时错误检查
3. **重构保障** - 大型项目重构的安全网
4. **2025 标准** - 企业级项目的标配
5. **生态主导** - 2025 年前端开发生态的核心语言

## 路由库特定技术栈建议

### 核心技术（必需）
- ✅ **Lit 3.3.2** - 组件渲染
- ✅ **History 5.3.0** - 路由历史管理
- ✅ **TypeScript 6.0.2** - 类型安全

### 架构支持（推荐）
- ✅ **@lit/context 1.1.6** - 路由上下文传播
- ✅ **ts-mixer 6.0.4** - Mixin 架构实现
- ✅ **mitt 3.0.1** - 事件系统

### 开发工具（推荐）
- ✅ **Vite 8.0.1** - 构建与开发服务器
- ✅ **Bun 1.3.11** - 包管理与测试
- ✅ **Happy DOM 20.8.9** - 测试环境

### 可选增强
- 🤔 **@lit-labs/ssr** - 服务端渲染（如需要）
- 🤔 **@lit-labs/motion** - 路由转场动画
- 🤔 **URLPattern API** - 现代路由匹配（浏览器支持允许）

## 信息来源

- [Lit 官方文档](https://lit.dev) — Lit 核心特性、性能优势、Web Components 标准支持（置信度：HIGH）
- [Lit GitHub 仓库](https://github.com/lit/lit) — 版本信息、生态系统、21.4k stars、维护状态（置信度：HIGH）
- [History 5.3.0 GitHub](https://github.com/remix-run/history) — React Router v7 依赖、390万+ 使用量、API 文档（置信度：HIGH）
- [TanStack Router 特性分析](https://blog.dennisokeeffe.com/blog/2025-03-16-effective-typescript-principles-in-2025) — 2025 年类型安全趋势、路由库发展方向（置信度：MEDIUM）
- [React Router 2025 最佳实践](https://medium.com/@nishchay340/mastering-react-routing-a-complete-guide-to-client-side-navigation-d4ecfcbbadf0) — 客户端路由模式、BrowserRouter 标准（置信度：MEDIUM）
- [前端开发必备：TanStack Router 完全指南](https://juejin.cn/post/7471459224309383208) — 路由库对比、TypeScript 支持分析（置信度：MEDIUM）
- [React+AI 技术栈（2025 版）](https://blog.csdn.net/React_Community/article/details/145842386) — 2025 年技术栈趋势、路由库选型（置信度：MEDIUM）

---
**技术栈研究领域：** 前端路由库
**研究完成日期：** 2026-04-07
**下次审查日期：** 2026-07-07（季度审查）
