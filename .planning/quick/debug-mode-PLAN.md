---
phase: quick-debug-mode
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/types.ts, src/router.ts, src/features/hooks.ts]
autonomous: true
requirements: [DEBUG-001, DEBUG-002, DEBUG-003, DEBUG-004]
user_setup: []
must_haves:
  truths:
    - "开发者可以通过配置 debug: true 启用调试模式"
    - "调试模式下路由导航的关键步骤会输出详细日志"
    - "调试模式默认关闭，不影响生产环境性能"
    - "所有调试日志使用统一的前缀格式 [Router Debug]"
  artifacts:
    - path: "src/types.ts"
      provides: "调试选项类型定义"
      contains: "debug?: boolean"
    - path: "src/router.ts"
      provides: "路由核心调试日志"
      contains: "debugLog() 方法"
    - path: "src/features/hooks.ts"
      provides: "钩子执行调试日志"
      contains: "调试日志输出"
  key_links:
    - from: "KylinRouter 构造函数"
      to: "debug 属性"
      via: "options.debug 参数传递"
      pattern: "this.debug = options.debug || false"
    - from: "router.ts 调试方法"
      to: "hooks.ts 钩子执行"
      via: "router.debugLog() 调用"
      pattern: "router.debugLog\\(.*\\)"
---

## 目标

为 KylinRouter 添加调试模式，帮助开发者在开发时调试路由导航流程和钩子执行。

**目的：** 提供可配置的调试日志系统，不影响生产环境性能
**输出：** 完整的调试模式实现，包括类型定义、核心日志方法和钩子调试日志

## 背景

**为什么需要调试模式：**
- 当前路由系统复杂，包含多个钩子和守卫
- 开发者需要了解导航流程和钩子执行顺序
- 便于排查路由问题和性能瓶颈

**当前问题：**
- 缺乏统一的调试日志系统
- 钩子执行过程不可见
- 难以追踪导航失败的原因

## 上下文

@.planning/PROJECT.md
@.planning/ROADMAP.md
@src/types.ts
@src/router.ts
@src/features/hooks.ts

## 任务

<task type="auto">
  <name>任务 1：在类型定义中添加 debug 选项</name>
  <files>src/types.ts</files>
  <action>
    在 KylinRouterOptiopns 接口中添加 debug 选项：
    
    1. 找到 KylinRouterOptiopns 接口定义（第 170 行）
    2. 在接口中添加 debug 属性：
       ```typescript
       /** 是否启用调试模式，默认 false */
       debug?: boolean;
       ```
    3. 添加在 defaultRoute 属性之后（第 179 行）
    4. 保持与现有属性风格一致
  </action>
  <verify>grep -n "debug\?: boolean" src/types.ts</verify>
  <done>KylinRouterOptiopns 接口包含 debug?: boolean 属性定义</done>
</task>

<task type="auto">
  <name>任务 2：在 KylinRouter 类中实现调试日志方法</name>
  <files>src/router.ts</files>
  <action>
    在 KylinRouter 类中添加调试日志功能：
    
    1. 在类属性区域添加 debug 属性（第 66 行附近）：
       ```typescript
       /** 是否启用调试模式 */
       debug: boolean = false;
       ```
    
    2. 在构造函数中初始化 debug 选项（第 123 行附近，initRoutes 之后）：
       ```typescript
       // 初始化调试模式
       this.debug = resolvedOptions.debug || false;
       ```
    
    3. 添加调试日志方法（在 detach() 方法之前，第 402 行）：
       ```typescript
       /**
        * 调试日志输出方法
        * @param message 日志消息
        * @param data 附加数据
        */
       protected debugLog(message: string, data?: any): void {
           if (this.debug) {
               console.log(`[Router Debug] ${message}`, data || '');
           }
       }
       ```
  </action>
  <verify>grep -n "debugLog\|debug:" src/router.ts | head -10</verify>
  <done>KylinRouter 类包含 debug 属性、初始化逻辑和 debugLog 方法</done>
</task>

<task type="auto">
  <name>任务 3：在路由导航关键位置添加调试日志</name>
  <files>src/router.ts</files>
  <action>
    在 onRouteUpdate 方法的关键位置添加调试日志：
    
    1. 导航开始（第 144 行）：
       ```typescript
       this.debugLog('Navigation started', {
           pathname,
           search,
           navigationType: this._pendingNavigationType || 'pop'
       });
       ```
    
    2. 路由匹配完成后（第 159 行）：
       ```typescript
       this.debugLog('Route matched', {
           route: this.current.route?.name || 'not-found',
           params: this.current.params,
           query: this.current.query
       });
       ```
    
    3. beforeEach 钩子执行前（第 165 行）：
       ```typescript
       this.debugLog('Executing beforeEach hooks');
       ```
    
    4. beforeEnter 守卫执行前（第 203 行）：
       ```typescript
       this.debugLog('Executing beforeEnter guards', {
           route: this.current.route?.name
       });
       ```
    
    5. renderEach 钩子执行前（第 229 行）：
       ```typescript
       this.debugLog('Executing renderEach hooks', {
           route: this.current.route?.name
       });
       ```
    
    6. 导航完成时（第 296 行）：
       ```typescript
       this.debugLog('Navigation completed', {
           route: this.current.route?.name,
           duration: Date.now() - navigationStartTime
       });
       ```
    
    7. 添加导航开始时间记录（第 143 行）：
       ```typescript
       const navigationStartTime = Date.now();
       ```
  </action>
  <verify>grep -n "debugLog" src/router.ts | wc -l</verify>
  <done>onRouteUpdate 方法包含 7+ 处调试日志，覆盖导航全流程</done>
</task>

<task type="auto">
  <name>任务 4：在钩子执行中添加调试日志</name>
  <files>src/features/hooks.ts</files>
  <action>
    在钩子执行的关键位置添加调试日志：
    
    1. 在 executeHooks 方法中（第 82 行）：
       ```typescript
       if ((this as any).debug) {
           console.log(`[Router Debug] Executing ${type} hooks`, {
               count: hooks.length
           });
       }
       ```
    
    2. 在 runHook 方法中（第 107 行）：
       ```typescript
       if ((this as any).debug) {
           console.log(`[Router Debug] Running hook`, {
               type,
               to: to.name,
               from: from.name
           });
       }
       ```
    
    3. 在 executeRouteGuards 方法中（第 150 行）：
       ```typescript
       if ((this as any).debug) {
           console.log(`[Router Debug] Executing route guards`, {
               guardType,
               routeCount: matchedRoutes.length
           });
       }
       ```
    
    4. 在 executeRenderEach 方法中（第 246 行）：
       ```typescript
       if ((this as any).debug) {
           console.log(`[Router Debug] Executing renderEach hooks`, {
               route: to.name,
               hookCount: allHooks.length
           });
       }
       ```
  </action>
  <verify>grep -n "Router Debug" src/features/hooks.ts | wc -l</verify>
  <done>hooks.ts 包含 4+ 处调试日志，覆盖钩子执行关键点</done>
</task>

<task type="auto">
  <name>任务 5：添加导航方法调试日志</name>
  <files>src/router.ts</files>
  <action>
    在导航方法（push、replace、back、forward、go）中添加调试日志：
    
    1. push 方法（第 323 行，在 _pendingNavigationType 设置后）：
       ```typescript
       this.debugLog('push navigation called', { path, state });
       ```
    
    2. replace 方法（第 341 行，在 _pendingNavigationType 设置后）：
       ```typescript
       this.debugLog('replace navigation called', { path, state });
       ```
    
    3. back 方法（第 359 行，在 _pendingNavigationType 设置后）：
       ```typescript
       this.debugLog('back navigation called');
       ```
    
    4. forward 方法（第 373 行，在 _pendingNavigationType 设置后）：
       ```typescript
       this.debugLog('forward navigation called');
       ```
    
    5. go 方法（第 387 行，在 _pendingNavigationType 设置后）：
       ```typescript
       this.debugLog('go navigation called', { delta });
       ```
  </action>
  <verify>grep -n "navigation called" src/router.ts | wc -l</verify>
  <done>所有导航方法包含调试日志，记录导航调用</done>
</task>

## 验证

<verification>
## 整体验证

1. **类型验证**：
   ```bash
   bun run tsc --noEmit
   ```
   确保 TypeScript 编译无错误

2. **功能测试**：
   - 创建测试页面，启用 debug 模式
   - 执行路由导航操作
   - 验证控制台输出调试日志
   - 确认日志格式统一为 `[Router Debug]`

3. **性能验证**：
   - 禁用 debug 模式
   - 执行路由导航
   - 确认无日志输出

4. **日志覆盖验证**：
   - 测试 push、replace、back、forward、go 方法
   - 测试 beforeEach、beforeEnter、renderEach、afterEach 钩子
   - 确认所有关键步骤都有日志输出
</verification>

## 成功标准

1. **类型定义完整**：KylinRouterOptiopns 包含 debug 选项
2. **日志系统实现**：debugLog 方法正确实现，支持条件输出
3. **关键点覆盖**：路由导航流程的 7+ 个关键位置有日志
4. **钩子调试**：钩子执行的 4+ 个关键位置有日志
5. **性能安全**：debug 默认关闭，不影响生产环境
6. **格式统一**：所有日志使用 `[Router Debug]` 前缀
7. **类型安全**：TypeScript 编译无错误
8. **功能完整**：所有导航方法都有日志输出

## 输出

完成后，更新 `.planning/quick/debug-mode-SUMMARY.md`

## 实现策略

**日志级别**：使用 `console.log` 确保最大兼容性
**条件判断**：使用 `if (this.debug)` 避免不必要的字符串拼接
**数据格式**：传递对象而非字符串，便于浏览器控制台展开查看
**时间戳**：记录导航开始和结束时间，便于性能分析
**错误处理**：保持现有的 console.error，不受 debug 模式影响

## 测试方案

**手动测试步骤**：
1. 在测试页面中启用 debug：`new KylinRouter(host, { routes, debug: true })`
2. 执行各种导航操作（push、replace、back 等）
3. 验证控制台输出的日志格式和内容
4. 禁用 debug，确认无日志输出

**自动化测试**（可选）：
- 添加单元测试验证 debugLog 方法
- Mock console.log，验证调用次数和参数
