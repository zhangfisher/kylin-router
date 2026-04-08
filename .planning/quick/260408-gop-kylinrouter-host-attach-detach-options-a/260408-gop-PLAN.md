---
phase: quick
plan: 260408-gop
type: execute
wave: 1
depends_on: []
files_modified: [src/router.ts]
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "Host 相关逻辑从构造函数提取到 attach 方法"
    - "提供 detach 方法清理 host 绑定"
    - "提供 options 属性保存最终配置参数"
    - "提供 attached 属性标识当前状态"
    - "未 attached 时路由方法不可调用"
  artifacts:
    - path: "src/router.ts"
      provides: "重构后的 KylinRouter 类"
      contains: "attach(), detach(), options, attached"
  key_links:
    - from: "constructor"
      to: "attach()"
      via: "构造完成后调用"
      pattern: "this.attach\\(\\)"
    - from: "push/replace/back/forward"
      to: "attached"
      via: "状态检查"
      pattern: "if.*!this.attached.*throw"
---

## 目标

重构 `KylinRouter` 类，将构造函数中与 host 相关的逻辑提取到独立的 `attach()` 方法，实现配套的 `detach()` 清理逻辑，提供配置属性 `options` 和状态属性 `attached`，确保路由方法在未 attached 时不可调用。

**目的：**
- 分离关注点：构造函数负责配置初始化，attach/detach 负责 DOM 绑定
- 提高可维护性：清晰的初始化和清理流程
- 增强类型安全：通过 attached 状态防止未初始化时调用路由方法

**输出：**
- 重构后的 `KylinRouter` 类
- 新增 `options` 属性存储配置
- 新增 `attached` 属性标识状态
- 改进的 `attach()` 和 `detach()` 方法

## 上下文

@.planning/STATE.md
@./CLAUDE.md
@src/router.ts

# 当前实现分析

从 `src/router.ts` 可以看到：
- **第 114-123 行**：构造函数中处理 host 元素设置和调用 `attach()`
- **第 444-456 行**：已有 `detach()` 和 `attach()` 方法，但 `attach()` 仅监听 history
- **第 80-146 行**：构造函数混合了配置解析、host 设置、history 创建等职责

## 改进目标

1. **构造函数**：仅负责配置解析和属性初始化，不操作 DOM
2. **attach() 方法**：负责 host 绑定、history 监听、context provider 设置
3. **detach() 方法**：清理所有绑定和监听器
4. **options 属性**：保存解析后的最终配置
5. **attached 属性**：标识当前是否已绑定到 DOM

## 任务

<task type="auto" tdd="true">
  <name>任务 1: 添加 options 和 attached 属性，重构构造函数</name>
  <files>src/router.ts</files>
  <behavior>
    - 测试 1: 构造函数接收配置后，options 属性应包含解析后的完整配置
    - 测试 2: 新创建的实例 attached 应为 false
    - 测试 3: 构造函数不应操作 DOM（不设置 host 属性、不调用 attach）
    - 测试 4: 构造函数应正确解析各种格式的 options（数组、字符串、对象等）
  </behavior>
  <action>
    1. 在类属性区域添加：
       ```typescript
       /** 解析后的最终配置选项 */
       public options: KylinRouterOptiopns;

       /** 是否已绑定到 DOM */
       public attached: boolean = false;
       ```

    2. 重构构造函数（第 80-146 行）：
       - 保留 options 解析逻辑（第 86-107 行）
       - 将解析结果存储到 `this.options`
       - 创建 history 实例但不监听（第 109-112 行）
       - 初始化 routes 和 hooks（第 126-142 行）
       - **移除** host 设置逻辑（第 114-123 行）
       - **移除** `this.attach()` 调用

    3. 确保所有对 `resolvedOptions` 的引用改为 `this.options`
  </action>
  <verify>
    <automated>bun test src/router.test.ts</automated>
  </verify>
  <done>
    - options 属性存在且包含完整配置
    - attached 默认为 false
    - 构造函数不操作 DOM
    - 现有功能不受影响
  </done>
</task>

<task type="auto" tdd="true">
  <name>任务 2: 增强 attach() 方法实现完整绑定逻辑</name>
  <files>src/router.ts</files>
  <behavior>
    - 测试 1: attach() 调用后 attached 应为 true
    - 测试 2: attach() 应设置 host 属性并标记 data-kylin-router
    - 测试 3: attach() 应在 host.router 上存储 router 实例
    - 测试 4: attach() 应开始监听 history 变化
    - 测试 5: attach() 应设置 context provider
    - 测试 6: 重复调用 attach() 应抛出错误或忽略
  </behavior>
  <action>
    重写 `attach()` 方法（第 453-456 行）：

    ```typescript
    /**
     * 将 router 绑定到 host 元素并开始监听路由变化
     * @param host - 宿主元素或选择器字符串
     * @throws {Error} - 如果已 attached 或 host 无效
     */
    attach(host: HTMLElement | string = this.options.host): void {
        if (this.attached) {
            throw new Error("[KylinRouter] Already attached to a host element");
        }

        // 设置 host 元素
        this.host = typeof host === "string"
            ? (document.querySelector(host) as HTMLElement)
            : host;

        if (!(this.host instanceof HTMLElement)) {
            throw new Error("[KylinRouter] Host must be a valid HTMLElement");
        }

        // 标记 host 元素
        this.host.setAttribute("data-kylin-router", "");
        (this.host as any).router = this;

        // 开始监听路由变化
        this._cleanups.push(this.history.listen(this.onRouteUpdate.bind(this)));

        // 设置 context provider
        this.attachContextProvider();

        // 标记为已绑定
        this.attached = true;

        // 执行初始路由匹配
        this.routes.matchCurrentLocation();
    }
    ```

    同时更新 `KylinRouterOptiopns` 类型定义（如果需要），添加可选的 `host` 字段。
  </action>
  <verify>
    <automated>bun test src/router.test.ts</automated>
  </verify>
  <done>
    - attach() 完整实现所有绑定逻辑
    - attached 状态正确设置
    - 重复调用被阻止
  </done>
</task>

<task type="auto" tdd="true">
  <name>任务 3: 增强 detach() 方法并添加路由方法的状态检查</name>
  <files>src/router.ts</files>
  <behavior>
    - 测试 1: detach() 调用后 attached 应为 false
    - 测试 2: detach() 应清理 history 监听器
    - 测试 3: detach() 应移除 context provider
    - 测试 4: detach() 应清理 host 上的 router 引用
    - 测试 5: 未 attached 时调用 push/replace/back/forward 应抛出错误
    - 测试 6: 未 attached 时调用 go 应抛出错误
  </behavior>
  <action>
    1. 增强 `detach()` 方法（第 444-452 行）：

    ```typescript
    /**
     * 解除 router 与 host 的绑定并清理所有监听器
     */
    detach(): void {
        if (!this.attached) {
            return; // 或抛出警告
        }

        // 清理所有副作用
        this._cleanups.forEach((unsubscribe) => unsubscribe());
        this._cleanups = [];

        // 移除 context provider
        this.removeContextProvider();

        // 清理 host 引用
        if (this.host instanceof HTMLElement) {
            this.host.removeAttribute("data-kylin-router");
            delete (this.host as any).router;
        }

        // 标记为未绑定
        this.attached = false;
    }
    ```

    2. 为所有路由方法添加状态检查（push, replace, back, forward, go）：

    ```typescript
    private _ensureAttached(): void {
        if (!this.attached) {
            throw new Error("[KylinRouter] Cannot navigate: router is not attached to a host element. Call attach() first.");
        }
    }

    push(path: string, state?: unknown) {
        this._ensureAttached();
        this._pendingNavigationType = "push";
        // ... 现有逻辑
    }

    replace(path: string, state?: unknown) {
        this._ensureAttached();
        this._pendingNavigationType = "replace";
        // ... 现有逻辑
    }

    back() {
        this._ensureAttached();
        // ... 现有逻辑
    }

    forward() {
        this._ensureAttached();
        // ... 现有逻辑
    }

    go(delta: number) {
        this._ensureAttached();
        // ... 现有逻辑
    }
    ```

    3. 添加私有辅助方法 `_ensureAttached()`
  </action>
  <verify>
    <automated>bun test src/router.test.ts</automated>
  </verify>
  <done>
    - detach() 完整清理所有状态
    - 路由方法在未 attached 时抛出清晰错误
    - attached 状态正确管理
  </done>
</task>

## 威胁模型

### 信任边界

| 边界 | 描述 |
|------|------|
| 构造函数 → attach() | 配置初始化与 DOM 绑定分离 |
| 路由方法 → attached 状态 | 防止未初始化时执行导航 |

### STRIDE 威胁登记表

| 威胁 ID | 类别 | 组件 | 处置 | 缓解计划 |
|---------|------|------|------|----------|
| T-quick-gop-01 | 拒绝服务 (D) | attach() | 缓解 | 限制 attach 调用次数，防止重复绑定导致内存泄漏 |
| T-quick-gop-02 | 提权 (E) | 路由方法 | 缓解 | 通过 attached 状态检查防止未授权操作 |
| T-quick-gop-03 | 信息泄露 (I) | detach() | 接受 | 清理过程无敏感信息，状态可见性可接受 |

## 验证

- [ ] 构造函数不操作 DOM，仅初始化配置
- [ ] options 属性包含完整配置信息
- [ ] attached 属性正确反映绑定状态
- [ ] attach() 完整实现所有绑定逻辑
- [ ] detach() 完整清理所有状态和引用
- [ ] 路由方法在未 attached 时抛出清晰错误
- [ ] 现有测试全部通过
- [ ] 新增测试覆盖边界情况

## 成功标准

1. **关注点分离**：构造函数、attach、detach 各司其职
2. **状态管理**：attached 属性准确反映当前状态
3. **错误处理**：未 attached 时调用路由方法有明确错误提示
4. **向后兼容**：现有功能不受影响，测试全部通过
5. **代码质量**：清晰的注释和类型定义

## 输出

完成后创建 `.planning/quick/260408-gop-kylinrouter-host-attach-detach-options-a/260408-gop-SUMMARY.md`
