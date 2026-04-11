# Kylin Router v2.0.0 发布说明

**发布日期：** 2026-04-11
**版本类型：** 重大版本更新（Major Release）
**破坏性变更：** ⚠️ 是

---

## 🎉 版本概述

Kylin Router v2.0.0 是一个重大版本更新，完全重写了路由视图渲染机制，提供了更简洁的 API、更好的开发体验和更优秀的用户体验。

---

## ✨ 核心功能

### 1. 移除 kylin-outlet 的 path 属性

**Before：**
```html
<kylin-outlet path="/user"></kylin-outlet>
```

**After：**
```html
<kylin-outlet></kylin-outlet>
```

**优势：**
- ✅ 更简洁的 API
- ✅ 更符合 Web Components 设计理念
- ✅ 减少重复配置

### 2. 递归路由渲染

实现了全新的递归渲染算法，支持任意深度的嵌套路由：

```typescript
// 支持多层嵌套
/ → /a → /a/b → /a/b/c
```

**工作原理：**
1. 从根路由开始，逐层渲染
2. 每层在父 outlet 内部查找子 outlet
3. 使用 WeakRef 缓存 outlet 引用
4. 自动处理深度嵌套

### 3. 智能 outlet 创建

**规则：**
- ✅ 根路由：host 内部没有 outlet 时自动创建
- ❌ 子路由：必须在父路由的 view 中提供

**示例：**
```typescript
// 根路由 - 自动创建 outlet
const router = new KylinRouter(app, {
    routes: {
        name: 'root',
        path: '/',
        view: '<div>首页</div>'
    }
});

// 嵌套路由 - 父 view 必须包含 outlet
const router = new KylinRouter(app, {
    routes: {
        name: 'root',
        path: '/',
        view: '<div>父路由 <kylin-outlet></kylin-outlet></div>',
        children: [
            {
                name: 'child',
                path: 'child',
                view: '<div>子路由</div>'
            }
        ]
    }
});
```

### 4. Loading 状态显示

导航时自动显示 loading 状态，提供即时反馈：

```typescript
// 慢速加载示例
{
    name: 'slow',
    path: 'slow',
    view: {
        form: async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return '<div>加载完成</div>';
        }
    }
}
```

**用户体验流程：**
```
用户点击链接
    ↓
立即显示 <kylin-loading>（100ms 内）
    ↓
异步加载 view
    ↓
加载完成，显示实际内容
```

---

## 🚀 技术亮点

### 1. WeakRef 内存管理
```typescript
// 使用 WeakRef 避免内存泄漏
route.el = new WeakRef(outlet);
```

### 2. 递归渲染算法
```typescript
protected async _renderRouteHierarchy(matchedRoutes): Promise<void> {
    let parentElement = this.host;

    for (let i = 0; i < matchedRoutes.length; i++) {
        const route = matchedRoutes[i].route;

        // 只有根路由才自动创建 outlet
        const isRootRoute = i === 0;
        let outlet = this._findOrCreateOutlet(parentElement, isRootRoute);

        // 显示 loading 并加载 view
        if (route.view && !route.viewContent) {
            this._showLoadingInOutlet(outlet);
            await this._loadViewForRoute(route);
        }

        // 渲染到 outlet
        await super.renderToOutlet(route.viewContent, outlet);

        // 下一层在当前 outlet 内部查找
        parentElement = outlet;
    }
}
```

### 3. 完善的错误处理
- ✅ 加载失败时移除 loading
- ✅ 在控制台记录详细错误信息
- ✅ 不阻塞其他路由的正常渲染

---

## ⚠️ 破坏性变更

### 需要更新的代码

1. **移除 path 属性**
```diff
- <kylin-outlet path="/user"></kylin-outlet>
+ <kylin-outlet></kylin-outlet>
```

2. **确保嵌套路由的父 view 包含 outlet**
```diff
 const router = new KylinRouter(app, {
     routes: {
         name: 'parent',
         path: '/',
-        view: '<div>父路由</div>',
+        view: '<div>父路由 <kylin-outlet></kylin-outlet></div>',
         children: [
             {
                 name: 'child',
                 path: 'child',
                 view: '<div>子路由</div>'
             }
         ]
     }
 });
```

---

## 📦 升级指南

### 步骤 1：更新依赖
```bash
# 如果使用 npm
npm install kylin-router@latest

# 如果使用 bun
bun update kylin-router@latest
```

### 步骤 2：移除 path 属性
搜索项目中所有的 `<kylin-outlet>` 标签，移除 `path` 属性。

### 步骤 3：检查嵌套路由
确保所有嵌套路由的父 view 都包含 `<kylin-outlet>` 标签。

### 步骤 4：测试应用
- 测试所有路由导航
- 测试嵌套路由渲染
- 测试 loading 状态显示
- 检查控制台是否有错误

---

## 📚 文档和示例

### 新增文档
- [loading-feature.md](.claude/quick-tasks/loading-feature.md) - loading 功能详细说明
- [refactor-final-summary.md](.claude/quick-tasks/refactor-final-summary.md) - 重构任务总结

### 新增示例
- [loading-demo.html](example/public/app/loading-demo.html) - loading 状态演示

### 更新的示例
- [error-demo.html](example/public/app/error-demo.html) - 移除 path 属性
- [loader-demo.html](example/public/app/loader-demo.html) - 移除 path 属性
- [shop/index.html](example/public/shop/index.html) - 移除 path 属性

---

## 📊 性能改进

1. **按需加载** - 只有未加载的 view 才会触发加载
2. **内存管理** - 使用 WeakRef 避免内存泄漏
3. **递归优化** - 顺序处理，避免并发问题

---

## 🐛 已知问题

暂无

---

## 🙏 致谢

感谢所有为这个版本做出贡献的开发者！

---

## 📝 下一步计划

### 短期
- [ ] 添加递归渲染的单元测试
- [ ] 监控深层嵌套的性能表现
- [ ] 收集用户反馈

### 长期
- [ ] 考虑添加路由预加载功能
- [ ] 优化深层嵌套的渲染性能
- [ ] 添加更多的 loading 动画选项

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/zhangfisher/kylin-router)
- [问题反馈](https://github.com/zhangfisher/kylin-router/issues)
- [更新日志](CHANGELOG.md)

---

**注意：** 这是一个破坏性变更，请仔细阅读升级指南并充分测试后再部署到生产环境。
