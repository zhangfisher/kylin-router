# Quick Task 260410-eyr: onRouteUpdate函数太长，根据功能和阶段拆分一下

**Created:** 2026-04-10
**Status:** Ready for execution
**Directory:** .planning/quick/260410-eyr-onrouteupdate/

## Task Description

重构 `onRouteUpdate` 函数，将当前 324 行的单一函数拆分为多个按功能和阶段组织的私有方法，提高代码可读性和可维护性。

## Analysis

当前 `onRouteUpdate` 函数包含以下功能阶段：

1. **初始化阶段**（200-215 行）- 导航版本号、AbortController、导航状态
2. **路由匹配阶段**（217-268 行）- 保存状态、匹配路由、构造目标对象
3. **beforeEach 钩子执行**（270-311 行）- 全局前置守卫
4. **beforeEnter 守卫执行**（313-338 行）- 路由级前置守卫
5. **组件加载阶段**（340-395 行）- 加载视图组件
6. **数据加载阶段**（397-426 行）- 加载路由数据
7. **renderEach 钩子执行**（428-452 行）- 数据预加载钩子
8. **渲染阶段**（454-466 行）- 执行渲染
9. **完成和清理阶段**（468-523 行）- 事件触发、钩子执行、状态重置

## Plan

### Task 1: 创建导航上下文接口和初始化方法

**Files:** `src/router.ts`

**Action:**
1. 创建 `NavigationContext` 接口，定义导航过程中的共享状态
2. 创建 `_initializeNavigationState()` 方法，提取初始化逻辑
3. 更新 `onRouteUpdate` 使用新的方法

**Verify:**
- NavigationContext 接口定义正确
- 初始化逻辑提取完整
- onRouteUpdate 调用新方法

**Done:** 接口和初始化方法创建完成

---

### Task 2: 拆分路由匹配和守卫执行逻辑

**Files:** `src/router.ts`

**Action:**
1. 创建 `_matchRoute()` 方法，提取路由匹配逻辑
2. 创建 `_executeBeforeEachHooks()` 方法，提取全局前置守卫逻辑
3. 创建 `_executeBeforeEnterGuards()` 方法，提取路由级守卫逻辑
4. 更新 `onRouteUpdate` 使用新的方法

**Verify:**
- 路由匹配逻辑提取完整
- 守卫执行逻辑提取完整
- 错误处理保持一致
- onRouteUpdate 调用新方法

**Done:** 路由匹配和守卫执行逻辑拆分完成

---

### Task 3: 拆分资源加载逻辑（组件和数据）

**Files:** `src/router.ts`

**Action:**
1. 创建 `_loadViewComponent()` 方法，提取组件加载逻辑
2. 创建 `_loadRouteData()` 方法，提取数据加载逻辑
3. 创建 `_executeRenderEachHook()` 方法，提取数据预加载钩子逻辑
4. 更新 `onRouteUpdate` 使用新的方法

**Verify:**
- 组件加载逻辑提取完整
- 数据加载逻辑提取完整
- 导航版本号检查保持一致
- onRouteUpdate 调用新方法

**Done:** 资源加载逻辑拆分完成

---

### Task 4: 拆分渲染和清理逻辑

**Files:** `src/router.ts`

**Action:**
1. 创建 `_renderRoute()` 方法，提取渲染逻辑
2. 创建 `_finalizeNavigation()` 方法，提取完成和清理逻辑
3. 更新 `onRouteUpdate` 使用新的方法
4. 简化 `onRouteUpdate` 为主流程编排

**Verify:**
- 渲染逻辑提取完整
- 清理逻辑提取完整
- onRouteUpdate 简化为清晰的主流程
- 所有功能保持不变

**Done:** 渲染和清理逻辑拆分完成，onRouteUpdate 重构完成

---

## Success Criteria

- [ ] onRouteUpdate 函数从 324 行减少到约 50-80 行（主流程编排）
- [ ] 创建 8-10 个私有辅助方法，每个方法职责单一
- [ ] 所有现有功能保持不变
- [ ] 代码可读性显著提高
- [ ] 类型安全保持完整
- [ ] 现有测试通过
