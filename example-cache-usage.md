# 视图缓存功能使用示例

## 功能概述

新增的视图缓存功能允许对加载的 view 内容进行缓存，避免重复加载，提升应用性能。

## 功能特性

1. **可配置的缓存时长**：通过 `cache` 参数设置缓存有效期（毫秒）
2. **自动过期检查**：缓存超时后自动失效，重新加载
3. **内存优化**：使用结构化缓存对象，包含内容、时间戳和有效期

## 使用方法

### 1. 基本用法

```typescript
import { KylinRouter } from 'kylin-router';

const router = new KylinRouter('#app', {
  routes: [
    {
      name: 'home',
      path: '/',
      view: {
        form: '/views/home.html',
        cache: 60000 // 缓存60秒
      }
    }
  ]
});
```

### 2. 不同的缓存策略

#### 不缓存（默认）
```typescript
{
  name: 'realtime-data',
  path: '/realtime',
  view: '/views/realtime.html'
  // cache 未设置或为 0，每次都重新加载
}
```

#### 短期缓存
```typescript
{
  name: 'dashboard',
  path: '/dashboard',
  view: {
    form: '/views/dashboard.html',
    cache: 5000 // 缓存5秒
  }
}
```

#### 长期缓存
```typescript
{
  name: 'static-page',
  path: '/about',
  view: {
    form: '/views/about.html',
    cache: 3600000 // 缓存1小时
  }
}
```

### 3. 动态组件缓存

```typescript
{
  name: 'user-profile',
  path: '/user/:id',
  view: {
    form: async () => {
      const module = await import('./views/UserProfile.js');
      return module.default;
    },
    cache: 30000 // 缓存30秒
  }
}
```

### 4. 完整配置示例

```typescript
const router = new KylinRouter('#app', {
  routes: [
    {
      name: 'home',
      path: '/',
      title: '首页',
      view: {
        form: '/views/home.html',
        cache: 60000,           // 缓存60秒
        timeout: 5000,          // 加载超时5秒
        allowUnsafe: false,     // 不允许不安全HTML
        selector: 'main'        // 提取main内容
      }
    },
    {
      name: 'products',
      path: '/products',
      view: {
        form: async () => import('./views/Products.js'),
        cache: 120000           // 缓存2分钟
      }
    },
    {
      name: 'realtime',
      path: '/realtime',
      view: '/views/realtime.html'
      // 不缓存，每次都获取最新数据
    }
  ]
});
```

## 工作原理

### 缓存结构

```typescript
interface ViewTemplate {
  content: any;        // 缓存的内容
  timestamp: number;   // 缓存时间戳
  duration: number;    // 缓存有效期（毫秒）
}
```

### 缓存检查流程

1. 检查路由是否存在 `_viewTemplate`
2. 如果存在，计算缓存时间差
3. 判断是否超时：`当前时间 - 缓存时间 > 有效期`
4. 如果有效，返回缓存内容
5. 如果无效或不存在，执行加载逻辑

### 缓存设置流程

1. 加载视图内容成功后
2. 检查 `viewOptions.cache` 是否大于 0
3. 如果需要缓存，创建缓存对象
4. 保存到 `route._viewTemplate`

## 性能优化建议

### 适合缓存的场景
- 静态内容页面（关于、帮助文档）
- 变化频率低的页面（产品列表、配置页）
- 加载成本高的组件（复杂图表、大型表单）

### 不适合缓存的场景
- 实时数据页面（股票行情、在线状态）
- 用户特定内容（个人消息、动态推荐）
- 频繁变化的页面（购物车、订单状态）

## 调试支持

启用调试模式查看缓存行为：

```typescript
const router = new KylinRouter('#app', {
  debug: true,
  routes: [...]
});
```

日志输出示例：
```
[KylinRouter] 渲染流程: 路由 home 使用缓存内容
[KylinRouter] 渲染流程: 路由 products 缓存已过期 (120000ms > 60000ms)
[KylinRouter] 渲染流程: 路由 about 内容已缓存 60000ms
```

## 注意事项

1. **内存管理**：缓存会占用内存，建议设置合理的过期时间
2. **数据一致性**：缓存期间内容不会更新，注意数据时效性
3. **调试模式**：开发时启用调试模式观察缓存行为
4. **缓存清理**：目前不支持手动清理，只能通过超时自动失效

## 迁移指南

现有项目无需修改，默认行为保持不变（cache=0，不缓存）。

要启用缓存，只需在 `RouteViewOptions` 中添加 `cache` 参数：

```typescript
// 之前
view: '/views/page.html'

// 之后
view: {
  form: '/views/page.html',
  cache: 60000
}
```
