# Kylin Router - 项目文档

> **最后更新：** 2026-04-04 10:12:22
> **架构版本：** v1.0.0
> **文档类型：** 根级架构文档

---

## 变更记录 (Changelog)

### 2026-04-04 10:12:22

- 初始化项目架构文档
- 完成项目结构分析与模块识别
- 创建根级与模块级文档
- 建立模块索引与依赖关系图

---

## 项目愿景

Kylin Router 是一个基于 **Lit (Web Components)** 和`history` 的现代化前端路由库，旨在构建轻量级、高性能的路由库

**核心特性：**

- 基于 Web Components 标准，无框架依赖
- TypeScript 严格模式，确保类型安全
- HMR 热模块替换，提升开发体验

---

## 架构总览

### 技术栈

```
前端框架：Lit 3.3.2 (Web Components)
构建工具：Vite 8.0.1
开发语言：TypeScript 6.0.2 (严格模式)
路由管理：History 5.3.0
包管理器：Bun
目标运行时：ES2023 + 现代浏览器
```

### 项目类型

- **组件库** 基础架构展示
- **Vite + Lit** 快速启动模板

---

## 运行与开发

### 环境要求

- **Node.js**: >= 18.0.0
- **包管理器**: Bun (推荐) 或 npm/yarn/pnpm
- **浏览器**: 支持ES2023的现代浏览器（Chrome、Firefox、Edge、Safari最新版）

### 快速开始

```bash
# 安装依赖
bun install

# 启动开发服务器（支持HMR）
bun run dev

# 类型检查 + 生产构建
bun run build

# 预览生产构建
bun run preview
```

### 开发服务器

- **默认端口**: http://localhost:5173
- **HMR**: 自动热更新，修改 `src/` 下文件自动刷新
- **TypeScript**: 实时类型检查，错误会显示在终端和浏览器

---

## 测试策略

**当前状态：** 项目暂无测试配置

**推荐测试方案：**

1. **单元测试**: 使用 `@web/test-runner` + `@open-wc/testing`
2. **组件测试**: 使用 `@lit-labs/testing` 模拟 Shadow DOM
3. **E2E测试**: 使用 Playwright 或 Cypress
4. **覆盖率目标**: 建议保持 > 80%

**测试命令示例：**

```bash
# 推荐添加到 package.json
"test": "wtr",
"test:watch": "wtr --watch",
"test:coverage": "wtr --coverage"
```

---

## 编码规范

### TypeScript 配置

- **严格模式**: 启用 (`strict: true`)
- **装饰器**: 实验性支持 (`experimentalDecorators: true`)
- **未使用变量检查**: 启用 (`noUnusedLocals`, `noUnusedParameters`)
- **目标版本**: ES2023

### 代码风格

- **组件定义**: 使用 `@customElement` 装饰器
- **响应式属性**: 使用 `@property` 装饰器
- **样式**: Shadow DOM 内部 CSS，使用 CSS 变量支持主题
- **命名**: PascalCase 用于组件，camelCase 用于方法和变量

### Git 提交规范

```bash
# 推荐的提交消息格式
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建/工具变更
```

---

## AI 使用指引

### 对 AI 助手的建议

1. **组件开发**: 优先使用 Lit 装饰器语法，保持与现有代码风格一致
2. **类型安全**: 所有公共API必须有完整的 TypeScript 类型注解
3. **响应式设计**: 新组件应考虑移动端适配，使用媒体查询
4. **性能优化**: 避免在 `render()` 中创建新函数/对象，使用类方法

### 常见任务

- **主题定制**: 修改 `:host` CSS 变量定义
- **构建优化**: 调整 `vite.config.ts`（如需添加）

---

## 关键依赖说明

### 核心依赖

- **lit**: 3.3.2 - Web Components 基础框架
- **history**: 5.3.0 - 路由历史管理

### 开发依赖

- **typescript**: 6.0.2 - 类型检查与编译
- **vite**: 8.0.1 - 构建工具与开发服务器

---

## 项目文件树

```
kylin-router/
├── .gitignore              # Git 忽略规则
├── package.json            # 项目配置与依赖
├── tsconfig.json           # TypeScript 配置
├── index.html              # 应用入口 HTML
├── CLAUDE.md               # 根级文档（本文件）
├── src/
│   ├── CLAUDE.md           # 模块级文档
│   ├── index.css           # 全局样式
│   └── assets/             # 静态资源
│       ├── hero.png
│       ├── lit.svg
│       └── vite.svg
└── node_modules/           # 依赖包（忽略）
```

---

## 下一步建议

### 功能扩展

- [ ] 添加路由功能（集成 `history` 库）
- [ ] 创建更多示例组件（如导航栏、页面容器）
- [ ] 添加单元测试配置
- [ ] 集成 ESLint + Prettier 代码规范工具

### 文档完善

- [ ] 添加组件 API 文档（使用 TSDoc）
- [ ] 创建 Storybook 组件展示
- [ ] 编写贡献指南 (CONTRIBUTING.md)

---

**文档维护者：** Claude AI Architect
**文档生成时间：** 2026-04-04 10:12:22
**项目状态：** 活跃开发中

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Kylin Router**

Kylin Router 是一个基于 Lit 和 History API 的现代化前端路由库，采用 Outlet 渲染模式和 Mixin 架构设计。它为 Web Components 应用提供完整的企业级路由解决方案，支持嵌套路由、动态参数、守卫、缓存、动画等全功能，同时保持框架无关和轻量级特性。

适用于需要灵活路由方案的 Web Components 应用，特别是基于 Lit 构建的企业级项目和需要微前端架构的复杂应用。

**Core Value:** **灵活且强大的 Web Components 路由解决方案** - 通过 Outlet 模式和 Mixin 架构，提供企业级路由功能的同时保持开发体验和代码可维护性。

如果其他特性都可以取舍，路由必须能够：**可靠地根据 URL 变化渲染正确的组件，并提供完整的导航生命周期管理**。

### Constraints

- **技术栈**: 必须使用 Lit 3.3.2 和 History 5.3.0 - 与现有代码和生态保持一致
- **框架无关**: 不依赖 Vue、React 等框架 - 保持 Web Components 原生特性
- **模块化**: 特性按功能拆分到 `src/features/` - 确保代码可维护性
- **现代浏览器**: 仅支持 ES2021+ 浏览器 - 充分利用现代 Web API
- **TypeScript**: 完整的类型定义 - 确保类型安全和开发体验
- **轻量级**: 功能优先，但注意避免不必要的依赖和代码膨胀
- **路由特性**： KylinRouter是核心路由入口，相关的特性实现统一保存在src/features，特性通过两种方式进行扩展实现：
      - 使用ts-mixer通过Mixin的方式进行功能扩展,但是Mixin最多只支持10个特性，超过10个特性需要使用第二种方式进行功能扩展
      - 简单逻辑创建一个函数，具有独立数据管理采用管理器的方式进行功能扩展，函数或管理器接受KylinRouter实例作为参数，并在实例上添加相关功能，如有需要清理统一放进KylinRouter的_cleanups数组中，KylinRouter在适当的时候会调用这些清理函数进行清理.
- **示例**：保存在 `example/` 目录

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 6.0.2 - Core language for all application code
- ES2021 - Target runtime compatibility
## Runtime
- Browser runtime (ES2021 + modern browsers)
- Bun 1.3.11 - Package manager and runtime for tests
- Node.js 25.5.2 - Type definitions and compatibility
- Bun 1.3.11 - Primary package manager
- Lockfile: No package-lock.json or bun.lockb detected
## Frameworks
- Lit 3.3.2 - Web Components framework for building custom elements
- History 5.3.0 - Client-side routing history management
- Happy DOM 20.8.9 - DOM implementation for testing
- Bun test - Test runner
- Vite 8.0.1 - Build tool and development server
- TypeScript compiler - Type checking and compilation
## Key Dependencies
- @lit/context 1.1.6 - Context management for Lit components
- history 5.3.0 - Client-side routing
- lit 3.3.2 - Web Components framework
- mitt 3.0.1 - Event emitter for component communication
- ts-mixer 6.0.4 - Class mixin utility for multiple inheritance
- TypeScript 6.0.2 - Type safety and compilation
- @types/bun 1.3.11 - Bun type definitions
- @types/node 25.5.2 - Node.js type definitions
## Configuration
- TypeScript configuration in `tsconfig.json`
- Strict mode enabled with comprehensive linting rules
- Path aliases: `@/*` mapped to `./src/*`
- Vite configuration in `vite.config.ts`
- Development server on port 5173
- Build output to `../dist`
- Support for HMR (Hot Module Replacement)
## Platform Requirements
- Node.js >= 18.0.0
- Bun (recommended) or npm/yarn/pnpm
- Modern browsers supporting ES2021
- Modern browsers (Chrome, Firefox, Edge, Safari latest versions)
- No external runtime dependencies
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## 命名模式
- PascalCase 用于组件文件：`components/base/index.ts`
- camelCase 用于工具文件：`utils/traverseOutlet.ts`
- 统一使用 `.ts` 扩展名
- camelCase 用于所有函数：`_getRouterSync()`、`_requestRouterContext()`、`calculateOutletLevel()`
- 私有函数以下划线前缀开头
- 类方法使用帕斯卡命名构造函数
- camelCase 用于普通变量：`allOutlets`、`maxLevel`
- 私有变量以下划线前缀开头：`_contextRequested`、`_cleanups`
- 类属性使用帕斯卡命名构造函数
- 接口使用 PascalCase：`RouteItem`、`KylinRouterOptiopns`
- 类型别名使用 PascalCase：`OutletRefs`、`ContextCallback`
- 泛型使用描述性名称：`ValueType`、`RouteItem`
## 代码风格
- 工具：`oxfmt` (Oxlint formatter)
- Tab 宽度：4 空格
- 严格模式：启用所有 TypeScript 严格检查
- 代码检查：`oxlint` 自定义配置
- `typescript/no-floating-promises`: 禁用
- `typescript/no-redundant-type-constituents`: 禁用
## 设计模式和惯用语法
- `KylinRouterElementBase` 为所有路由组件提供基础功能
- 使用 Light DOM 而不是 Shadow DOM：`createRenderRoot() { return this; }`
- 通过 context 获取 router 实例
- 使用 `Promise<boolean>` 进行导航守卫
- 同步/异步获取 router 实例的双模式支持
## 错误处理方法
- 构造函数参数验证：`throw new Error("KylinRouter must be initialized with an HTMLElement as host")`
- 路由导航守卫：返回 `boolean | Promise<boolean>`
- 异步加载错误：未显式捕获，依赖 Promise 链式处理
- 深层嵌套查找性能测试：验证查找时间合理性
- DOM 层级穿越：使用 while 循环安全遍历父元素
- 内存泄漏防护：使用 `WeakRef` 避免内存泄漏
- 严格 TypeScript 模式
- 可选链操作符：`this.router?.push()`
- 类型断言：`(host as any).router = this`
## 文档注释
- `ignorePrivate: false` - 检查私有成员
- `ignoreReplacesDocs: true` - 忽略重复文档
- `overrideReplacesDocs: true` - 覆盖文档
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- LitElement-based Web Components using customElement decorators
- Mixin pattern for feature composition (Context, Hooks, ComponentLoader, KeepAlive, Transition, Preload)
- Context-based dependency injection for router instance propagation
- History API integration for client-side routing
- Light DOM approach for better style and event penetration
## Layers
- Purpose: Central router orchestrator and history management
- Location: `src/router.ts`
- Contains: `KylinRouter` class, navigation methods (push, replace, back, forward), cleanup management
- Depends on: history library, Mixin pattern, TypeScript strict mode
- Used by: Host elements, outlet components
- Purpose: Common base class and shared functionality
- Location: `src/components/base/index.ts`
- Contains: `KylinRouterElementBase` class, context injection mechanism, light DOM rendering
- Depends on: LitElement, custom context events
- Used by: All router-aware components (link, outlet, loading)
- Purpose: Cross-cutting concerns and advanced routing features
- Location: `src/features/`
- Contains: Feature classes as mixins (Context, Hooks, ComponentLoader, KeepAlive, Transition, Preload)
- Depends on: Core router, TypeScript utilities (ts-mixer)
- Used by: KylinRouter through Mixin composition
- Purpose: UI components for routing interface
- Location: `src/components/`
- Contains: `kylin-link`, `kylin-outlet`, `kylin-loading` components
- Depends on: Base component class, LitElement decorators
- Used by: Application developers in templates
- Purpose: Helper functions and utilities
- Location: `src/utils/`
- Contains: Path manipulation, outlet traversal utilities
- Depends on: TypeScript type system
- Used by: Router components and features
## Data Flow
- Router instance propagated via context events
- Component state managed by LitElement reactive properties
- Route state managed by history API and internal router properties
## Key Abstractions
- Purpose: Base class providing router instance access
- Examples: `[src/components/base/index.ts]`
- Pattern: Context injection with fallback mechanisms
- Purpose: Main router orchestrator with mixin composition
- Examples: `[src/router.ts]`
- Pattern: Mixin pattern for feature composition
- Purpose: Route rendering container with caching
- Examples: `[src/components/outlet/index.ts]`
- Pattern: Slot-based rendering with dynamic component loading
- Purpose: Dependency injection without prop drilling
- Examples: `[src/features/context.ts]`
- Pattern: Event-based context propagation
## Entry Points
- Location: `src/index.ts`
- Triggers: Component registration and type exports
- Responsibilities: Import and re-export all components and utilities
- Location: `src/router.ts`
- Triggers: Router instantiation and configuration
- Responsibilities: Router class definition, navigation methods, feature mixing
- Location: `example/public/app/index.html`
- Triggers: Application initialization
- Responsibilities: Template structure with router components
## Error Handling
- Component lifecycle error handling in `connectedCallback`
- History listener cleanup in `disconnectCallback`
- Type-safe error handling with TypeScript strict mode
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
