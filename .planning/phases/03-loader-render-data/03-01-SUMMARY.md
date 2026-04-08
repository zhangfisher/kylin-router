---
phase: 03-loader-render-data
plan: 01
subsystem: component-loading
tags: [loader, remote-html, component-loading, fetch-api, security, abort-controller]

# Dependency graph
requires:
  - phase: 02-hooks
    provides: [renderEach hooks, data preloading]
  - phase: 01-context
    provides: [router context, navigation flow]
provides:
  - Loader class with local and remote component loading
  - Type definitions for component loading system
  - Integration with KylinRouter navigation flow
  - Comprehensive test suite for loader functionality
affects: [03-02-render, 03-03-data-loader, 04-keep-alive]

# Tech tracking
tech-stack:
  added: [Loader class, fetch API integration, DOMParser, AbortController]
  patterns: [Mixin architecture, component loading strategies, security sanitization]

key-files:
  created: [src/features/loader.ts, src/__tests__/features.loader.test.ts]
  modified: [src/types/routes.ts, src/router.ts, src/features/index.ts]

key-decisions:
  - "Direct Loader instantiation instead of Mixin pattern (avoids circular dependencies)"
  - "Component type detection: string (URL or element name), function (dynamic import), HTMLElement"
  - "Security-first approach: default HTML sanitization, allowUnsafeHTML opt-in"
  - "Intelligent content extraction: body → data-outlet → custom selector"
  - "Request cancellation via AbortController to prevent race conditions"

patterns-established:
  - "Pattern 1: LoadResult interface for consistent loading status reporting"
  - "Pattern 2: RemoteLoadOptions for configurable remote loading behavior"
  - "Pattern 3: Multi-layer timeout configuration (route > loader > default)"
  - "Pattern 4: Security sanitization with dangerous content removal"

requirements-completed: [LOAD-01, LOAD-02]

# Metrics
duration: 45min
completed: 2026-04-08T13:18:51Z
---

# Phase 3 Plan 1: 组件加载系统 Summary

**Loader class supporting local Web Components, dynamic imports, and remote HTML with intelligent content extraction and security sanitization**

## Performance

- **Duration:** 45 min
- **Started:** 2026-04-08T13:18:51Z
- **Completed:** 2026-04-08T14:03:51Z
- **Tasks:** 5
- **Files modified:** 5

## Accomplishments
- 完整的组件加载系统，支持本地元素名、动态导入函数和远程 URL 三种模式
- 智能 HTML 内容提取，支持 body、data-outlet 属性和自定义选择器
- 默认安全检查机制，移除 script 标签和危险属性，可选 allowUnsafeHTML
- 超时和请求大小限制，防止 DoS 攻击
- AbortController 集成，支持请求取消和竞态条件处理
- 完整的单元测试覆盖，23 个测试全部通过

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义组件加载相关的类型系统** - `205b8c1` (feat)
2. **Task 2: 实现 Loader 类的本地组件加载功能** - `4e19da7` (feat)
3. **Task 3: 实现 Loader 类的远程 HTML 加载功能** - `d603ea9` (feat)
4. **Task 4: 集成 Loader 到 KylinRouter 导航流程** - `33d4a82` (feat)
5. **Task 5: 编写 Loader 功能的单元测试** - `53e02a6` (test)

**Plan metadata:** [pending final commit]

## Files Created/Modified

### Created
- `src/features/loader.ts` - Loader 类实现，包含本地和远程组件加载逻辑
- `src/__tests__/features.loader.test.ts` - Loader 功能的完整单元测试套件

### Modified
- `src/types/routes.ts` - 添加 ComponentLoader、RemoteLoadOptions、LoadResult 类型定义
- `src/router.ts` - 集成 Loader 到导航流程，添加组件加载步骤
- `src/features/index.ts` - 导出 Loader 类

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 添加 DOMParser 到测试环境**
- **Found during:** Task 5 (单元测试实现)
- **Issue:** 测试失败，DOMParser 在 happy-dom 环境中未定义，导致 extractContent 方法报错
- **Fix:** 在 createTestDOM 函数中添加 `globalThis.DOMParser = win.DOMParser`
- **Files modified:** src/__tests__/features.loader.test.ts
- **Verification:** 所有 23 个测试通过
- **Committed in:** `53e02a6` (Task 5 commit)

**2. [Rule 3 - Blocking] 修复 Loader 集成方式**
- **Found during:** Task 4 (Router 集成)
- **Issue:** 尝试使用 Mixin 模式集成 Loader 导致类型错误和循环依赖
- **Fix:** 改为直接在 KylinRouter 中实例化 Loader 类，不使用 Mixin
- **Files modified:** src/router.ts
- **Verification:** 类型检查通过，编译成功
- **Committed in:** `33d4a82` (Task 4 commit)

**3. [Rule 1 - Bug] 修复 component 类型处理**
- **Found during:** Task 4 (Router 集成)
- **Issue:** Loader.loadComponent 期望 `string | (() => Promise<any>)`，但 RouteItem.component 是 `string | HTMLElement`
- **Fix:** 在调用前进行类型检查，HTMLElement 类型直接使用，其他类型传递给 Loader
- **Files modified:** src/router.ts
- **Verification:** 类型错误消失，运行时正常
- **Committed in:** `33d4a82` (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** 所有自动修复都是必要的，确保了功能正确性和类型安全。没有范围蔓延。

## Issues Encountered
- Mixin 模式导致循环依赖 - 解决方案是直接实例化而不是继承
- 测试环境缺少 DOMParser - 通过添加到 globalThis 解决
- 类型系统不匹配 - 通过运行时类型检查解决

## Threat Surface Analysis

本计划引入的新的安全相关表面：

| Threat ID | File | Description | Mitigation |
|-----------|------|-------------|------------|
| T-03-01 | loader.ts | URL 格式验证，拒绝 javascript: 等危险协议 | 已实现 isURL 方法，只允许 http/https |
| T-03-02 | loader.ts | HTML 内容安全策略，移除 script 标签和事件属性 | 已实现 sanitizeHTML 方法，默认开启 |
| T-03-05 | loader.ts | DoS 防护，超时和大小限制 | 已实现 5 秒超时和 1MB 大小限制 |

## Known Stubs

无存根 - 所有功能均已完整实现。

## Next Phase Readiness
- Loader 系统完全就绪，可支持后续的 Render 和 DataLoader 阶段
- 类型定义完整，为后续集成提供了良好的类型基础
- 测试覆盖全面，确保功能稳定性
- 安全机制已到位，满足威胁模型要求

---
*Phase: 03-loader-render-data*
*Completed: 2026-04-08T14:03:51Z*

## Self-Check: PASSED

**Files Created:**
- ✅ `src/features/loader.ts` - Loader 类实现 (188 行)
- ✅ `src/__tests__/features.loader.test.ts` - 完整测试套件 (410 行)
- ✅ `.planning/phases/03-loader-render-data/03-01-SUMMARY.md` - 计划摘要

**Commits Verified:**
- ✅ `205b8c1` - Task 1: 类型定义
- ✅ `4e19da7` - Task 2: 本地组件加载
- ✅ `d603ea9` - Task 3: 远程 HTML 加载
- ✅ `33d4a82` - Task 4: Router 集成
- ✅ `53e02a6` - Task 5: 单元测试
- ✅ `f6b528e` - SUMMARY.md 创建
- ✅ `19b9989` - STATE.md 更新

**Test Results:**
- ✅ 23 个测试全部通过
- ✅ 测试覆盖成功和失败场景
- ✅ 安全检查功能验证通过
