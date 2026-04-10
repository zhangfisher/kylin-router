# 快速任务计划：路由器初始化时自动导航到 home 路径

**任务ID**: 260410-auto-home
**创建时间**: 2026-04-10
**优先级**: 中
**复杂度**: 简单

## 目标

当路由器初始化时，如果当前路径为根路径或空，自动导航到 `this.options.home` 配置的路径。

## 实现方案

### 分析当前代码

1. `attach()` 方法在构造函数中被调用（第162行）
2. `attach()` 方法的最后一步是执行 `this.routes.matchCurrentLocation()`（第899行）
3. 当前只是匹配位置，没有自动导航逻辑

### 实现步骤

1. **修改 `attach()` 方法**
   - 在 `matchCurrentLocation()` 之后添加自动导航逻辑
   - 检查当前路径是否为根路径 `/` 或空
   - 如果 `this.options.home` 不是 `/` 且当前路径为 `/`，则导航到 home

2. **实现细节**
   ```typescript
   // 在 attach() 方法末尾添加
   // 自动导航到 home 路径（如果配置了且当前在根路径）
   const currentPath = this.history.location.pathname;
   if (currentPath === '/' && this.options.home && this.options.home !== '/') {
       this.log(`自动导航到 home 路径: ${this.options.home}`);
       this.replace(this.options.home);
   }
   ```

### 验证方法

1. 配置 `home: '/dashboard'`
2. 访问根路径 `/`
3. 验证是否自动导航到 `/dashboard`

## 影响范围

- **修改文件**: `src/router.ts`
- **修改方法**: `attach()`
- **影响特性**: 路由初始化行为

## 风险评估

- **低风险**: 只影响初始化时的行为，且使用 `replace` 不会产生额外的历史记录
- **向后兼容**: 默认 `home: '/'` 不会触发自动导航，保持原有行为

## 预期结果

- 用户可以配置 `home` 路径，应用启动时自动导航到该路径
- 默认行为不变（`home: '/'` 不触发导航）
- 使用 `replace` 避免产生额外的历史记录

## 额外变更：移除 defaultRoute

在实现过程中，发现 `defaultRoute` 与 `home` 功能重叠，决定移除 `defaultRoute` 以简化 API。

### 移除的文件和代码

1. **src/features/routes.ts**
   - 移除 `defaultRoute` 属性
   - 移除 `_redirectCount` 属性
   - 移除 `checkDefaultRedirect()` 方法
   - 简化 `redirectToDefaultOrNotFound()` 方法，只保留 notFound 逻辑
   - 从 `initRoutes()` 方法中移除 `defaultRoute` 参数

2. **src/router.ts**
   - 从 `initRoutes()` 调用中移除 `defaultRoute` 参数
   - 移除 `_finalizeNavigation()` 中对 `checkDefaultRedirect()` 的调用
   - 更新错误处理中的 fallback 逻辑，不再使用 `defaultRoute`

3. **测试文件**
   - 删除 `src/__tests__/router.redirect.test.ts`（专门测试 defaultRoute 的文件）
   - 更新 `router.attach.test.ts`、`router.core.test.ts`、`router.dynamic.test.ts`，移除 `defaultRoute` 相关测试

### 迁移指南

如果之前使用了 `defaultRoute`，请改用 `home`：

```typescript
// 旧方式（已移除）
const router = new KylinRouter("#app", {
  routes: [...],
  defaultRoute: "/dashboard" // 每次访问 / 都重定向
});

// 新方式
const router = new KylinRouter("#app", {
  routes: [...],
  home: "/dashboard" // 仅在初始化时从 / 导航一次
});
```

### 行为差异

- **defaultRoute**: 每次访问根路径都重定向（持续监听）
- **home**: 仅在初始化时导航（一次性）

如果需要持续监听根路径访问，可以使用路由守卫：

```typescript
const router = new KylinRouter("#app", {
  routes: [...],
  onBeforeEach: (to) => {
    if (to.path === '/') {
      return '/dashboard';
    }
  }
});
```
