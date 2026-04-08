# Phase 3: Loader + Render + Data（组件加载系统）- Discussion Log

> **Audit trail only.** Do not use this input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 03-loader-render-data
**Mode:** discuss
**Areas discussed:** 组件加载与渲染、加载状态与错误处理、模态路由系统、数据管理与竞态控制

---

## 组件加载与渲染

### 组件定义支持

| Option | Description | Selected |
|--------|-------------|----------|
| Web Components | 支持 @customElement 装饰器定义的 Web Components，直接实例化并渲染到 outlet | |
| LitElement 类 | 支持继承自 LitElement 的类，动态创建自定义元素并渲染 | |
| 渲染函数 | 支持返回 lit/html TemplateResult 的函数，直接渲染模板 | |
| 普通元素 + URL | 支持普通 HTML 元素和 URL 字符串（fetch 远程 HTML） | ✓ |

**User's choice:** 支持两种类型：普通 HTML 元素和 URL 字符串，从该 url 加载 html 并注入到 outlet
**Notes:** 用户专注于微前端场景，支持远程 HTML 加载

### 远程 HTML 提取策略

| Option | Description | Selected |
|--------|-------------|----------|
| lit/html 渲染 | 使用 lit/html 的 html`` 模板函数，支持插值和表达式 | |
| innerHTML | 使用 innerHTML 直接设置 HTML 字符串 | |
| DOMParser | 使用 DOMParser API 解析 HTML，然后逐个插入节点 | |
| 智能提取 | 完整 HTML 文件取 body，存在 data-outlet 属性的元素则选择该元素 | ✓ |

**User's choice:** 如果加载的 html 是一个完整的 html 文件，则只取 body，如果存在 data-outlet 的元素则选择此元素
**Notes:** 类似 qiankun 的做法，精确控制要渲染的部分

### 组件替换模式

| Option | Description | Selected |
|--------|-------------|----------|
| 追加模式 | 使用 appendChild，保留旧的子节点直到新组件加载完成 | |
| 清空模式 | 使用 innerHTML = '' 清空后，再添加新组件 | |
| 隐藏模式 | 先隐藏旧组件，加载完成后再移除并显示新组件 | |
| 替换模式 + 追加属性 | 默认替换，但如果新内容支持 data-outlet-append 则追加 | ✓ |

**User's choice:** 默认使用替代模式，但是如果新内容支持 data-outlet-append 则追加。加载的内容本质上是一个 lit 的模板，支持将数据传给该模板进行渲染
**Notes:** 通过 data-outlet-append 属性提供灵活性

### 嵌套 Outlet 渲染顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 从内到外 | 先渲染最深层嵌套的 outlet，再向上渲染父级 | |
| 从外到内 | 先渲染父级 outlet，再递归渲染子级的 outlet | |
| 并行渲染 | 所有层级的 outlet 同时开始加载和渲染 | ✓ |
| 自适应策略 | 根据路由配置的 priority 字段决定渲染顺序 | |

**User's choice:** 并行渲染
**Notes:** 最大化性能

### 组件懒加载

| Option | Description | Selected |
|--------|-------------|----------|
| 函数返回 Promise | route.component 可以是一个返回 Promise 的函数 | |
| 异步函数 | route.component 可以是一个 async 函数 | |
| 自动检测 | 同时支持同步和异步，自动判断 | |
| 不支持懒加载 | 所有组件必须在路由配置时已经注册 | |

**User's choice:** 组件只支持存在的 html 元素，和从远程加载 lit 模板进行渲染
**Notes:** 专注于 HTML 元素和远程 lit 模板，不支持传统的组件懒加载

### 安全性防护

| Option | Description | Selected |
|--------|-------------|----------|
| HTML 清理 | 使用 DOMPurify 等库清理 HTML | |
| CSP 策略 | 使用 Content Security Policy 头来限制脚本执行 | |
| 开发者责任 | 信任来自可信来源的 HTML，开发者自行确保安全 | |
| 可配置 | 提供配置选项 allowUnsafeHTML，默认 false | ✓ |

**User's choice:** 可配置
**Notes:** 通过 allowUnsafeHTML 配置控制安全级别

### 组件清理机制

| Option | Description | Selected |
|--------|-------------|----------|
| 生命周期钩子 | 自动调用组件的 disconnectedCallback() | |
| 自动 GC | 从 DOM 移除后即丢弃 | |
| 清理方法 | 检查组件是否有 destroy() 或 dispose() 方法 | |
| KeepAlive 控制 | 根据 keepalive=true 时进行缓存，否则丢弃 | ✓ |

**User's choice:** 根据路由的 keepalive=true 时进行缓存，否则丢弃
**Notes:** KeepAlive 通过路由配置控制

### 数据传递方式

| Option | Description | Selected |
|--------|-------------|----------|
| route 对象 | lit 模板可以访问 route 对象 | |
| data 参数 | lit 模板接收一个 data 参数 | |
| 变量展开 | 将 route.data 的所有字段展开为局部变量 | |
| router + route + 展开 | lit 模板接收 router 和 route 变量，route.data 展开为局部变量 | ✓ |

**User's choice:** lit 模板接收 router 和 route 变量，同 route.data 展开为局部变量
**Notes:** 简化数据访问，如 ${userId} 而不是 ${route.data.userId}

---

## 加载状态与错误处理

### 加载指示器样式

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind 主题 | 使用 Tailwind CSS，提供多种预设主题 | |
| CSS 动画 | 使用简单的 CSS 动画，默认旋转 spinner | |
| SVG 图标 | 使用 SVG 图标，提供预设图标 | |
| 自定义模板 | 允许开发者提供自定义模板 | ✓ |

**User's choice:** 自定义模板
**Notes:** <kylin-loading><div>自定义加载...</div></kylin-loading>

### 错误边界配置

| Option | Description | Selected |
|--------|-------------|----------|
| 路由配置 | 在路由配置中设置 errorComponent 字段 | |
| 全局配置 | 在全局 router 配置中设置 defaultErrorComponent | |
| 组件包裹 | 提供 <kylin-error-boundary> 组件 | |
| 两级配置 | 支持路由级和全局两种配置，路由配置优先 | ✓ |

**User's choice:** 两级配置
**Notes:** 路由配置 > 全局配置

### 重试策略

| Option | Description | Selected |
|--------|-------------|----------|
| 固定重试 | 固定重试 3 次，每次间隔 1 秒 | |
| 可配置 | 在路由配置中设置 retry 字段 | |
| 指数退避 | 使用指数退避策略 | |
| 混合策略 | 固定重试 + 可配置 + 手动重试 | ✓ |

**User's choice:** 固定重试 3 次，也可以配置重试，提供手动重试
**Notes:** 默认固定重试 3 次，支持自定义，提供 retry() 方法

### 嵌套加载状态

| Option | Description | Selected |
|--------|-------------|----------|
| 独立显示 | 为每个 outlet 显示独立的加载指示器 | |
| 仅外层 | 只在最外层的 outlet 显示加载指示器 | ✓ |
| 全局加载 | 提供全局加载指示器，覆盖整个页面 | |
| 可配置 | 根据路由配置的 loading 属性决定 | |

**User's choice:** 仅外层
**Notes:** 避免多个加载指示器造成混乱

### 加载超时

| Option | Description | Selected |
|--------|-------------|----------|
| 固定 5 秒 | 固定 5 秒超时 | |
| 组件属性 | 使用 outlet 的 timeout 属性 | |
| 路由配置 | 在路由配置中设置 timeout 字段 | |
| 多层级 | 路由配置 > outlet 属性 > 默认值（5 秒） | ✓ |

**User's choice:** 多层级
**Notes:** 路由配置 > outlet 属性 > 默认值（5 秒）

---

## 模态路由系统

### 模态路由声明

| Option | Description | Selected |
|--------|-------------|----------|
| modal 字段 | 在路由配置中使用 modal 字段 | ✓ |
| type 字段 | 在路由配置中使用 type 字段 | |
| meta 配置 | 在路由 meta 中设置 | |
| 路径前缀 | 使用特殊的路由路径前缀，如 '!/user/:id' | |

**User's choice:** modal 字段
**Notes:** { path: '/user/:id', component: UserProfile, modal: true }

### 模态渲染位置

| Option | Description | Selected |
|--------|-------------|----------|
| host 子元素 | 渲染到 host 元素的直接子元素中 | |
| 专用容器 | 渲染到 host 元素下的 <div class="kylin-modals"> 中 | ✓ |
| body 层级 | 渲染到 document.body 的子元素中 | |
| 父级 outlet | 渲染到最近的父级 outlet 中 | |

**User's choice:** 专用容器
**Notes:** 渲染到 host 元素下的 <div class="kylin-modals"> 中

### 背景遮罩

| Option | Description | Selected |
|--------|-------------|----------|
| 自动遮罩 | 自动添加背景遮罩，点击遮罩关闭模态框 | |
| 可配置 | 提供 backdrop 配置 | ✓ |
| 组件实现 | 不自动添加遮罩，由模态组件自行实现 | |
| 自动判断 | 根据模态类型自动判断 | |

**User's choice:** 可配置
**Notes:** 通过 backdrop 配置字段控制

### 多层模态

| Option | Description | Selected |
|--------|-------------|----------|
| 模态栈 | 支持多层模态，新模态覆盖在旧模态之上 | ✓ |
| 单一模态 | 只支持一个模态，打开新模态时自动关闭旧模态 | |
| 可配置 | 在路由配置中设置 allowStack 字段 | |
| 自动判断 | 根据模态的 closable 属性决定 | |

**User's choice:** 模态栈
**Notes:** 支持多个模态叠加，形成一个模态栈

### 模态关闭方式

| Option | Description | Selected |
|--------|-------------|----------|
| router.back() | 调用 router.back() 关闭当前模态 | |
| closeModal() | 提供专门的 router.closeModal() 方法 | |
| 都支持 | router.back() 和 router.closeModal() 都可以 | ✓ |
| 事件驱动 | 触发自定义事件，由模态组件自行处理 | |

**User's choice:** 都支持
**Notes:** router.back() 和 router.closeModal() 都可以

---

## 数据管理与竞态控制

### 数据传递方式

| Option | Description | Selected |
|--------|-------------|----------|
| router 对象 | 通过 router 对象传递 | |
| route 对象 | 直接修改 route 对象 | |
| renderEach 钩子 | 通过 renderEach 钩子的第二个参数传递 | |
| 多种方式 | router.setData()、route.data 和 renderEach 都可以 | ✓ |

**User's choice:** 多种方式
**Notes:** router.setData()、route.data 和 renderEach 都可以

### 数据合并策略

| Option | Description | Selected |
|--------|-------------|----------|
| 浅合并 | 只合并第一层属性，嵌套对象直接覆盖 | |
| 深合并 | 递归合并所有层级的属性 | ✓ |
| 可配置 | 在路由配置中设置 mergeStrategy 字段 | |
| 自动判断 | 根据数据类型自动判断 | |

**User's choice:** 深合并
**Notes:** 递归合并所有层级的属性，保留嵌套结构

### 竞态检测机制

| Option | Description | Selected |
|--------|-------------|----------|
| 导航 ID | 每次导航生成一个唯一的 navigationId | |
| 版本号 | 使用递增的版本号，只接受最新版本的响应 | ✓ |
| 时间戳 | 使用时间戳，比较请求和响应的时间戳 | |
| Promise 取消 | 使用 Promise 的 race 机制 | |

**User's choice:** 版本号
**Notes:** 每次导航版本号 +1，只接受最新版本的响应

### 请求取消策略

| Option | Description | Selected |
|--------|-------------|----------|
| AbortController | 使用 AbortController，取消旧的 fetch 请求 | ✓ |
| 忽略响应 | 在请求回调中检查版本号，过时则忽略 | |
| 可配置 | 通过 abortStaleRequests 配置决定 | |
| 混合策略 | 同时支持 AbortController 和忽略响应 | |

**User's choice:** AbortController
**Notes:** 新的导航调用 abort() 取消旧的 fetch 请求

### 数据加载超时

| Option | Description | Selected |
|--------|-------------|----------|
| 固定 10 秒 | 固定 10 秒超时 | |
| 路由配置 | 使用路由配置的 timeout 字段 | |
| 钩子配置 | 在 renderEach 钩子中设置超时 | |
| 多层级 | 钩子配置 > 路由配置 > 默认值（10 秒） | ✓ |

**User's choice:** 多层级
**Notes:** 钩子配置 > 路由配置 > 默认值（10 秒）

---

## Claude's Discretion

以下区域用户表示"你决定"或未明确指定，留给 Claude 在实现时灵活处理：

- lit 模板的具体渲染实现细节
- 版本号机制的具体实现方式
- AbortController 的具体集成方式
- 深合并算法的具体实现细节
- 模态栈的具体数据结构和管理方式
- 错误提示信息的文案和格式
- 加载指示器的默认行为和样式
- 测试文档和示例代码的具体内容

---

## Deferred Ideas

无新延期想法 - 讨论保持在 Phase 3 的范围内。
