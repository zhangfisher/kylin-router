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
开发语言：TypeScript 5.9.3 (严格模式)
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
