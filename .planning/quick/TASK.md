# 任务：修复 router.ts 参数处理错误

## 问题描述

router.ts 第 84-87 行的参数处理逻辑存在运行时错误风险和类型安全问题。

## 当前问题代码

```typescript
const resolvedOptions: KylinRouterOptiopns =
    Array.isArray(options) || ("path" in options && "name" in options)
        ? { routes: options as KylinRoutes }
        : (options as KylinRouterOptiopns);
```

## 问题详情

1. **运行时错误**: 当 options 是 string/function 时，`"path" in options` 会报错
2. **判断不准确**: 无法正确区分所有 KylinRoutes 类型
3. **类型不安全**: 使用 as 绕过类型检查

## 修复方案

按照类型优先级顺序检查：
1. Array - 路由数组
2. string - URL 字符串  
3. function - 路由加载函数
4. 包含 routes 属性 - 完整配置对象
5. 其他 - 单个 RouteItem

## 需要修改的文件

- `src/router.ts` - 修复构造函数中的参数处理逻辑

## 预期结果

- 正确处理所有 KylinRoutes 类型
- 消除运行时错误风险
- 提升类型安全性
- 添加完整的测试用例
