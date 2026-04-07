---
phase: refactor-route-props
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/routes.ts
  - src/router.ts
  - src/types.ts
  - src/__tests__/router.core.test.ts
  - src/__tests__/router.navigation.test.ts
  - src/__tests__/router.hash.test.ts
  - src/__tests__/router.dynamic.test.ts
  - src/__tests__/router.redirect.test.ts
  - src/__tests__/router.remote.test.ts
  - src/__tests__/components.link.test.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "所有路由状态属性整合到 current 对象中"
    - "所有引用这些属性的代码都已更新"
    - "类型定义已更新并保持一致性"
    - "所有测试通过且功能正常"
  artifacts:
    - path: "src/features/routes.ts"
      provides: "重构后的路由状态属性结构"
      exports: ["Routes"]
    - path: "src/router.ts"
      provides: "更新后的路由状态引用"
    - path: "src/types.ts"
      provides: "更新后的类型定义"
  key_links:
    - from: "src/features/routes.ts"
      to: "src/router.ts"
      via: "mixin 继承"
      pattern: "class Routes"
    - from: "src/router.ts"
      to: "测试文件"
      via: "属性访问"
      pattern: "router\.(current|params|query)"
---

## objective

重构 Routes 类中的路由状态属性结构，将分散的属性（`currentRoute`、`params`、`query`）整合到一个 `current` 对象中，提升代码组织的清晰度和可维护性。

**目的：**
- 统一路由状态管理，使属性结构更清晰
- 减少属性分散，提升代码可读性
- 便于未来扩展路由状态相关功能

**输出：**
- 重构后的 Routes 类
- 更新所有引用这些属性的代码
- 更新的类型定义
- 所有测试通过

## execution_context

@src/features/routes.ts
@src/router.ts
@src/types.ts

## context

### 当前状态分析

**src/features/routes.ts 中的属性结构：**
```typescript
public currentRoute: { route: RouteItem; params: Record<string, string>; remainingPath: string } | null = null;
public params: Record<string, string> = {};
public query: Record<string, string> = {};
```

**src/router.ts 中的属性访问：**
```typescript
this.currentRoute = matched;
this.params = matched.params;
this.query = extractQueryParams(location.location.search);
```

**测试文件中的属性访问：**
```typescript
expect(router.currentRoute).not.toBeNull();
expect(router.params).toEqual({ id: "42" });
expect(router.query).toEqual({ tab: "profile" });
```

### 重构目标结构

**新结构：**
```typescript
public current: {
  route: RouteItem | null;
  params: Record<string, string>;
  query: Record<string, string>;
  remainingPath: string;
} = {
  route: null,
  params: {},
  query: {},
  remainingPath: ""
};
```

### 影响范围分析

通过代码分析，以下文件需要更新：

1. **核心实现文件：**
   - `src/features/routes.ts` - 属性定义和状态更新逻辑
   - `src/router.ts` - 属性访问和事件分发

2. **测试文件（9个）：**
   - `src/__tests__/router.core.test.ts`
   - `src/__tests__/router.navigation.test.ts`
   - `src/__tests__/router.hash.test.ts`
   - `src/__tests__/router.dynamic.test.ts`
   - `src/__tests__/router.redirect.test.ts`
   - `src/__tests__/router.remote.test.ts`
   - `src/__tests__/components.link.test.ts`
   - 其他相关测试文件

3. **类型定义：**
   - `src/types.ts` - 可能需要添加新类型定义

## tasks

### Task 1: 重构核心属性结构

<files>src/features/routes.ts, src/router.ts</files>

<action>
**步骤 1: 更新 src/features/routes.ts 中的属性定义**

将以下属性：
```typescript
public currentRoute: { route: RouteItem; params: Record<string, string>; remainingPath: string } | null = null;
public params: Record<string, string> = {};
public query: Record<string, string> = {};
```

重构为：
```typescript
public current: {
  route: RouteItem | null;
  params: Record<string, string>;
  query: Record<string, string>;
  remainingPath: string;
} = {
  route: null,
  params: {},
  query: {},
  remainingPath: ""
};
```

**步骤 2: 更新 src/features/routes.ts 中所有属性赋值**

在以下方法中更新属性赋值逻辑：
- `_matchCurrentLocation()` (第135-168行)
- `_matchAndUpdateState()` (第174-194行)
- `_redirectToDefaultOrNotFound()` (第235-246行)
- `removeRoute()` (第96-103行)

**步骤 3: 更新 src/router.ts 中的属性访问**

- `onRouteUpdate()` 方法中的所有属性访问
- 事件分发中的属性引用（第160-162行）
- 将 `this.currentRoute` 改为 `this.current.route`
- 将 `this.params` 改为 `this.current.params`
- 将 `this.query` 改为 `this.current.query`

**注意事项：**
- 保持所有业务逻辑不变，仅更改属性访问路径
- 确保所有 `null` 检查更新为 `this.current.route !== null`
- 确保类型安全，添加适当的类型断言（如果需要）
</action>

<verify>
```bash
# 编译检查
bun run build

# 类型检查
npx tsc --noEmit
```
</verify>

<done>
- src/features/routes.ts 中的属性已重构为 current 对象
- src/router.ts 中的所有属性访问已更新
- 代码通过编译和类型检查
</done>

### Task 2: 更新所有测试文件

<files>src/__tests__/router.core.test.ts, src/__tests__/router.navigation.test.ts, src/__tests__/router.hash.test.ts, src/__tests__/router.dynamic.test.ts, src/__tests__/router.redirect.test.ts, src/__tests__/router.remote.test.ts, src/__tests__/components.link.test.ts</files>

<action>
**更新策略：**

全局替换测试文件中的属性访问模式：
1. `router.currentRoute` → `router.current.route`
2. `router.params` → `router.current.params`
3. `router.query` → `router.current.query`

**具体文件更新：**

1. **router.core.test.ts:**
   - 第85-86行: `router.currentRoute` → `router.current.route`
   - 第96-97行: `router.currentRoute` → `router.current.route`
   - 第107行: `router.params` → `router.current.params`
   - 第116行: `router.query` → `router.current.query`

2. **router.navigation.test.ts:**
   - 第77-78行: `router.currentRoute` → `router.current.route`
   - 第87行: `router.currentRoute` → `router.current.route`
   - 第92-93行: `router.currentRoute` → `router.current.route`
   - 第102行: `router.currentRoute` → `router.current.route`
   - 第106行: `router.currentRoute` → `router.current.route`
   - 第111行: `router.currentRoute` → `router.current.route`
   - 第123行: `router.currentRoute` → `router.current.route`
   - 第128行: `router.currentRoute` → `router.current.route`
   - 第138行: `router.currentRoute` → `router.current.route`
   - 第143行: `router.currentRoute` → `router.current.route`
   - 第153行: `router.currentRoute` → `router.current.route`
   - 第158行: `router.currentRoute` → `router.current.route`
   - 第182-185行: 更新所有属性访问

3. **router.hash.test.ts:**
   - 第90-91行: `router.currentRoute` → `router.current.route`
   - 第100行: `router.currentRoute` → `router.current.route`
   - 第104行: `router.currentRoute` → `router.current.route`
   - 第108行: `router.params` → `router.current.params`
   - 第112行: `router.query` → `router.current.query`
   - 第142行: `router.currentRoute` → `router.current.route`
   - 第149行: `router.currentRoute` → `router.current.route`
   - 第152行: `router.currentRoute` → `router.current.route`

4. **其他测试文件（router.dynamic.test.ts, router.redirect.test.ts, router.remote.test.ts, components.link.test.ts）:**
   - 使用相同的替换模式
   - 确保所有断言正确更新

**注意事项：**
- 保持所有测试逻辑不变
- 确保断言的语义保持一致
- 检查是否有测试需要特别处理 `null` 情况
</action>

<verify>
```bash
# 运行所有测试
bun test

# 确保所有测试通过
```
</verify>

<done>
- 所有测试文件中的属性访问已更新
- 所有测试通过
- 测试覆盖率保持不变
</done>

### Task 3: 更新类型定义和文档

<files>src/types.ts</files>

<action>
**步骤 1: 添加新的类型定义**

在 src/types.ts 中添加 `CurrentRouteState` 接口：

```typescript
/**
 * 当前路由状态
 */
export interface CurrentRouteState {
  /** 当前匹配的路由配置 */
  route: RouteItem | null;
  /** 提取的路径参数 */
  params: Record<string, string>;
  /** 提取的查询参数 */
  query: Record<string, string>;
  /** 剩余未匹配的路径 */
  remainingPath: string;
}
```

**步骤 2: 更新 Routes 类的类型定义**

如果需要，在相关接口中引用新类型。

**步骤 3: 更新 JSDoc 注释**

确保所有相关的 JSDoc 注释准确反映新的属性结构。

**注意事项：**
- 保持向后兼容性（如果需要）
- 确保类型定义准确反映实际数据结构
</action>

<verify>
```bash
# 类型检查
npx tsc --noEmit

# 生成类型文档（如果有配置）
bun run docs
```
</verify>

<done>
- 类型定义已更新
- JSDoc 注释已更新
- 类型检查通过
</done>

### Task 4: 验证功能和清理

<files>src/features/routes.ts, src/router.ts, src/__tests__</files>

<action>
**步骤 1: 完整的功能测试**

```bash
# 运行所有测试
bun test

# 运行特定测试套件
bun test src/__tests__/router.core.test.ts
bun test src/__tests__/router.navigation.test.ts
bun test src/__tests__/router.hash.test.ts
```

**步骤 2: 手动验证**

如果项目有示例应用，运行并验证：
- 导航功能正常
- 路由参数正确提取
- 查询参数正确解析
- 404 处理正常
- 重定向功能正常

**步骤 3: 代码清理**

- 移除任何注释掉的旧代码
- 确保代码格式化（运行 `oxfmt` 如果可用）
- 检查是否有未使用的导入

**步骤 4: 更新相关文档**

如果有 README 或其他文档提到这些属性，确保更新。

**注意事项：**
- 确保所有边缘情况都被覆盖
- 检查是否有遗漏的属性访问
- 验证性能没有退化
</action>

<verify>
```bash
# 最终测试
bun test

# 构建验证
bun run build

# 代码格式化（如果可用）
oxfmt src/features/routes.ts src/router.ts src/types.ts
```
</verify>

<done>
- 所有测试通过
- 构建成功
- 代码已清理
- 文档已更新
- 功能验证完成
</done>

## verification

### 验证清单

- [ ] **属性结构重构完成**
  - [ ] `current` 对象包含所有路由状态
  - [ ] 旧的 `currentRoute`、`params`、`query` 属性已移除

- [ ] **核心实现更新**
  - [ ] `src/features/routes.ts` 中所有属性赋值已更新
  - [ ] `src/router.ts` 中所有属性访问已更新
  - [ ] 编译通过，无类型错误

- [ ] **测试更新完成**
  - [ ] 所有测试文件中的属性访问已更新
  - [ ] 所有测试通过
  - [ ] 测试覆盖率保持不变

- [ ] **类型定义更新**
  - [ ] 新的 `CurrentRouteState` 接口已添加
  - [ ] 类型检查通过
  - [ ] JSDoc 注释已更新

- [ ] **功能验证**
  - [ ] 导航功能正常
  - [ ] 路由匹配正确
  - [ ] 参数提取正确
  - [ ] 查询参数解析正确
  - [ ] 404 处理正常
  - [ ] 重定向功能正常

- [ ] **代码质量**
  - [ ] 代码格式化完成
  - [ ] 无未使用的代码
  - [ ] 文档已更新

## success_criteria

1. **属性结构重构：** `current` 对象替代分散的属性，结构清晰
2. **所有测试通过：** 100% 测试通过率
3. **类型安全：** TypeScript 编译无错误
4. **功能完整：** 所有路由功能正常工作
5. **代码质量：** 代码已清理，符合项目规范

## output

重构完成后，所有路由状态属性已整合到 `current` 对象中，代码结构更清晰，可维护性提升。

通过执行此计划，我们将：
- 统一路由状态管理
- 提升代码可读性
- 为未来扩展奠定基础
- 保持所有功能的完整性
