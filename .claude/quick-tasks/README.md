# 路由视图渲染重构 - 快速任务

## 📋 任务概览

**目标：** 重构 kylin-router 的路由视图渲染机制，从基于 `path` 属性的渲染改为基于路由分层的递归渲染。

**当前分支：** `refactor/outlet-rendering`

**预计工时：** 4-6小时

**创建时间：** 2026-04-11

---

## 📁 文档结构

```
.claude/quick-tasks/
├── README.md                      # 本文件 - 总览
├── refactor-outlet-rendering.md   # 详细任务文档
├── refactor-execution-plan.md     # 快速参考和执行计划
└── phase-1-checklist.md           # Phase 1 详细任务清单
```

---

## 🚀 快速开始

### 1. 查看任务概览
```bash
cat .claude/quick-tasks/refactor-execution-plan.md
```

### 2. 开始 Phase 1
```bash
cat .claude/quick-tasks/phase-1-checklist.md
```

### 3. 按计划执行
每个 Phase 完成后提交代码：
```bash
git add .
git commit -m "refactor(outlet-rendering): phase-X - description"
```

---

## 📊 进度追踪

| Phase | 任务 | 状态 | 完成时间 |
|-------|------|------|----------|
| 1 | 准备工作 | ⏳ 待开始 | - |
| 2 | 核心渲染逻辑 | ⏳ 待开始 | - |
| 3 | 简化outlet组件 | ⏳ 待开始 | - |
| 4 | 自动插入outlet | ⏳ 待开始 | - |
| 5 | 更新测试示例 | ⏳ 待开始 | - |

---

## 🎯 核心变更

### 移除：outlet 的 path 属性
```diff
- <kylin-outlet path="/user"></kylin-outlet>
+ <kylin-outlet></kylin-outlet>
```

### 新增：递归渲染逻辑
```
根路由 → 在 host 的 outlet 中渲染
  ↓
子路由 A → 在根路由的 outlet 中渲染
  ↓
子路由 B → 在子路由 A 的 outlet 中渲染
```

### 新增：RouteItem.el 属性
```typescript
interface RouteItem {
  el?: WeakRef<HTMLElement>;  // 指向渲染的 outlet
}
```

---

## 🔍 关键文件

### 需要修改的文件
- `src/router.ts` - 核心渲染逻辑
- `src/components/outlet/index.ts` - 移除 path 属性
- `src/features/render.ts` - 调整渲染逻辑
- `src/types/routes.ts` - 添加 RouteItem.el

### 新增的文件
- `src/utils/findOutletInElement.ts` - 查找 outlet 的工具函数

---

## ⚠️ 破坏性变更

这是一个**破坏性变更**，用户需要更新代码：

**旧代码：**
```html
<kylin-outlet path="/user"></kylin-outlet>
<kylin-outlet path="/user/profile"></kylin-outlet>
```

**新代码：**
```html
<kylin-outlet></kylin-outlet>
<!-- 路由会自动根据嵌套结构渲染 -->
```

---

## ✅ 验证清单

### 功能验证
- [ ] 根路由正确渲染
- [ ] 嵌套路由正确分层渲染
- [ ] RouteItem.el 正确指向 outlet
- [ ] 数据（x-data）正确设置
- [ ] 自动插入 outlet 正常工作

### 性能验证
- [ ] WeakRef 不造成内存泄漏
- [ ] 递归渲染性能可接受
- [ ] 路由切换时正确清理旧元素

### 兼容性验证
- [ ] 导航守卫正常
- [ ] 数据加载正常
- [ ] 钩子系统正常
- [ ] 模态路由正常

---

## 🔄 回滚计划

如果出现问题，可以快速回滚：

```bash
# 回滚到重构前
git checkout master

# 或回滚到某个 Phase
git reset --hard <commit-hash>
```

**建议：** 每个 Phase 完成后立即提交，方便回滚。

---

## 📝 提交规范

```bash
# Phase 完成提交
git commit -m "refactor(outlet-rendering): phase-1-complete - 准备工作完成"

# 单个 Task 提交
git commit -m "refactor(outlet-rendering): phase-1.1 - 添加 RouteItem.el 类型定义"
```

---

## 🛠️ 开发环境

**当前分支：** `refactor/outlet-rendering`

**测试服务器：**
```bash
bun run dev
```

**类型检查：**
```bash
bun run build
```

---

## 📚 参考资料

- 现有实现：`src/router.ts` 的 `renderToOutlets()` 方法
- Outlet 组件：`src/components/outlet/index.ts`
- 渲染特性：`src/features/render.ts`
- 路由匹配：`src/features/routes.ts`

---

## 🎉 完成后

1. 运行所有测试确保功能正常
2. 更新示例文档
3. 合并到主分支
4. 编写迁移指南（供用户参考）

---

**开始时间：** 执行 Phase 1 时记录
**完成时间：** 待定
**实际工时：** 待记录
