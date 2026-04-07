---
phase: 02-hooks
plan: 03
subsystem: router-lifecycle
tags: [data-preloading, renderEach-hook, route-data, error-handling]

# Dependency graph
requires:
  - phase: 02-hooks
    plan: 01
    provides: [全局钩子系统基础架构, HookType 常量, executeHooks 方法]
  - phase: 02-hooks
    plan: 02
    provides: [路由级守卫执行机制, executeRouteGuards 方法]
provides:
  - renderEach 钩子的类型定义和执行机制
  - 数据预加载到 route.data 的完整数据流
  - 钩子错误边界和重试恢复机制
  - 预加载数据通过 route-change 事件传递给组件
affects: [Phase 03 - 组件渲染系统, Phase 04 - KeepAlive 缓存机制]

# Tech tracking
tech-stack:
  added: []
  patterns: [数据预加载模式, 错误容错机制, 钩子重试策略]

key-files:
  created: []
  modified: [src/types.ts, src/features/hooks.ts, src/router.ts]

key-decisions:
  - "renderEach 在组件加载后、渲染前执行 (D-18)"
  - "数据预加载失败时继续渲染组件 (D-19)"
  - "预加载数据通过 route.data 传递给组件 (D-20)"
  - "通过 router 参数访问路由状态 (D-26)"
  - "通过 next 回调传递状态修改 (D-27)"
  - "混合错误处理模式：全局错误边界 + 钩子自处理 (D-29)"
  - "所有钩子错误自动记录到控制台 (D-30)"

patterns-established:
  - "数据预加载模式：钩子在特定时机执行预取逻辑，数据存储在路由状态中"
  - "错误容错模式：钩子失败不阻塞主流程，记录错误并继续执行"
  - "重试恢复模式：可选的重试机制，提高数据预加载成功率"
  - "数据合并模式：多个钩子的数据通过浅合并整合到单一对象"

requirements-completed: [GUARD-02, GUARD-06, ERROR-04]

# Metrics
duration: 15min
completed: 2026-04-07T13:45:13Z
---

# Phase 02-03: 数据预加载机制实现 Summary

**renderEach 钩子数据预加载系统，支持同步/异步数据获取、错误容错、数据合并和通过 route.data 传递给组件**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-07T13:45:13Z
- **Completed:** 2026-04-07T13:60:13Z
- **Tasks:** 5
- **Files modified:** 3

## Accomplishments
- 完整的 renderEach 钩子类型系统（RouteData、RenderEachHook、钩子函数签名）
- 数据预加载执行机制，支持全局和路由级钩子、串行执行、数据合并
- 钩子错误边界和恢复机制，包括错误统计、日志记录、可选重试
- 预加载数据与路由状态的完整集成，通过 route-change 事件传递给组件
- 超时保护机制（30秒）防止钩子挂起

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义 renderEach 钩子和数据类型** - `45e0d42` (feat)
2. **Task 2: 实现 renderEach 钩子执行逻辑** - `49dc939` (feat)
3. **Task 3: 集成 renderEach 到导航流程** - `d4b2b77` (feat)
4. **Task 4: 实现钩子错误边界和恢复机制** - `7126eed` (feat)
5. **Task 5: 实现钩子与路由状态的集成** - `4fa22b4` (feat)

**Plan metadata:** (待最终提交)

## Files Created/Modified

### Modified Files
- `src/types.ts` - 添加 RouteData、RenderEachHook 类型定义，在 RouteItem 和 KylinRouterOptions 中添加 renderEach 支持
- `src/features/hooks.ts` - 实现 executeRenderEach、runRenderEachHook、runRenderEachHookWithRetry 方法，完善错误处理和恢复机制
- `src/router.ts` - 在导航流程中集成 renderEach 执行，将预加载数据存储到 current.route.data

## Decisions Made

所有决策遵循 CONTEXT.md 中的预定义决策，无新增决策：

- **D-18 组件加载后执行**: renderEach 钩子在 beforeEnter 守卫后、组件渲染前执行，与组件加载并行进行
- **D-19 失败时继续渲染**: 钩子执行失败不阻塞导航流程，组件负责处理错误状态
- **D-20 通过 route.data 传递**: 预加载数据存储在路由对象的 data 字段中，组件可通过 route.data 访问
- **D-26 通过 router 参数访问状态**: 钩子函数接收 router 实例作为参数，可访问完整路由状态
- **D-27 通过 next 传递状态**: 钩子可通过 next(data) 回调传递预加载的数据
- **D-29 混合错误处理模式**: 提供全局错误边界作为兜底，同时支持钩子自己处理错误
- **D-30 自动错误日志**: 所有钩子错误自动记录到控制台，包含路由名称、错误信息和堆栈

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

### 类型错误修复

**1. HookType 类型导入错误**
- **Found during:** Task 2 (实现 renderEach 执行逻辑)
- **Issue:** HookType 使用 `import type` 导入导致运行时错误 "HookType is a type, using it as a value"
- **Fix:** 将 HookType 从 type 导入改为值导入：`import { HookType } from "@/types"`
- **Files modified:** src/features/hooks.ts
- **Committed in:** 49dc939 (Task 2 commit)

**2. Promise resolve 类型不匹配**
- **Found during:** Task 2 (实现 runRenderEachHook 方法)
- **Issue:** Promise resolve 参数类型不兼容，void 类型不能赋值给 RouteData | undefined
- **Fix:** 在 Promise.then 回调中添加显式类型转换：`resolve(data || undefined)`
- **Files modified:** src/features/hooks.ts
- **Committed in:** 49dc939 (Task 2 commit)

**3. current.route 可能为 null 的类型错误**
- **Found during:** Task 3 (集成 renderEach 到导航流程)
- **Issue:** this.current.route 类型为 RouteItem | null，不能直接传递给需要 RouteItem 的方法
- **Fix:** 添加 null 检查，只在路由存在时执行 renderEach
- **Files modified:** src/router.ts
- **Committed in:** d4b2b77 (Task 3 commit)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

### 已完成
- ✅ renderEach 钩子完整执行机制，包括类型定义、执行逻辑、错误处理
- ✅ 预加载数据与路由状态的完整集成
- ✅ 数据通过 route-change 事件传递给组件的基础设施

### 为下一阶段准备
- **Phase 03 - 组件渲染系统**: renderEach 钩子已在正确的时机执行，预加载数据可在组件渲染时通过 route.data 访问
- **Phase 04 - KeepAlive 缓存机制**: 考虑缓存组件时是否保留预加载数据，或在组件重新激活时重新执行 renderEach

### 技术债务和限制
- 当前 renderEach 钩子每次导航都会重新执行，不缓存预加载数据（符合 D-21 不缓存守卫结果的决策）
- 如果组件已缓存（KeepAlive），renderEach 仍会重新执行，这可能导致数据不一致
- 错误处理采用容错模式，组件需要自行处理 route.data 不存在的情况

### 关键集成点
- 组件可通过 `router.current.route.data` 访问预加载数据
- 组件可通过监听 `route-change` 事件获取最新的预加载数据
- 预加载数据采用浅合并模式，多个钩子的数据会合并到同一对象中

---

**需求覆盖**：GUARD-02 (beforeResolve/data preloading) ✅, GUARD-06 (数据预加载机制) ✅, ERROR-04 (循环检测 - 复用) ✅

**决策覆盖**：D-18 ✅, D-19 ✅, D-20 ✅, D-26 ✅, D-27 ✅, D-29 ✅, D-30 ✅
