# Phase 1: 准备工作 - 任务清单

> **预计工时：** 30分钟
> **状态：** 待开始

## Task 1.1: 更新类型定义

### 文件：`src/types/routes.ts`

**操作步骤：**

1. 在 `RouteItem` 接口中添加 `el` 属性：

```typescript
export interface RouteItem {
  name: string;
  path: string;
  // ... 其他现有属性

  /**
   * 指向渲染此路由的 outlet 元素的 WeakRef
   * 用于嵌套路由的递归渲染
   */
  el?: WeakRef<HTMLElement>;
}
```

2. 更新接口注释，说明新增字段的作用

**验证：**
- [ ] TypeScript 编译无错误
- [ ] 类型定义能正确引用 `WeakRef<HTMLElement>`

**提交命令：**
```bash
git add src/types/routes.ts
git commit -m "refactor(outlet-rendering): phase-1.1 - 添加 RouteItem.el 类型定义"
```

---

## Task 1.2: 创建工具函数

### 文件：`src/utils/findOutletInElement.ts`

**操作步骤：**

1. 创建新文件 `src/utils/findOutletInElement.ts`

2. 实现工具函数：

```typescript
/**
 * 在指定元素内部查找 kylin-outlet 元素
 * @param element - 要搜索的父元素
 * @returns 找到的 kylin-outlet 元素，如果未找到返回 null
 */
export function findOutletInElement(
  element: HTMLElement
): HTMLElement | null {
  if (!element) return null;

  // 深度查找第一个 kylin-outlet 元素
  return element.querySelector('kylin-outlet');
}
```

3. 在 `src/utils/index.ts` 中导出（如果存在）

**验证：**
- [ ] 函数能正确找到 kylin-outlet 元素
- [ ] 找不到时返回 null
- [ ] TypeScript 类型检查通过

**测试代码（可选）：**
```typescript
// 在开发环境测试
const testDiv = document.createElement('div');
testDiv.innerHTML = '<div><kylin-outlet></kylin-outlet></div>';
console.log(findOutletInElement(testDiv)); // 应该输出 kylin-outlet 元素
```

**提交命令：**
```bash
git add src/utils/findOutletInElement.ts
git commit -m "refactor(outlet-rendering): phase-1.2 - 添加 findOutletInElement 工具函数"
```

---

## Phase 1 完成检查

**完成标准：**
- [ ] Task 1.1 完成：类型定义已更新
- [ ] Task 1.2 完成：工具函数已创建
- [ ] 所有文件已提交到 git
- [ ] TypeScript 编译无错误

**下一步：**
开始 Phase 2 - 核心渲染逻辑重构

**Phase 1 完成后提交：**
```bash
git add .
git commit -m "refactor(outlet-rendering): phase-1-complete - 准备工作完成"
```

---

## 备注

- Phase 1 是准备工作，相对简单
- 确保类型定义正确，避免后续阶段出现类型错误
- 工具函数要简洁高效，避免性能问题
- 每个 Task 完成后立即提交，方便回滚
