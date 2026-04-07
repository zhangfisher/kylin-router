# Codebase Structure

**Analysis Date:** 2026-04-07

## Directory Layout

```
kylin-router/
├── .gitignore              # Git 忽略规则
├── package.json            # 项目配置与依赖
├── tsconfig.json           # TypeScript 配置
├── index.html              # 应用入口 HTML
├── CLAUDE.md               # 根级文档
├── src/                    # 源代码目录
│   ├── index.ts            # 主入口文件
│   ├── router.ts           # 路由核心类
│   ├── types.ts            # TypeScript 类型定义
│   ├── components/          # 组件目录
│   │   ├── index.ts        # 组件导出
│   │   ├── base/           # 基础组件
│   │   │   └── index.ts    # 基础组件类
│   │   ├── link/           # 链接组件
│   │   │   └── index.ts    # 链接组件实现
│   │   ├── outlet/         # 路由出口组件
│   │   │   ├── index.ts    # 出口组件实现
│   │   │   └── styles.ts   # 出口组件样式
│   │   └── loading/        # 加载组件
│   │       └── index.ts    # 加载组件实现
│   ├── features/           # 功能模块目录
│   │   ├── index.ts        # 功能导出
│   │   ├── context.ts      # 上下文管理
│   │   ├── hooks.ts        # 路由钩子
│   │   ├── loader.ts       # 组件加载器
│   │   ├── keepAlive.ts    # 组件缓存
│   │   ├── transition.ts   # 路由过渡
│   │   ├── model.ts        # 路由到模态窗口
│   │   ├── data.ts         # 数据加载器
│   │   ├── render.ts       # 将组件渲染到outlet
│   │   ├── transition.ts   # 路由过渡
│   │   └── preload.ts      # 预加载功能
│   ├── utils/              # 工具函数目录
│   │   ├── index.ts        # 工具导出
│   │   ├── joinPath.ts     # 路径连接工具
│   │   └── traverseOutlet.ts # 出口遍历工具
│   └── __tests__/          # 测试目录
│       ├── components.base.test.ts      # 基础组件测试
│       └── utils.traverseOutlet.test.ts # 工具函数测试
├── example/                # 示例应用
│   └── public/
│       └── app/
│           └── index.html  # 示例页面
├── .planning/              # 规划文档
│   └── codebase/           # 架构分析文档
├── .claude/                # Claude AI 相关
└── node_modules/           # 依赖包
```

## Directory Purposes

**src/components/:**
- Purpose: Web Components for routing interface
- Contains: Link, Outlet, Loading components
- Key files: `[src/components/base/index.ts]`, `[src/components/link/index.ts]`, `[src/components/outlet/index.ts]`

**src/features/:**
- Purpose: Advanced routing features and cross-cutting concerns
- Contains: Context management, hooks, loading, caching, transitions
- Key files: `[src/features/context.ts]`, `[src/features/loader.ts]`, `[src/features/keepAlive.ts]`

**src/utils/:**
- Purpose: Helper functions and utilities
- Contains: Path manipulation, outlet traversal utilities
- Key files: `[src/utils/joinPath.ts]`, `[src/utils/traverseOutlet.ts]`

**example/public/app/:**
- Purpose: Application demonstrating router usage
- Contains: Template structure with router components
- Key files: `[example/public/app/index.html]`

## Key File Locations

**Entry Points:**
- `[src/index.ts]`: Component registration and type exports
- `[src/router.ts]`: Main router orchestrator class

**Configuration:**
- `[package.json]`: Project dependencies and scripts
- `[tsconfig.json]`: TypeScript configuration (strict mode)

**Core Logic:**
- `[src/types.ts]`: Route types and configuration interfaces
- `[src/components/base/index.ts]`: Base component with context injection
- `[src/features/context.ts]`: Context provider implementation

**Testing:**
- `[src/__tests__/]`: Test files for components and utilities
- `[example/public/app/index.html]`: Integration example

## Naming Conventions

**Files:**
- PascalCase for component files: `KylinLinkElement`, `KylinOutletElement`
- camelCase for utility functions: `joinPath`, `traverseOutlet`
- kebab-case for feature modules: `context.ts`, `loader.ts`

**Directories:**
- plural names for feature groups: `components/`, `features/`, `utils/`
- singular names for specific modules: `link/`, `outlet/`, `loading/`

**Classes:**
- PascalCase for all classes: `KylinRouter`, `KylinRouterElementBase`
- camelCase for methods and properties: `push`, `replace`, `connectedCallback`

**Types:**
- PascalCase for interfaces: `RouteItem`, `KylinRouterOptiopns`
- camelCase for type aliases and utility types

## Where to Add New Code

**New Feature:**
- Primary code: `[src/features/]`
- Tests: `[src/__tests__/]`

**New Component:**
- Implementation: `[src/components/]`
- Styles: `[src/components/[name]/styles.ts]`
- Tests: `[src/__tests__/components.[name].test.ts]`

**Utilities:**
- Shared helpers: `[src/utils/]`
- Tests: `[src/__tests__/utils.[name].test.ts]`

**Configuration:**
- TypeScript types: `[src/types.ts]`
- Package updates: `[package.json]`

## Special Directories

**src/features/:**
- Purpose: Advanced routing features as mixins
- Generated: No
- Committed: Yes - contains core functionality

**src/components/base/:**
- Purpose: Base component with context injection
- Generated: No
- Committed: Yes - foundation for all components

**example/public/app/:**
- Purpose: Application demonstrating usage patterns
- Generated: No
- Committed: Yes - provides integration examples

---

*Structure analysis: 2026-04-07*