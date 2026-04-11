# Base URL 自动检测和前缀处理

**任务ID:** 260411-base-url-auto-detection
**创建日期:** 2026-04-11
**状态:** 📋 计划完成
**预计时间:** 45 分钟
**实际时间:** 待记录

## 任务描述

实现 Kylin Router 的 base URL 自动检测和前缀处理功能，使路由器能够自动识别当前页面的基础路径，并在所有相对路径操作中自动应用此前缀。

## 核心功能

1. **自动检测 base URL**: 从 `window.location.pathname` 提取基础路径
2. **智能路径处理**: 移除 `.html`/`.htm` 文件名，保留目录路径
3. **自动前缀**: 在 kylin-link、loadView、loadData 中自动添加 base 前缀
4. **保留完整 URL**: `http://`、`https://`、`//` 开头的 URL 保持不变

## 技术要点

- 使用 TypeScript 严格模式
- 遵循项目命名约定（camelCase 函数）
- 复用现有工具函数（`joinPath`）
- 保持与现有架构兼容

## 实施计划

- [ ] Task 1: 创建 getBaseUrl 工具函数
- [ ] Task 2: 在路由器初始化时设置默认 base URL
- [ ] Task 3: kylin-link 组件自动前缀相对路径
- [ ] Task 4: loadView 操作自动前缀相对路径
- [ ] Task 5: loadData 操作自动前缀相对路径

## 影响范围

**修改文件:**
- `src/utils/getBaseUrl.ts` (新建)
- `src/router.ts`
- `src/components/link/index.ts`
- `src/features/viewLoader.ts`
- `src/features/dataLoader.ts`

**测试文件:**
- 待添加示例页面验证功能

## 依赖关系

- 依赖现有工具: `src/utils/joinPath.ts`
- 被依赖: 所有使用相对路径的路由操作

## 验收标准

1. Base URL 自动检测在多种部署场景下正确工作
2. 所有相对路径操作正确添加 base 前缀
3. 完整 URL 保持不变
4. TypeScript 编译无错误
5. 向后兼容现有代码

## 进度跟踪

- [x] 创建计划文档 (2026-04-11)
- [ ] 实施开发
- [ ] 测试验证
- [ ] 创建总结文档

## 相关链接

- 计划文档: `.planning/quick/260411-base-url-auto-detection/PLAN.md`
- 项目文档: `CLAUDE.md`
- 架构文档: `.planning/PROJECT.md`
