# Quick Task: Base URL Auto-Detection and Prefixing

**Created:** 2026-04-11
**Status:** ✅ Completed

## Task Description

处理路由的base参数，增加base URL的自动检测和前缀添加功能。

## Requirements

### 1. 创建 getBaseUrl 工具函数

- 文件位置：`src/utils/getBaseUrl.ts`
- 功能：
  - 读取当前页面的 pathname
  - 如果是 .html 或 .htm 文件，只取路径部分
  - 返回标准化后的 base URL
- 示例：
  - `/index.html` → `/`
  - `/app/index.html` → `/app/`
  - `/app/` → `/app/`

### 2. 设置 KylinRouter.options.base 默认值

- 修改 `src/router.ts`
- 在构造函数中，如果未提供 base 参数，自动调用 `getBaseUrl()` 获取默认值

### 3. kylin-link 组件自动添加 baseUrl

- 修改 `src/components/link/index.ts`
- 在处理点击事件时，自动为相对路径添加 baseUrl 前缀
- 检测是否为完整 URL（http://、https://、// 开头）

### 4. loadView 和 loadData 自动添加 baseUrl

- 修改相关特性文件（如 ComponentLoader）
- 在加载视图和数据时，自动为相对路径添加 baseUrl
- 保持完整 URL 不变

## Success Criteria

- [x] getBaseUrl 工具函数创建并能正确处理各种路径格式
- [x] KylinRouter.options.base 默认值自动设置
- [x] kylin-link 点击时自动添加 baseUrl
- [x] loadView 和 loadData 自动添加 baseUrl 前缀
- [x] 完整 URL 不受影响
- [x] 所有修改通过类型检查

## Implementation Notes

- 需要区分相对路径和绝对 URL
- 使用 URL 构造函数或正则表达式检测完整 URL
- 保持向后兼容性
