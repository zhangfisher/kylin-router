---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/hooks.ts
  - src/router.ts
  - src/__tests__/router.hooks.test.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "HookManager 类已创建，构造函数接收 KylinRouter 实例"
    - "HookManager 内部方法移除 hook 后缀（add, remove, clear）"
    - "KylinRouter 移除 Hooks mixin，创建 hooks: HookManager 实例"
    - "测试文件使用 hooks.add/remove/clear 方法"
  artifacts:
    - path: "src/features/hooks.ts"
      provides: "HookManager 类"
      contains: "export class HookManager"
    - path: "src/router.ts"
      provides: "KylinRouter 使用 HookManager"
      contains: "public hooks: HookManager"
    - path: "src/__tests__/router.hooks.test.ts"
      provides: "测试文件更新"
      contains: "router.hooks.add"
  key_links:
    - from: "src/router.ts"
      to: "src/features/hooks.ts"
      via: "import HookManager"
      pattern: "import.*HookManager"
    - from: "src/__tests__/router.hooks.test.ts"
      to: "src/router.ts"
      via: "router.hooks.add/remove/clear"
      pattern: "router\\.hooks\\.(add|remove|clear)"
---

<objective>
重构 Hooks 类为 HookManager，改进架构清晰度

将 `Hooks` mixin 类重命名为 `HookManager`，改为独立类而非 mixin，构造函数接收 `KylinRouter` 实例。内部方法 `addHook/removeHook/clearHooks` 简化为 `add/remove/clear`。在 `KylinRouter` 中移除 Hooks mixin 混入，改为创建 `hooks: HookManager` 实例属性。更新测试文件使用新的 API。

目的：将钩子系统从 mixin 模式改为组合模式，提高代码可维护性和可测试性，使 API 更简洁清晰。
输出：重构后的 HookManager 类、更新后的 KylinRouter、更新的测试文件
</objective>

<execution_context>
@C:/Work/Code/kylin-router/.claude/get-shit-done/workflows/execute-plan.md
@C:/Work/Code/kylin-router/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/router.ts
@src/features/hooks.ts
@src/__tests__/router.hooks.test.ts
</context>

<tasks>

<task type="auto">
  <name>任务 1: 将 Hooks 类重构为 HookManager</name>
  <files>src/features/hooks.ts</files>
  <action>
1. 将类名从 `Hooks` 改为 `HookManager`
2. 添加构造函数接收 `KylinRouter` 实例：`constructor(private router: KylinRouter) {}`
3. 将所有方法移除 `Hook` 后缀：
   - `addHook(type, hook)` → `add(type, hook)`
   - `removeHook(type, hook)` → `remove(type, hook)`
   - `clearHooks(type?)` → `clear(type?)`
4. 将所有 `this.hooks` 访问改为 `this.router.hooks`
5. 更新所有使用 `this.addHook/removeHook/clearHooks` 的地方
6. 在文件末尾导出类：`export { HookManager }`

注意：保留 `hooks` 属性的初始化代码，但移到类属性声明中。
  </action>
  <verify>
```bash
grep -n "export class HookManager" src/features/hooks.ts
grep -n "constructor.*KylinRouter" src/features/hooks.ts
grep -n "add(" src/features/hooks.ts | head -1
grep -n "remove(" src/features/hooks.ts | head -1
grep -n "clear(" src/features/hooks.ts | head -1
```
  </verify>
  <done>
- HookManager 类已创建
- 构造函数接收 KylinRouter 实例
- 方法名已简化为 add/remove/clear
- 所有内部引用已更新
  </done>
</task>

<task type="auto">
  <name>任务 2: 在 KylinRouter 中使用 HookManager 实例</name>
  <files>src/router.ts</files>
  <action>
1. 在 import 语句中添加 HookManager：
   ```typescript
   import { HookManager } from "./features/hooks";
   ```

2. 在 KylinRouter 类定义中从 Mixin 移除 Hooks：
   ```typescript
   export class KylinRouter extends Mixin(
       Context,
       // Hooks,  // ← 删除这一行
       KeepAlive,
       ...
   ```

3. 在类属性中添加 hooks 实例：
   ```typescript
   /** 钩子管理器 */
   public hooks: HookManager;
   ```

4. 在构造函数中初始化 hooks（在 initRoutes 之后）：
   ```typescript
   // 初始化钩子管理器
   this.hooks = new HookManager(this);
   ```

5. 更新 executeHooks、executeRouteGuards、executeRenderEach 等方法的调用：
   - `this.executeHooks` → `this.hooks.executeHooks`
   - `this.executeRouteGuards` → `this.hooks.executeRouteGuards`
   - `this.executeRenderEach` → `this.hooks.executeRenderEach`

注意：HookManager 方法需要传递 router 参数（this），因为 HookManager 不是 mixin。
  </action>
  <verify>
```bash
grep -n "import.*HookManager" src/router.ts
grep -n "public hooks.*HookManager" src/router.ts
grep -n "new HookManager(this)" src/router.ts
grep -n "// Hooks," src/router.ts  # 应该被注释或删除
grep -n "this\.hooks\.execute" src/router.ts
```
  </verify>
  <done>
- KylinRouter 不再混入 Hooks
- hooks 实例已创建
- 所有钩子相关方法调用已更新为 this.hooks.*
  </done>
</task>

<task type="auto">
  <name>任务 3: 更新测试文件使用新的 HookManager API</name>
  <files>src/__tests__/router.hooks.test.ts</files>
  <action>
1. 更新所有直接操作 router.hooks 数组的代码：
   - `router.hooks.beforeEach.push(hook)` → `router.hooks.add("beforeEach", hook)`
   - `router.hooks.beforeEach.splice(index, 1)` → `router.hooks.remove("beforeEach", hook)`
   - `router.hooks.beforeEach = []` → `router.hooks.clear("beforeEach")`

2. 具体修改位置：
   - 行 82-95: beforeEach hooks 测试
   - 行 109-115: 取消导航测试
   - 行 130-136: 重定向测试
   - 行 152-156: 异步钩子测试
   - 行 172-181: 停止执行测试
   - 行 196-205: 重定向停止测试
   - 行 223-227: 参数传递测试
   - 行 243-259: 混合同步异步测试
   - 行 277-278: renderEach 测试
   - 行 294-304: 数据合并测试
   - 行 323-327: 异步 renderEach 测试
   - 行 342-349: 失败继续测试
   - 行 364-366: 直接返回数据测试
   - 行 380-383: 异步直接返回测试
   - 行 400-404: renderEach 参数测试
   - 行 419-426: undefined 处理测试
   - 行 441-448: next 和返回混合测试
   - 行 469-471: afterEach 测试
   - 行 486-492: afterEach 取消测试
   - 行 512-519: afterEach 重定向测试
   - 行 540-544: afterEach 顺序测试
   - 行 559-562: afterEach 异步测试
   - 行 579-582: afterEach 参数测试
   - 行 597-604: afterEach 错误处理测试
   - 行 622-626: 综合测试 beforeEach
   - 行 645-655: 综合测试所有钩子
   - 行 677-681: 失败继续测试
   - 行 707-714: 重定向循环测试
   - 行 732-739: 循环检测测试
   - 行 754-764: 添加钩子测试
   - 行 766-778: 移除钩子测试
   - 行 780-793: 清空指定类型测试
   - 行 795-814: 清空所有钩子测试
   - 行 816-837: 清空多个类型测试

注意：保留 @ts-ignore 注释，因为 hooks 属性是公开的但内部结构可能是私有的。
  </action>
  <verify>
```bash
grep -n "router\.hooks\.add(" src/__tests__/router.hooks.test.ts | head -5
grep -n "router\.hooks\.remove(" src/__tests__/router.hooks.test.ts
grep -n "router\.hooks\.clear(" src/__tests__/router.hooks.test.ts
grep -c "router\.hooks\..*\.push(" src/__tests__/router.hooks.test.ts  # 应该为 0
```
  </verify>
  <done>
- 所有测试使用新的 HookManager API
- 没有 .push() 直接操作数组
- 使用 add/remove/clear 方法
- 测试保持原有功能不变
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 测试代码 → 生产代码 | 测试直接访问内部 hooks 属性 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Spoofing | HookManager API | accept | 测试环境，无安全风险 |
| T-quick-02 | Tampering | 钩子函数执行 | accept | 测试环境，验证钩子系统行为 |
| T-quick-03 | Repudiation | 钩子执行日志 | accept | 测试环境，不需要审计 |
| T-quick-04 | Information Disclosure | 内部 hooks 结构 | accept | 测试需要访问内部状态验证行为 |
| T-quick-05 | Denial of Service | 钩子超时 | accept | 已有 30 秒超时保护 |
| T-quick-06 | Elevation of Privilege | 钩子权限 | accept | 测试环境，无权限控制 |

**无需缓解措施**：这是重构任务，不改变安全边界，仅改变代码组织方式。
</threat_model>

<verification>
1. 运行钩子系统测试确保所有功能正常：
   ```bash
   bun test src/__tests__/router.hooks.test.ts
   ```

2. 检查 TypeScript 编译无错误：
   ```bash
   bun run build
   ```

3. 验证 HookManager 类正确导出：
   ```bash
   grep -n "export.*HookManager" src/features/hooks.ts
   ```

4. 确认 KylinRouter 不再混入 Hooks：
   ```bash
   grep -n "extends Mixin" src/router.ts | grep -v "Hooks"
   ```

5. 运行所有测试确保重构没有破坏功能：
   ```bash
   bun test
   ```
</verification>

<success_criteria>
- [x] HookManager 类已创建，文件为 src/features/hooks.ts
- [x] HookManager 构造函数接收 KylinRouter 实例
- [x] HookManager 方法名为 add/remove/clear（无 Hook 后缀）
- [x] KylinRouter 移除 Hooks mixin
- [x] KylinRouter 创建 hooks: HookManager 实例
- [x] 所有钩子执行方法通过 this.hooks 调用
- [x] 测试文件使用 hooks.add/remove/clear 方法
- [x] 所有测试通过
- [x] TypeScript 编译无错误
</success_criteria>

<output>
完成后创建 `.planning/quick/260408-dub-class-hooks-hookmanager-kylinrouter-addh/260408-dub-SUMMARY.md`
</output>
