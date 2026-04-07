# Phase 2: Hooks（导航生命周期钩子）- Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 02-hooks
**Areas discussed:** 钩子API设计, 异步守卫处理, 守卫取消机制, 数据预加载机制, 钩子性能优化, 嵌套路由守卫, 钩子与路由状态, 钩子测试支持, 钩子错误边界

---

## 1. 钩子API设计

| Option | Description | Selected |
|--------|-------------|----------|
| 链式API | 使用router.beforeEach()等方法注册全局钩子,路由配置中添加beforeEnter/afterEnter字段,组件使用@RouteGuard装饰器 | |
| 事件监听 | 使用router.on('beforeEach', fn)事件模式,路由配置中使用hooks数组,组件实现生命周期方法 | |
| 配置对象 | 在router配置中集中定义所有钩子,路由配置支持hooks对象,组件通过静态属性定义钩子 | ✓ |

**User's choice:** 配置对象
**Notes:** 用户倾向于在router配置中集中定义所有钩子的方式

---

| Option | Description | Selected |
|--------|-------------|----------|
| next回调模式 | hook(to, from, next) — next是回调函数,next()继续,next(false)取消,next('/path')重定向 | ✓ |
| 返回值模式 | hook(to, from) — 返回undefined继续,返回false取消,返回'/path'重定向,返回Promise处理异步 | |
| 对象返回模式 | hook(to, from) — 返回Navigation对象{continue:boolean, redirect?:string},支持Promise<Navigation> | |

**User's choice:** next回调模式
**Notes:** 选择提供最大控制力的模式,虽然需要手动调用next

---

| Option | Description | Selected |
|--------|-------------|----------|
| beforeEnter/afterLeave | 在RouteItem中添加beforeEnter和afterLeave字段 | ✓ |
| hooks对象 | 在RouteItem中添加hooks对象{beforeResolve,afterEnter} | |
| guards数组 | 在RouteItem中添加guards数组 | |

**User's choice:** beforeEnter/afterLeave
**Notes:** 与Vue Router保持一致,熟悉度高

---

| Option | Description | Selected |
|--------|-------------|----------|
| 生命周期方法 | 组件类实现onBeforeEnter(to, from, next)等方法 | |
| 装饰器模式 | 使用@RouteGuard装饰器标记方法 | |
| 静态属性 | 组件类定义静态属性beforeEnter、afterLeave | |
| Other | 路由库是框架无关的,暂不支持组件级钩子 | ✓ |

**User's choice:** 路由库是框架无关的,暂不支持组件级钩子
**Notes:** 重要决策 - 只支持全局和路由级两个层次,专注于Web Components原生特性

---

| Option | Description | Selected |
|--------|-------------|----------|
| 支持移除 | 提供router.removeHook(hookId)方法 | |
| 不可移除 | 钩子一旦注册无法移除 | |
| Other | 通过router.hooks.beforeEach,router.hooks.afterEach,router.hooks.beforeResolve来管理 | ✓ |

**User's choice:** 通过router.hooks对象管理所有注册的hook
**Notes:** 用户提供了具体的设计方案 - router.hooks是对应的hook[]

---

| Option | Description | Selected |
|--------|-------------|----------|
| 注册顺序 | 同类型钩子按注册顺序(FIFO)执行 | ✓ |
| 注册逆序 | 同类型钩子按注册逆序(LIFO)执行 | |
| 并行执行 | 同类型钩子并行执行 | |

**User's choice:** 注册顺序
**Notes:** 符合直觉,常用于日志等场景

---

| Option | Description | Selected |
|--------|-------------|----------|
| 三种标准钩子 | beforeEach(导航前)、beforeResolve(组件解析前)、afterEach(导航完成后) | |
| 两种基础钩子 | beforeEach、afterBoth | |
| Other | beforeEach,renderEach,afterEach,其中renderEach是渲染路由前的hook | ✓ |

**User's choice:** beforeEach,renderEach,afterEach
**Notes:** 用户提出了创新的renderEach钩子,用于在渲染前修改要渲染的内容

---

| Option | Description | Selected |
|--------|-------------|----------|
| 完整导航对象 | 提供完整的Navigation对象{path,query,params,hash,meta,state} | |
| 简化路由对象 | 只提供to和from两个Route对象 | |
| 包含router实例 | 提供to、from和router实例三个参数 | ✓ |

**User's choice:** 包含router实例
**Notes:** 平衡灵活性和简洁性

---

| Option | Description | Selected |
|--------|-------------|----------|
| 任何时候 | 可以在路由器初始化后任何时候注册钩子 | ✓ |
| 仅初始化时 | 只能在路由器初始化时注册钩子 | |
| 导航开始前 | 初始化后可以注册,但当前导航执行中的钩子不会被添加 | |

**User's choice:** 任何时候
**Notes:** 提供最大灵活性,但需要注意竞态条件

---

## 2. 异步守卫处理

| Option | Description | Selected |
|--------|-------------|----------|
| 串行执行 | 多个异步守卫串行执行,按顺序await每个守卫 | |
| 并行执行 | 多个异步守卫并行执行,使用Promise.all() | |
| 混合策略 | 路由级守卫串行,全局守卫并行 | ✓ |

**User's choice:** 混合策略
**Notes:** 平衡性能和功能需求

---

| Option | Description | Selected |
|--------|-------------|----------|
| 固定超时 | 每个异步守卫默认30秒超时 | ✓ |
| 配置超时 | 在路由配置中为每个守卫单独设置超时时间 | |
| 无超时 | 异步守卫永不超时 | |

**User's choice:** 固定超时
**Notes:** 防止无限等待,30秒是合理的默认值

---

| Option | Description | Selected |
|--------|-------------|----------|
| 取消导航 | 守卫抛出错误时取消导航,并在控制台显示错误 | |
| 重定向错误页 | 守卫抛出错误时重定向到错误页面 | |
| 忽略错误 | 守卫抛出错误时继续导航,错误仅记录到控制台 | |
| Other | 根据next参数调用的返回值决定 | ✓ |

**User's choice:** 根据next参数调用的返回值决定
**Notes:** 提供最大的灵活性,给开发者完全控制权

---

| Option | Description | Selected |
|--------|-------------|----------|
| 全局加载 | 异步守卫执行时自动显示全局加载指示器 | |
| 状态暴露 | 通过router.loadingState属性提供加载状态 | |
| 配置控制 | 在路由配置中指定showLoading选项 | |
| Other | 默认提供加载指示器,但支持自定义 | ✓ |

**User's choice:** 默认提供加载指示器,但支持自定义
**Notes:** 平衡开箱即用体验和灵活性

---

## 3. 守卫取消机制

| Option | Description | Selected |
|--------|-------------|----------|
| 保持当前URL | 守卫调用next(false)取消导航,路由器保持当前URL | |
| 回退到上URL | 守卫调用next(false)取消导航,路由器回退到上一个URL | |
| 回退到配置 | 守卫调用next(false)取消导航,在路由配置中指定fallbackPath | ✓ |

**User's choice:** 回退到配置
**Notes:** 通过配置提供灵活性,避免停留在无效状态

---

| Option | Description | Selected |
|--------|-------------|----------|
| 完整导航 | 守卫调用next('/path')触发新的导航,完整导航流程重新执行 | |
| 直接修改 | 守卫调用next('/path')直接修改目标路径,不重新执行已通过的守卫 | |
| 智能重定向 | 守卫调用next('/path')时设置重定向标志,已通过的守卫可以选择跳过 | ✓ |

**User's choice:** 智能重定向
**Notes:** 平衡灵活性和性能,避免重复执行

---

| Option | Description | Selected |
|--------|-------------|----------|
| 固定阈值 | 跟踪导航链,超过10次重定向后抛出错误 | ✓ |
| 路径重复检测 | 检测重复的重定向路径(A→B→A),立即抛出错误 | |
| 守卫重复警告 | 检测相同的守卫重定向多次,抛出警告但允许继续 | |

**User's choice:** 固定阈值
**Notes:** 与Phase 1的MAX_REDIRECTS一致,简单有效

---

| Option | Description | Selected |
|--------|-------------|----------|
| 自动清理 | 守卫失败时自动调用已执行的守卫对应的清理逻辑 | ✓ |
| 手动清理 | 守卫失败时由开发者自己处理清理 | |
| 对称清理 | 守卫失败时调用beforeEach的逆序afterEach | |

**User's choice:** 自动清理
**Notes:** 防止资源泄漏,确保系统状态一致

---

## 4. 数据预加载机制

| Option | Description | Selected |
|--------|-------------|----------|
| 组件加载前 | renderEach在路由匹配后、组件加载前执行 | |
| 组件加载后 | renderEach在组件加载后、渲染前执行 | ✓ |
| 渲染后 | renderEach在渲染完成后执行 | |

**User's choice:** 组件加载后
**Notes:** 数据预加载与组件加载并行,性能最优

---

| Option | Description | Selected |
|--------|-------------|----------|
| 取消导航 | 数据预加载失败时取消导航,显示错误页面 | |
| 继续渲染 | 数据预加载失败时继续渲染组件,组件处理错误状态 | ✓ |
| 配置控制 | 在路由配置中指定失败策略 | |

**User's choice:** 继续渲染
**Notes:** 提供更好的容错性,组件负责处理错误状态

---

| Option | Description | Selected |
|--------|-------------|----------|
| route.data | renderEach返回的数据通过route.data传递给组件 | ✓ |
| 上下文传递 | renderEach返回的数据通过router上下文传递 | |
| 属性传递 | renderEach返回的数据通过组件属性传递 | |

**User's choice:** route.data
**Notes:** 显式传递,类型安全,组件通过route.data访问

---

## 5. 钩子性能优化

| Option | Description | Selected |
|--------|-------------|----------|
| 智能缓存 | 缓存相同参数的守卫结果,避免重复执行 | |
| 不缓存 | 不缓存守卫结果,每次导航都重新执行 | ✓ |
| 配置缓存 | 在路由配置中指定缓存选项 | |

**User's choice:** 不缓存
**Notes:** 确保数据实时性和安全性,优先考虑正确性

---

| Option | Description | Selected |
|--------|-------------|----------|
| 自动监控 | 在开发环境下自动记录每个钩子的执行时间 | |
| 手动监控 | 提供性能监控API,由开发者自行调用 | |
| 无监控 | 不提供性能监控功能 | ✓ |

**User's choice:** 无监控
**Notes:** 保持路由器轻量,避免不必要的复杂度

---

## 6. 嵌套路由守卫

| Option | Description | Selected |
|--------|-------------|----------|
| 父优先 | 父路由守卫先执行,然后子路由守卫执行 | ✓ |
| 子优先 | 子路由守卫先执行,然后父路由守卫执行 | |
| 并行执行 | 父子路由守卫并行执行 | |

**User's choice:** 父优先
**Notes:** 符合直觉,父路由负责整体的访问控制

---

| Option | Description | Selected |
|--------|-------------|----------|
| 全部取消 | 子路由守卫失败时整个导航取消 | |
| 回退父路由 | 子路由守卫失败时回退到父路由,父路由继续渲染 | ✓ |
| 配置策略 | 在路由配置中指定失败策略 | |

**User's choice:** 回退父路由
**Notes:** 提供更好的容错性,父路由可以处理子路由失败

---

| Option | Description | Selected |
|--------|-------------|----------|
| 限制嵌套 | 深度嵌套时显示警告并限制嵌套层级 | |
| 无限制 | 不限制嵌套层级,由开发者自行控制 | ✓ |
| 性能工具 | 提供性能分析工具,帮助开发者识别问题 | |

**User's choice:** 无限制
**Notes:** 提供最大灵活性,由开发者自行负责性能

---

## 7. 钩子与路由状态

| Option | Description | Selected |
|--------|-------------|----------|
| router参数 | 钩子函数接收(to, from, router)参数 | ✓ |
| this上下文 | 钩子函数通过this访问router状态 | |
| 闭包访问 | 钩子函数通过闭包访问router实例 | |

**User's choice:** router参数
**Notes:** 显式传递,避免内存泄漏风险

---

| Option | Description | Selected |
|--------|-------------|----------|
| 只读访问 | 钩子不能直接修改路由状态 | |
| 直接修改 | 钩子可以通过router.state修改路由状态 | |
| next传递 | 钩子可以通过next()传递状态对象 | ✓ |

**User's choice:** next传递
**Notes:** 平衡安全性和灵活性,状态通过导航流程传递

---

## 8. 钩子测试支持

| Option | Description | Selected |
|--------|-------------|----------|
| 测试工具 | 提供createRouterTestHarness工具函数 | |
| 无测试工具 | 不提供专门的测试工具 | |
| 文档示例 | 提供测试文档和示例代码 | ✓ |

**User's choice:** 文档示例
**Notes:** 平衡轻量性和开发体验,通过文档提供指导

---

## 9. 钩子错误边界

| Option | Description | Selected |
|--------|-------------|----------|
| 全局错误边界 | 提供全局错误边界,捕获所有钩子执行错误 | |
| 局部错误处理 | 每个钩子自己处理错误 | |
| 混合模式 | 提供全局错误边界作为兜底,同时支持钩子自己处理错误 | ✓ |

**User's choice:** 混合模式
**Notes:** 平衡灵活性和安全性,提供兜底保障

---

| Option | Description | Selected |
|--------|-------------|----------|
| 自动记录 | 所有钩子错误自动记录到控制台 | ✓ |
| 配置控制 | 通过router配置控制错误日志 | |
| 手动处理 | 不提供自动错误日志 | |

**User's choice:** 自动记录
**Notes:** 开发环境友好,便于调试

---

## Claude's Discretion

- 钩子注册和注销的具体实现细节
- next回调函数的类型定义和类型检查
- 错误提示信息的文案和格式
- 加载指示器的默认样式和行为
- 测试文档和示例代码的具体内容

## Deferred Ideas

- **组件级钩子系统** - 由于框架无关设计,暂不支持组件级钩子
- **KeepAlive 缓存机制** - Phase 4 实现,可能影响钩子的执行频率
- **转场动画** - Phase 5 实现,可能需要在钩子执行过程中控制动画时机
- **钩子性能监控和优化工具** - 当前保持轻量,未来可能提供独立包
- **钩子调试工具和可视化** - 当前通过控制台日志,未来可能提供专门工具
- **服务器端钩子和数据预取** - 当前专注客户端,SSR留待v2+
