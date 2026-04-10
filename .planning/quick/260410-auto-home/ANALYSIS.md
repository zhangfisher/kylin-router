# defaultRoute vs home 功能分析

## 当前实现对比

### defaultRoute（现有功能）

**触发时机**: 每次路由更新后（`_finalizeNavigation` 中调用）

**实现位置**: `src/features/routes.ts:259-290` (`checkDefaultRedirect`)

**功能**:
- 持续监听路由变化
- 每次访问根路径 `/` 时自动重定向到 `defaultRoute`
- 有循环重定向检测（MAX_REDIRECTS = 10）
- 使用 `push` 导航（产生历史记录）

**使用场景**:
- 用户手动访问根路径时重定向
- 应用运行期间的根路径访问

**配置示例**:
```typescript
const router = new KylinRouter("#app", {
  routes: [...],
  defaultRoute: "/dashboard" // 每次访问 / 都会重定向到 /dashboard
});
```

---

### home（新功能）

**触发时机**: 仅在路由器初始化时（`attach` 方法末尾）

**实现位置**: `src/router.ts:901-906`

**功能**:
- 只在路由器初始化时检查一次
- 如果当前路径为 `/` 且配置了 `home`，则导航到 home 路径
- 使用 `replace` 导航（不产生历史记录）
- 无循环检测（只执行一次）

**使用场景**:
- 应用首次加载时的默认路径
- 书签/分享链接的友好处理

**配置示例**:
```typescript
const router = new KylinRouter("#app", {
  routes: [...],
  home: "/dashboard" // 只有启动时在 / 才会导航到 /dashboard
});
```

---

## 功能重叠分析

| 维度 | defaultRoute | home |
|------|-------------|------|
| 触发时机 | 每次路由更新 | 仅初始化时 |
| 导航方式 | push（有历史） | replace（无历史） |
| 持续监听 | ✅ 是 | ❌ 否 |
| 循环检测 | ✅ 有 | ❌ 无 |
| 配置语义 | "默认路由" | "主页" |

---

## 建议方案

### 方案 1：移除 defaultRoute，统一使用 home

**优点**:
- API 更简洁，避免概念混淆
- `home` 更符合直觉

**缺点**:
- 失去运行时持续监听的能力
- 用户手动访问 `/` 不会再重定向

**实现**:
- 删除 `checkDefaultRedirect` 方法
- 删除 `defaultRoute` 配置项
- 更新所有测试

---

### 方案 2：移除 home，统一使用 defaultRoute

**优点**:
- `defaultRoute` 功能更完整
- 保持现有代码逻辑

**缺点**:
- `defaultRoute` 命名不如 `home` 直观
- 使用 `push` 会产生额外历史记录

**实现**:
- 删除 `home` 配置和相关代码
- 保留 `defaultRoute` 实现

---

### 方案 3：保留两者，明确职责（推荐）

**职责划分**:
- `home`: 应用启动时的默认路径（一次性）
- `defaultRoute`: 运行时根路径重定向（持续性）

**使用示例**:
```typescript
const router = new KylinRouter("#app", {
  routes: [...],
  home: "/landing",      // 启动时默认显示落地页
  defaultRoute: "/dashboard" // 访问 / 时重定向到控制台
});
```

**优点**:
- 两种场景都能覆盖
- 语义清晰

**缺点**:
- API 稍显复杂
- 需要文档说明区别

---

## 建议

**推荐方案 3**，理由：
1. 两者解决的实际场景不同
2. `home` 替代 `defaultRoute` 会丢失功能
3. 但需要改进命名和文档：
   - 考虑将 `defaultRoute` 重命名为 `rootRedirect`
   - 或在文档中明确说明两者的区别和适用场景

**次选方案 1**，如果追求简洁：
- 大多数应用只需要启动时导航
- 运行时重定向可以用路由守卫实现

---

## 最终决定

**选择方案 1：移除 defaultRoute，统一使用 home**

### 理由

1. **API 简洁性**: 避免两个相似的概念造成混淆
2. **直觉性**: `home` 比 `defaultRoute` 更符合用户直觉
3. **实际需求**: 大多数应用只需要启动时导航，不需要持续监听
4. **替代方案**: 需要持续监听的场景可以用路由守卫实现

### 已完成的工作

✅ 移除 `src/features/routes.ts` 中的 `defaultRoute` 相关代码
✅ 移除 `src/router.ts` 中对 `checkDefaultRedirect()` 的调用
✅ 更新所有测试文件，移除 `defaultRoute` 相关测试
✅ 删除 `router.redirect.test.ts`（专门测试 defaultRoute 的文件）

### 迁移指南

如果之前使用了 `defaultRoute`，请按以下方式迁移：

```typescript
// 旧方式（已移除）
const router = new KylinRouter("#app", {
  routes: [...],
  defaultRoute: "/dashboard"
});

// 新方式：使用 home
const router = new KylinRouter("#app", {
  routes: [...],
  home: "/dashboard"
});

// 如果需要持续监听根路径访问，使用路由守卫
const router = new KylinRouter("#app", {
  routes: [...],
  onBeforeEach: (to) => {
    if (to.path === '/') {
      return '/dashboard';
    }
  }
});
```

### 影响评估

- **破坏性变更**: 是，移除了 `defaultRoute` 配置项
- **迁移难度**: 低，只需改名为 `home` 或使用路由守卫
- **向后兼容**: 否，需要更新现有代码

---

**决定时间**: 2026-04-10
**决定人**: 用户
**执行状态**: ✅ 已完成
