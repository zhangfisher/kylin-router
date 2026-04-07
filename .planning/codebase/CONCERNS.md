# Codebase Concerns

**Analysis Date:** 2026-04-07

## Tech Debt

**类型系统绕过:**
- Issue: 大量使用 `any` 类型，绕过 TypeScript 类型检查
- Files: 
  - `C:\Work\Code\kylin-router\src\router.ts`: `(this.host as any).router= this`
  - `C:\Work\Code\kylin-router\src\router.ts`: `delete (this.host as any).router`
  - `C:\Work\Code\kylin-router\src\components\link\index.ts`: `handleClick: unknown`
- Impact: 类型安全缺失，可能导致运行时错误，IDE 智能提示失效
- Fix approach: 定义明确的类型接口，使用严格的 TypeScript 模式

**未完成的功能模块:**
- Issue: 多个核心功能类为空实现，只有注释没有实际逻辑
- Files:
  - `C:\Work\Code\kylin-router\src\features\hooks.ts`: 仅包含类声明，无具体实现
  - `C:\Work\Code\kylin-router\src\features\keepAlive.ts`: 缓存功能未实现
  - `C:\Work\Code\kylin-router\src\features\loader.ts`: 组件加载器未实现
  - `C:\Work\Code\kylin-router\src\features\transition.ts`: 转场动画未实现
  - `C:\Work\Code\kylin-router\src\features\preload.ts`: 预加载功能未实现
- Impact: 核心功能缺失，路由库无法正常使用
- Fix approach: 逐个实现各功能模块，添加单元测试覆盖

## Known Bugs

**类型定义错误:**
- Issue: `KylinRouterOptiopns` 拼写错误（应为 Options）
- Files: `C:\Work\Code\kylin-router\src\types.ts`
- Symptoms: 类型引用时可能产生编译错误
- Trigger: 使用时需要记住正确的拼写
- Workaround: 使用时注意拼写，或等待修复

**Router 实例存储方式不安全:**
- Issue: 通过 DOM 属性直接存储 router 实例，可能导致内存泄漏
- Files: `C:\Work\Code\kylin-router\src\router.ts`
- Symptoms: 组件卸载时 router 实例可能无法正确清理
- Trigger: 在复杂的应用场景中可能出现内存问题
- Workaround: 改用 WeakMap 存储或提供明确的清理机制

## Security Considerations

**XSS 风险:**
- Risk: 直接使用 `innerHTML` 设置 HTML 内容（在测试文件中）
- Files: `C:\Work\Code\kylin-router\src\__tests__\utils.traverseOutlet.test.ts`, `C:\Work\Code\kylin-router\src\features\loader.ts`
- Current mitigation: 仅在测试环境中使用
- Recommendations: 实现组件加载器时使用安全的 HTML 解析方法，避免直接 innerHTML

**DOM 操作安全性:**
- Risk: 直接操作 DOM 元素属性可能被恶意利用
- Files: `C:\Work\Code\kylin-router\src\router.ts`
- Current mitigation: 简单的属性设置
- Recommendations: 添加输入验证，限制 DOM 操作范围

## Performance Bottlenecks

**DOM 遍历性能:**
- Problem: `traverseOutlet` 中的 `querySelectorAll` 和父元素遍历可能在大 DOM 树中性能不佳
- Files: `C:\Work\Code\kylin-router\src\utils\traverseOutlet.ts`
- Cause: 每次调用都重新遍历整个 DOM 树
- Improvement path: 实现缓存机制，监听 DOM 变化进行增量更新

**事件监听管理:**
- Problem: 大量弱引用可能导致内存访问性能下降
- Files: `C:\Work\Code\kylin-router\src\utils\traverseOutlet.ts`
- Cause: WeakRef 频繁 deref 操作
- Improvement path: 在性能关键路径中使用原生引用，仅在必要时使用 WeakRef

## Fragile Areas

**Context 实现脆弱:**
- Files: `C:\Work\Code\kylin-router\src\features\context.ts`
- Why fragile: 依赖 CustomEvent 和 DOM 树遍历，事件冒泡机制可能被干扰
- Safe modification: 保持事件监听器逻辑，增强错误处理
- Test coverage: 需要添加事件处理异常情况的测试

**路由实例获取逻辑:**
- Files: `C:\Work\Code\kylin-router\src\components\base\index.ts`
- Why fragile: 依赖 DOM 树结构，复杂的嵌套可能影响查找
- Safe modification: 重构为基于 Context 的强引用模式
- Test coverage: 需要添加复杂 DOM 结构的测试用例

## Scaling Limits

**路由参数类型:**
- Current capacity: `Record<string, any>` - 过于宽泛
- Limit: 类型检查不足，难以扩展复杂参数验证
- Scaling path: 定义强类型参数接口，添加验证器

**组件缓存机制:**
- Current capacity: 未实现
- Limit: 无法支持大量路由组件缓存
- Scaling path: 实现 LRU 缓存策略，支持内存限制配置

## Dependencies at Risk

**测试框架依赖:**
- Risk: 使用 Bun Test，非主流测试框架
- Impact: 测试工具链可能不稳定
- Migration plan: 考虑迁移到 Jest 或 Vitest

**历史管理库版本:**
- Risk: history 5.3.0 版本较旧
- Impact: 可能错过性能和安全更新
- Migration plan: 评估升级到最新版本的兼容性

## Missing Critical Features

**路由守卫实现:**
- Problem: 类型定义中有路由守卫方法但未实现
- Files: `C:\Work\Code\kylin-router\src\types.ts`
- Blocks: 无法实现路由级别的权限控制
- Priority: High

**错误处理机制:**
- Problem: 缺少统一的错误处理和用户反馈
- Blocks: 错误状态无法有效传播给用户
- Priority: High

## Test Coverage Gaps

**核心功能测试缺失:**
- What's not tested: 路由导航、组件加载、缓存等核心功能
- Files: 大量核心模块缺少测试
- Risk: 功能回归风险高
- Priority: High

**边界情况测试不足:**
- What's not tested: 错误输入、异常场景、性能压力测试
- Files: 现有测试主要集中在正常流程
- Risk: 生产环境异常处理能力未知
- Priority: Medium

---

*Concerns audit: 2026-04-07*