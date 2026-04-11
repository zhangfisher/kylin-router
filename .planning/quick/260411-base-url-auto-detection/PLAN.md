---
phase: quick-base-url-auto-detection
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/getBaseUrl.ts
  - src/router.ts
  - src/components/link/index.ts
  - src/features/viewLoader.ts
  - src/features/dataLoader.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "路由器自动检测当前页面的 base URL（去除 .html/.htm 文件名）"
    - "base URL 自动设置为 KylinRouter.options.base 的默认值"
    - "kylin-link 点击相对路径时自动添加 base URL 前缀"
    - "loadView/loadData 操作的相对路径自动添加 base URL 前缀"
    - "完整 URL（http://、https://、//）保持不变"
  artifacts:
    - path: "src/utils/getBaseUrl.ts"
      provides: "Base URL 检测工具函数"
      exports: ["getBaseUrl"]
    - path: "src/router.ts"
      provides: "路由器使用 getBaseUrl() 作为默认 base"
      contains: "options.base = getBaseUrl()"
    - path: "src/components/link/index.ts"
      provides: "链接组件自动前缀相对路径"
      contains: "handleClick 中添加 base URL 逻辑"
    - path: "src/features/viewLoader.ts"
      provides: "视图加载器自动前缀相对路径"
      contains: "loadView 中添加 base URL 逻辑"
    - path: "src/features/dataLoader.ts"
      provides: "数据加载器自动前缀相对路径"
      contains: "loadData 中添加 base URL 逻辑"
  key_links:
    - from: "src/router.ts"
      to: "src/utils/getBaseUrl.ts"
      via: "import getBaseUrl"
      pattern: "import.*getBaseUrl.*from.*getBaseUrl"
    - from: "src/components/link/index.ts"
      to: "src/router.ts"
      via: "this.router.options.base"
      pattern: "this\\.router\\.options\\.base"
    - from: "src/features/viewLoader.ts"
      to: "src/router.ts"
      via: "this.router.options.base"
      pattern: "this\\.router\\.options\\.base"
    - from: "src/features/dataLoader.ts"
      to: "src/router.ts"
      via: "this.router.options.base"
      pattern: "this\\.router\\.options\\.base"
---

## Objective

实现 Kylin Router 的 base URL 自动检测和前缀处理功能，使路由器能够自动识别当前页面的基础路径，并在所有相对路径操作中自动应用此前缀。

**Purpose:** 解决部署在子路径下的路由应用需要手动配置 base URL 的问题，提升开发体验和部署灵活性。

**Output:** 完整的 base URL 自动检测和前缀处理系统。

## Context

@src/router.ts
@src/components/link/index.ts
@src/features/viewLoader.ts
@src/features/dataLoader.ts
@src/utils/joinPath.ts

## Task Breakdown

### Task 1: 创建 getBaseUrl 工具函数

**Files:** `src/utils/getBaseUrl.ts`

**Action:**
1. 创建 `getBaseUrl()` 函数，从 `window.location.pathname` 提取 base URL
2. 实现智能路径提取逻辑：
   - 移除路径末尾的 `.html` 或 `.htm` 文件名
   - 保留目录路径（如 `/app/` 或 `/myapp/`）
   - 对于根路径返回 `/`
   - 对于无文件名的路径返回当前路径
3. 添加完整的 TypeScript 类型注解和 JSDoc 文档
4. 导出函数供其他模块使用

**Verify:**
```bash
# 在浏览器控制台测试
import { getBaseUrl } from '@/utils/getBaseUrl';
console.log(getBaseUrl()); // 应返回正确的 base URL
```

**Done:**
- `src/utils/getBaseUrl.ts` 文件存在并导出 `getBaseUrl` 函数
- 函数能正确处理各种路径格式（根路径、子路径、带文件名路径等）
- 包含完整的类型定义和文档注释

---

### Task 2: 在路由器初始化时设置默认 base URL

**Files:** `src/router.ts`

**Action:**
1. 导入 `getBaseUrl` 函数
2. 在构造函数中，如果 `options.base` 未提供（undefined），则使用 `getBaseUrl()` 作为默认值
3. 确保 base URL 存储在实例属性中，供组件和特性访问
4. 添加相关文档说明 base URL 的自动检测行为

**Verify:**
```bash
# 创建测试页面验证
new KylinRouter(host, {});
console.log(router.options.base); // 应显示自动检测的 base URL
```

**Done:**
- `KylinRouter` 构造函数自动使用 `getBaseUrl()` 作为默认 base
- 手动指定的 `options.base` 优先级高于自动检测值
- base URL 在实例生命周期内保持可访问

---

### Task 3: kylin-link 组件自动前缀相对路径

**Files:** `src/components/link/index.ts`

**Action:**
1. 在 `handleClick` 方法中添加 base URL 前缀逻辑
2. 仅对内部路由（`isInternalLink` 返回 true）应用前缀
3. 实现智能前缀判断：
   - 如果路径已是绝对路径（以 `/` 开头），检查是否需要 base 前缀
   - 如果路径是相对路径（不以 `/` 开头），直接添加 base 前缀
   - 保留完整 URL（`http://`、`https://`、`//`）不变
4. 使用 `joinPath` 工具函数确保路径拼接正确
5. 更新 `href` 属性以反映前缀后的路径

**Verify:**
```bash
# 测试各种路径格式
<kylin-link to="/home">Home</kylin-link>  # 应添加 base 前缀
<kylin-link to="about">About</kylin-link>  # 应添加 base 前缀
<kylin-link to="https://example.com">External</kylin-link>  # 保持不变
```

**Done:**
- 内部路由自动添加 base URL 前缀
- 外部链接保持原样
- 路径拼接正确，无重复 `/` 或格式错误
- 导航功能正常工作

---

### Task 4: loadView 操作自动前缀相对路径

**Files:** `src/features/viewLoader.ts`

**Action:**
1. 在 `loadView` 方法中添加 base URL 前缀逻辑
2. 检查 view URL 是否为相对路径
3. 对于相对路径，使用 `this.router.options.base` 进行前缀处理
4. 保留完整 URL（包含 `://` 或以 `//` 开头）不变
5. 使用 `joinPath` 工具函数确保路径拼接正确

**Verify:**
```bash
# 测试视图加载
router.loadView('components/home.html');  # 应添加 base 前缀
router.loadView('/absolute/path.html');   # 应正确处理
router.loadView('https://example.com/view.html');  # 保持不变
```

**Done:**
- 相对路径的 view URL 自动添加 base 前缀
- 绝对路径和完整 URL 保持不变
- 路径拼接格式正确
- 视图加载功能正常工作

---

### Task 5: loadData 操作自动前缀相对路径

**Files:** `src/features/dataLoader.ts`

**Action:**
1. 在 `loadData` 方法中添加 base URL 前缀逻辑
2. 检查 data URL 是否为相对路径
3. 对于相对路径，使用 `this.router.options.base` 进行前缀处理
4. 保留完整 URL（包含 `://` 或以 `//` 开头）不变
5. 使用 `joinPath` 工具函数确保路径拼接正确

**Verify:**
```bash
# 测试数据加载
router.loadData('api/home.json');  # 应添加 base 前缀
router.loadData('/absolute/api/data.json');  # 应正确处理
router.loadData('https://api.example.com/data');  # 保持不变
```

**Done:**
- 相对路径的 data URL 自动添加 base 前缀
- 绝对路径和完整 URL 保持不变
- 路径拼接格式正确
- 数据加载功能正常工作

---

## Threat Model

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 用户输入 → URL 处理 | 所有路径字符串（to 属性、view URL、data URL） |

### STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-baseurl-01 | Tampering | getBaseUrl | mitigate | 验证 pathname 格式，防止路径遍历攻击 |
| T-baseurl-02 | Injection | link.handleClick | accept | 仅处理内部路由，外部链接由浏览器处理 |
| T-baseurl-03 | Information Disclosure | URL 拼接 | accept | Base URL 本身是公开信息，无敏感数据 |
| T-baseurl-04 | Denial of Service | 路径拼接 | mitigate | 使用 joinPath 工具函数防止格式错误导致的无限循环 |

## Verification

### 整体验证
- [ ] Base URL 自动检测在多种部署场景下正确工作（根路径、子路径、带文件名）
- [ ] 所有相对路径操作正确添加 base 前缀
- [ ] 完整 URL 保持不变
- [ ] 路径拼接格式正确，无重复 `/` 或格式错误
- [ ] TypeScript 编译无错误
- [ ] 现有测试全部通过

### 场景测试
- [ ] 部署在根路径 `/` 的应用
- [ ] 部署在子路径 `/myapp/` 的应用
- [ ] 带文件名的路径（如 `/index.html`）
- [ ] 嵌套子路径（如 `/app/v1/`）
- [ ] 外部链接不被影响

## Success Criteria

1. **功能完整性**: base URL 自动检测在所有支持的浏览器中正确工作
2. **开发体验**: 开发者无需手动配置 base URL 即可在子路径下部署应用
3. **向后兼容**: 现有代码无需修改即可受益于自动检测功能
4. **类型安全**: 所有新增代码符合 TypeScript 严格模式要求
5. **测试覆盖**: 新功能有相应的测试或示例验证

## Output

After completion, create `.planning/quick/260411-base-url-auto-detection/SUMMARY.md`
