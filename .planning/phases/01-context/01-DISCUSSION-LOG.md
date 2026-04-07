# Phase 1: Context（上下文传播）- Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 01-context
**Mode:** discuss
**Areas discussed:** 路由匹配策略, 路由表结构设计, 导航流程设计, Hash 模式实现, 404 处理机制, 动态路由注册, 默认路径重定向

---

## 路由匹配策略

### 问题 1：路径匹配规则
| Option | Description | Selected |
|--------|-------------|----------|
| 完全匹配（精确相等） | 更严格，避免误匹配，适合简单路由结构 | |
| 前缀匹配 | 支持部分匹配，适合嵌套路由 | |
| 两者结合 | 混合策略：叶子节点完全匹配，父节点支持前缀匹配 | ✓ |

**User's choice:** 两者结合
**Notes:** 需要处理优先级（具体路径优先于通配符）

### 问题 2：动态参数语法
| Option | Description | Selected |
|--------|-------------|----------|
| 冒号语法（:param） | 行业标准，例如 /user/:id | |
| 尖括号语法（<param>） | 更灵活，支持约束 | |
| 两者都支持 | 同时支持两种语法 | ✓ |

**User's choice:** 两者都支持
**Notes:** 冒号用于简单参数，尖括号用于复杂约束

### 问题 3：通配符规则
| Option | Description | Selected |
|--------|-------------|----------|
| 支持通配符（*） | 匹配任意路径，包括嵌套路径 | ✓ |
| 单层通配符 | 只匹配单层路径 | |
| 不支持通配符 | 使用明确的 404 配置 | |

**User's choice:** 支持通配符（*）
**Notes:** 常用于 404 兜底

### 问题 4：嵌套路由路径继承
| Option | Description | Selected |
|--------|-------------|----------|
| 相对路径（推荐） | 子路由 path 相对于父路由 | |
| 绝对路径 | 每个 path 都是绝对路径 | |
| 自动检测 | 以 / 开头为绝对，否则为相对 | ✓ |

**User's choice:** 自动检测
**Notes:** 混合支持，更灵活

### 问题 5：路由匹配优先级
| Option | Description | Selected |
|--------|-------------|----------|
| 具体 > 参数 > 通配符 | 具体路径优先于参数化路径 | |
| 配置顺序 | 按配置顺序匹配 | |
| 混合策略 | 综合考虑具体度和配置顺序 | ✓ |

**User's choice:** 混合策略
**Notes:** 具体度相同时按配置顺序

### 问题 6：动态参数验证
| Option | Description | Selected |
|--------|-------------|----------|
| 无验证（全部字符串） | 所有参数都是字符串 | |
| 路由级验证 | 在路由配置中定义约束 | ✓ |
| 钩子函数验证 | 提供全局验证钩子 | |

**User's choice:** 路由级验证
**Notes:** 支持 /user/:id(\d+) 这样的约束

### 问题 7：路径规范化
| Option | Description | Selected |
|--------|-------------|----------|
| 移除末尾 / | /user/ 和 /user 视为相同 | ✓ |
| 保留末尾 / | 添加末尾斜杠 | |
| 不处理 | 保持原样 | |

**User's choice:** 移除末尾 /
**Notes:** 自动规范化

### 问题 8：路径大小写敏感性
| Option | Description | Selected |
|--------|-------------|----------|
| 区分大小写 | 更严格，适合 API 风格 | |
| 不区分大小写 | 用户体验更好 | ✓ |

**User's choice:** 不区分大小写
**Notes:** 符合 URL 惯例

---

## 路由表结构设计

### 问题 1：路由表组织方式
| Option | Description | Selected |
|--------|-------------|----------|
| 扁平化结构 | 所有路由在一维数组中 | |
| 嵌套式结构 | 通过 children 字段嵌套 | ✓ |
| 混合支持 | 两种方式都支持 | |

**User's choice:** 嵌套式结构
**Notes:** 更直观，支持嵌套路由

### 问题 2：路由配置验证
| Option | Description | Selected |
|--------|-------------|----------|
| 开发模式警告 | 开发时警告，生产时跳过 | |
| 严格模式（抛错） | 始终抛出错误 | |
| 静默处理 | 静默忽略，使用默认值 | ✓ |

**User's choice:** 静默处理
**Notes:** 不发出警告

### 问题 3：路由冲突处理
| Option | Description | Selected |
|--------|-------------|----------|
| 后者覆盖 | 后配置的覆盖先配置的 | ✓ |
| 前者优先 | 保留先配置的 | |
| 抛出错误 | 强制手动解决 | |

**User's choice:** 后者覆盖
**Notes:** 并发出警告

### 问题 4：路由元数据使用
| Option | Description | Selected |
|--------|-------------|----------|
| 完全自定义 | meta 字段由应用层定义 | ✓ |
| 部分约定 | 支持保留字段 | |
| 标准化 | 定义标准字段结构 | |

**User's choice:** 完全自定义
**Notes:** 路由器不干预

### 问题 5：路由懒加载
| Option | Description | Selected |
|--------|-------------|----------|
| 支持懒加载 | component 支持 Promise | |
| 不支持 | 所有组件在配置时加载 | |
| 懒加载 + 预加载 | 支持懒加载和预加载 | ✓ |

**User's choice:** 懒加载 + 预加载
**Notes:** 提供 preload 方法

### 问题 6：路由别名
| Option | Description | Selected |
|--------|-------------|----------|
| 支持别名 | 多个 path 指向同一路由 | ✓ |
| 不支持 | 需要配置多个路由 | |

**User's choice:** 支持别名
**Notes:** 一个配置有多个路径

### 问题 7：路由分组
| Option | Description | Selected |
|--------|-------------|----------|
| 支持分组 | 公共配置 | |
| 嵌套实现 | 通过嵌套路由实现 | ✓ |

**User's choice:** 嵌套实现
**Notes:** 不提供专门的分组机制

### 问题 8：路由版本管理
| Option | Description | Selected |
|--------|-------------|----------|
| 路径版本号 | /v1/user、/v2/user | |
| 元数据版本 | meta 字段标记 | |
| 应用层处理 | 由应用层实现 | ✓ |

**User's choice:** 应用层处理
**Notes:** 不支持内置版本管理

### 问题 9：路由配置格式
| Option | Description | Selected |
|--------|-------------|----------|
| 支持多种格式 | 对象数组、函数、远程加载 | ✓ |
| 单一格式 | 只支持 RouteItem | |

**User's choice:** 支持多种格式
**Notes:** 内部统一转换

### 问题 10：开发时辅助
| Option | Description | Selected |
|--------|-------------|----------|
| 提供调试工具 | 列出路由、测试匹配 | |
| 类型检查 | TypeScript 智能提示 | |
| 两者都提供 | 同时提供 | ✓ |

**User's choice:** 两者都提供
**Notes:** 确保开发体验

---

## 导航流程设计

### 问题 1：导航流程步骤
| Option | Description | Selected |
|--------|-------------|----------|
| 6 步流程 | 解析→提取→匹配→守卫→加载→渲染 | ✓ |
| 3 步流程 | 匹配→守卫→渲染 | |
| 可配置流程 | 可配置钩子顺序 | |

**User's choice:** 6 步流程
**Notes:** 完整的导航生命周期

### 问题 2：守卫执行与取消
| Option | Description | Selected |
|--------|-------------|----------|
| 阻止并保持当前 | 返回 false 时保持当前路由 | |
| 阻止并可重定向 | 返回 false 或重定向路径 | |
| 灵活处理 | 提供最大灵活性 | ✓ |

**User's choice:** 灵活处理
**Notes:** 支持多种阻止方式

### 问题 3：导航错误处理
| Option | Description | Selected |
|--------|-------------|----------|
| 回退并提示 | 回退到上一个路由 | |
| 静默保持 | 保持在当前路由 | |
| 错误页面 | 跳转到错误页面 | |

**User's choice:** [自定义] 通过新的路由参数 `failure` 来决定
**Notes:** 取值：error=显示错误, redirect=重定向, back=回退, none=保持, 函数=自定义处理

### 问题 4：导航竞态条件
| Option | Description | Selected |
|--------|-------------|----------|
| 取消旧导航 | 新导航开始时取消旧导航 | ✓ |
| 时间戳验证 | 只接受最新结果 | |
| 完成但忽略 | 完成所有但只渲染最新 | |

**User's choice:** 取消旧导航
**Notes:** 只处理最新的导航请求

### 问题 5：滚动行为
| Option | Description | Selected |
|--------|-------------|----------|
| 自动滚动到顶部 | 传统网页行为 | |
| 智能滚动 | 前进到顶部，后退恢复 | |
| 可配置 | 通过 scrollBehavior 配置 | |

**User's choice:** [自定义] 滚动到 kylin-outlet 组件所在的位置
**Notes:** 更符合 SPA 的用户体验

### 问题 6：守卫执行顺序
| Option | Description | Selected |
|--------|-------------|----------|
| 从外到内 | 全局→路由→组件 | |
| 从内到外 | 组件→路由→全局 | ✓ |
| 可配置 | 可配置执行顺序 | |

**User's choice:** 从内到外
**Notes:** 与 React Router 相反

### 问题 7：异步导航处理
| Option | Description | Selected |
|--------|-------------|----------|
| 阻塞模式 | 显示加载指示器 | ✓ |
| 非阻塞模式 | 允许用户继续操作 | |
| 可配置 | 由守卫决定 | |

**User's choice:** 阻塞模式
**Notes:** 阻止用户交互直到完成

### 问题 8：导航状态管理
| Option | Description | Selected |
|--------|-------------|----------|
| 暴露状态 API | isLoading、isNavigating 等 | |
| 事件通知 | navigation-start 等事件 | |
| 两者都提供 | 同时提供 | ✓ |

**User's choice:** 两者都提供
**Notes:** 满足不同需求

### 问题 9：导航取消
| Option | Description | Selected |
|--------|-------------|----------|
| 支持取消 | 提供 cancelNavigation 方法 | |
| 仅守卫阻止 | 只通过守卫返回 false | ✓ |

**User's choice:** 仅守卫阻止
**Notes:** 不提供专门的取消 API

### 问题 10：链接组件行为
| Option | Description | Selected |
|--------|-------------|----------|
| 完整导航 | 调用 router.push() | |
| 直接跳转 | 直接修改 location.href | |
| 智能判断 | 内部用 push，外部直接跳 | ✓ |

**User's choice:** 智能判断
**Notes:** 根据 to 属性判断

---

## Hash 模式实现

### 问题 1：Hash 路径格式
| Option | Description | Selected |
|--------|-------------|----------|
| 需要 / (#/path) | Hash 后需要斜杠 | |
| 不需要 / (#path) | Hash 后不需要斜杠 | |
| 都支持 | 两种格式都支持 | ✓ |

**User's choice:** 都支持
**Notes:** 自动规范化

### 问题 2：Hash 模式下的基础 URL
| Option | Description | Selected |
|--------|-------------|----------|
| 支持 base 配置 | 支持 base 配置 | ✓ |
| 不支持 base | 不支持 | |

**User's choice:** 支持 base 配置
**Notes:** 例如 app 作为基础路径

### 问题 3：模式间 API 统一性
| Option | Description | Selected |
|--------|-------------|----------|
| 完全统一 | 完全相同的 API | ✓ |
| 部分受限 | 某些特性受限 | |
| 独立实现 | 分别处理 | |

**User's choice:** 完全统一
**Notes:** 只需在初始化时选择模式

### 问题 4：滚动位置恢复兼容性
| Option | Description | Selected |
|--------|-------------|----------|
| 完全一致 | 与 History 模式一致 | ✓ |
| 简化处理 | 只支持滚动到顶部 | |
| 不支持 | 由应用层处理 | |

**User's choice:** 完全一致
**Notes:** 相同的滚动行为

---

## 404 处理机制

### 问题 1：404 路由配置方式
| Option | Description | Selected |
|--------|-------------|----------|
| 通配符路由 | 通过 * 配置 | |
| 专门的 notFound 字段 | notFound 字段 | |
| 两者都支持 | 同时支持 | ✓ |

**User's choice:** 两者都支持
**Notes:** 通配符路由优先

### 问题 2：404 时的 URL 处理
| Option | Description | Selected |
|--------|-------------|----------|
| 保持原 URL | URL 不变 | |
| 重定向到 /404 | URL 改变 | ✓ |
| 可配置 | 由路由配置决定 | |

**User's choice:** 重定向到 /404
**Notes:** URL 会改变

### 问题 3：嵌套路由的 404 处理
| Option | Description | Selected |
|--------|-------------|----------|
| 继承父级 404 | 父路由的 404 生效 | ✓ |
| 仅全局 404 | 只用全局配置 | |
| 独立配置 | 每个嵌套独立配置 | |

**User's choice:** 继承父级 404
**Notes:** 子路由继承父级配置

### 问题 4：懒加载路由的 404 处理
| Option | Description | Selected |
|--------|-------------|----------|
| 加载失败 = 404 | 显示 404 页面 | |
| 错误边界 | 显示错误边界 | ✓ |
| 自定义处理 | onerror 处理 | |

**User's choice:** 错误边界
**Notes:** 与 404 分开处理

---

## 动态路由注册

### 问题 1：动态路由 API
| Option | Description | Selected |
|--------|-------------|----------|
| 基础 API | addRoute、removeRoute | ✓ |
| 返回移除函数 | 返回取消函数 | |
| 两者都提供 | 同时提供 | |

**User's choice:** 基础 API
**Notes:** 简单直接

### 问题 2：动态路由优先级
| Option | Description | Selected |
|--------|-------------|----------|
| 动态优先 | 动态路由优先 | |
| 统一优先级 | 不区分动态/静态 | ✓ |
| 可配置优先级 | 可配置 | |

**User's choice:** 统一优先级
**Notes:** 按配置和添加顺序

### 问题 3：删除活动路由
| Option | Description | Selected |
|--------|-------------|----------|
| 阻止删除 | 抛出错误 | |
| 自动重定向 | 重定向到默认或 404 | ✓ |
| 保持状态 | 保持直到导航离开 | |

**User's choice:** 自动重定向
**Notes:** 删除当前活动路由时重定向

### 问题 4：批量路由操作
| Option | Description | Selected |
|--------|-------------|----------|
| 支持批量操作 | 批量添加删除 | |
| 仅单个操作 | 只提供单个操作 | ✓ |

**User's choice:** 仅单个操作
**Notes:** 保持 API 简单

---

## 默认路径重定向

### 问题 1：默认路径配置方式
| Option | Description | Selected |
|--------|-------------|----------|
| redirect 字段 | redirect 字段 | |
| defaultRoute 字段 | defaultRoute 字段 | ✓ |
| 两者都支持 | 同时支持 | |

**User's choice:** defaultRoute 字段
**Notes:** 根路由配置中指定

### 问题 2：重定向导航流程
| Option | Description | Selected |
|--------|-------------|----------|
| 完整导航 | 触发完整流程 | ✓ |
| 静默重定向 | 不触发守卫 | |
| 可配置 | 可配置 | |

**User's choice:** 完整导航
**Notes:** 包括守卫、组件加载等

### 问题 3：循环重定向检测
| Option | Description | Selected |
|--------|-------------|----------|
| 自动检测 | 超过阈值抛错 | ✓ |
| 不检测 | 由浏览器处理 | |
| 可配置阈值 | maxRedirects 配置 | |

**User's choice:** 自动检测
**Notes:** 防止浏览器挂起

### 问题 4：嵌套路由的默认路径
| Option | Description | Selected |
|--------|-------------|----------|
| 支持嵌套默认 | 每个嵌套可配置 | ✓ |
| 仅根路由 | 只有根支持 | |
| 特殊语法 | 需要特殊语法 | |

**User's choice:** 支持嵌套默认
**Notes:** 每个嵌套都可配置

---

## Claude's Discretion

以下区域由 Claude 在规划和实现时自行决定：

- 参数解析算法的具体实现细节
- 路由匹配算法的性能优化策略
- 开发调试工具的具体功能和实现方式
- 错误提示信息的文案和格式

## Deferred Ideas

### 下一阶段处理的功能
- 路由守卫系统（beforeEach、beforeResolve、afterEach）- Phase 2
- 嵌套路由的 Outlet 渲染机制 - Phase 2
- 组件加载系统（本地和远程 HTML）- Phase 3
- KeepAlive 缓存机制 - Phase 4
- 转场动画 - Phase 5

### 暂不讨论的高级特性
- 服务器配置相关的 Hash 模式限制
- 路由级代码分割
- 浏览器历史状态管理（state）

---

*Discussion mode: discuss*
*Total questions asked: 58*
*Total areas discussed: 7*
*Date: 2026-04-07*
