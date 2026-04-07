# 调试模式功能实现计划总结

## 计划概览

**阶段标识符：** `quick-debug-mode`
**计划编号：** 01
**计划类型：** 快速功能实现（quick）
**执行波次：** Wave 1（无依赖，可立即执行）
**预计执行时间：** 15-20 分钟

## 目标

为 KylinRouter 添加完整的调试模式支持，帮助开发者在开发时调试路由导航流程和钩子执行，同时确保不影响生产环境性能。

## 核心需求

| 需求 ID | 描述 | 优先级 |
|---------|------|--------|
| DEBUG-001 | 在 KylinRouterOptiopns 中添加 debug 选项 | P0 |
| DEBUG-002 | 实现调试日志方法，支持条件输出 | P0 |
| DEBUG-003 | 在路由导航关键位置添加调试日志 | P0 |
| DEBUG-004 | 在钩子执行中添加调试日志 | P0 |

## 任务分解（5个任务，单波次执行）

### Wave 1：核心功能实现（所有任务并行可行）

| 任务 | 文件 | 描述 | 验证方法 |
|------|------|------|----------|
| 任务 1 | src/types.ts | 添加 debug?: boolean 类型定义 | grep 查找类型定义 |
| 任务 2 | src/router.ts | 实现 debug 属性和 debugLog 方法 | grep 查找方法和属性 |
| 任务 3 | src/router.ts | 在 onRouteUpdate 中添加 7+ 处调试日志 | grep 统计日志数量 |
| 任务 4 | src/features/hooks.ts | 在钩子执行中添加 4+ 处调试日志 | grep 统计日志数量 |
| 任务 5 | src/router.ts | 在导航方法中添加调试日志 | grep 统计日志数量 |

**文件修改矩阵：**
- `src/types.ts`：1 处修改（添加 debug 选项）
- `src/router.ts`：3 处修改（debug 属性、debugLog 方法、多处日志调用）
- `src/features/hooks.ts`：1 处修改（多处日志调用）

## 实现细节

### 1. 类型定义（任务 1）

**位置：** `src/types.ts` 第 170-185 行
**修改：** 在 KylinRouterOptiopns 接口中添加：
```typescript
/** 是否启用调试模式，默认 false */
debug?: boolean;
```

### 2. 调试日志方法（任务 2）

**位置：** `src/router.ts`
**新增内容：**
- 类属性：`debug: boolean = false`
- 构造函数初始化：`this.debug = resolvedOptions.debug || false`
- 调试方法：
```typescript
protected debugLog(message: string, data?: any): void {
    if (this.debug) {
        console.log(`[Router Debug] ${message}`, data || '');
    }
}
```

### 3. 路由导航日志（任务 3）

**位置：** `src/router.ts` onRouteUpdate 方法
**日志点：**
1. 导航开始（第 144 行）
2. 路由匹配完成（第 159 行）
3. beforeEach 钩子执行（第 165 行）
4. beforeEnter 守卫执行（第 203 行）
5. renderEach 钩子执行（第 229 行）
6. 导航完成（第 296 行）- 包含持续时间

### 4. 钩子执行日志（任务 4）

**位置：** `src/features/hooks.ts`
**日志点：**
1. executeHooks 方法（第 82 行）
2. runHook 方法（第 107 行）
3. executeRouteGuards 方法（第 150 行）
4. executeRenderEach 方法（第 246 行）

### 5. 导航方法日志（任务 5）

**位置：** `src/router.ts` 导航方法
**覆盖方法：**
- push（第 323 行）
- replace（第 341 行）
- back（第 359 行）
- forward（第 373 行）
- go（第 387 行）

## 验证策略

### 自动化验证

**TypeScript 编译：**
```bash
bun run tsc --noEmit
```

**日志覆盖统计：**
```bash
# 验证 router.ts 中的调试日志
grep -c "debugLog" src/router.ts

# 验证 hooks.ts 中的调试日志
grep -c "Router Debug" src/features/hooks.ts
```

### 手动功能测试

1. **启用调试模式：**
```javascript
const router = new KylinRouter(host, {
  routes,
  debug: true
});
```

2. **执行导航操作：**
- 调用 `router.push('/about')`
- 调用 `router.replace('/home')`
- 调用 `router.back()`

3. **验证控制台输出：**
- 确认所有日志以 `[Router Debug]` 开头
- 验证日志格式统一且易读
- 检查包含关键信息（路由名称、参数、时间戳）

4. **性能验证：**
```javascript
const router = new KylinRouter(host, { routes, debug: false });
// 执行导航操作，确认无日志输出
```

## 成功标准

### 必须满足（MUST）

- ✅ TypeScript 编译无错误
- ✅ 所有 5 个任务完成
- ✅ 15+ 处调试日志（router.ts 7+ 处 + hooks.ts 4+ 处 + 导航方法 5 处）
- ✅ debug 默认为 false
- ✅ 所有日志使用 `[Router Debug]` 前缀
- ✅ 日志包含有用的调试信息（路由名称、参数、时间戳）

### 应该满足（SHOULD）

- ✅ 日志格式统一且易读
- ✅ 对象数据格式化输出（非字符串拼接）
- ✅ 不影响现有错误日志（console.error）

### 可以满足（CAN）

- ✅ 添加导航持续时间统计
- ✅ 记录钩子执行数量

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 性能影响 | 低 | 使用条件判断，debug 关闭时零开销 |
| 日志过多 | 中 | 保持关键点日志，避免过度记录 |
| 类型安全 | 低 | TypeScript 严格模式确保类型正确 |

## 依赖关系

**无依赖** - 所有任务可在 Wave 1 中并行执行

**后续影响：**
- 为未来的错误追踪和性能监控提供基础
- 可扩展为更复杂的日志系统（如日志级别、远程上报）

## 下一步行动

### 执行命令

```bash
# 快速执行模式（自动执行所有任务）
/gsd-execute-phase quick-debug-mode

# 或手动执行
bun run tsc --noEmit  # 类型验证
# 然后按照 PLAN.md 中的任务顺序执行
```

### 完成后

创建 `.planning/quick/debug-mode-SUMMARY.md` 记录：
- 实际执行时间
- 遇到的问题和解决方案
- 测试结果
- 改进建议

## 附录：调试日志示例

**预期输出格式：**

```
[Router Debug] push navigation called {path: '/about', state: undefined}
[Router Debug] Navigation started {pathname: '/about', search: '', navigationType: 'push'}
[Router Debug] Route matched {route: 'about', params: {}, query: {}}
[Router Debug] Executing beforeEach hooks
[Router Debug] Running hook {type: 'beforeEach', to: 'about', from: 'home'}
[Router Debug] Executing beforeEnter guards {route: 'about'}
[Router Debug] Executing renderEach hooks {route: 'about'}
[Router Debug] Navigation completed {route: 'about', duration: 45}
```

---

**计划创建时间：** 2026-04-07
**预计完成时间：** 2026-04-07（15-20 分钟）
**计划状态：** ✅ 就绪执行
