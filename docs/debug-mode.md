# KylinRouter 调试模式

## 概述

KylinRouter 提供了内置的调试模式，可以帮助开发者在开发过程中更好地理解和调试路由导航流程。

## 启用调试模式

在创建路由器实例时，设置 `debug: true` 选项：

```typescript
const router = await createRouter(document.body, {
    routes: [...],
    debug: true  // 启用调试模式
});
```

## 调试信息内容

当调试模式启用时，路由器会在控制台输出以下信息：

### 1. 导航开始
```
[Router Debug] 导航开始: from=home to=/about
```

### 2. 路由匹配结果
```
[Router Debug] 路由匹配: name=about params={}
```

### 3. 钩子执行
```
[Router Debug] 钩子执行: beforeEach
[Router Debug] 钩子执行: renderEach
[Router Debug] 钩子结果: renderEach 返回数据 {userId: "123", userName: "测试"}
[Router Debug] 钩子执行: afterEach
```

### 4. 导航完成
```
[Router Debug] 导航完成: route=about path=/about
```

### 5. 导航方法调用
```
[Router Debug] 导航方法: push(/about)
[Router Debug] 导航方法: replace(/home)
[Router Debug] 导航方法: back()
[Router Debug] 导航方法: go(-1)
```

## 使用示例

### 基础使用

```typescript
const router = await createRouter(document.body, {
    routes: [
        { name: 'home', path: '/', component: '<h1>首页</h1>' },
        { name: 'about', path: '/about', component: '<h1>关于</h1>' }
    ],
    debug: true
});

// 所有导航操作都会输出调试日志
router.push('/about');  // 输出调试日志
```

### 结合自定义钩子

```typescript
const router = await createRouter(document.body, {
    routes: [...],
    debug: true,
    onBeforeEach: (to, from) => {
        console.log('[自定义] 即将从', from.name, '导航到', to.name);
        return true;
    },
    renderEach: (to, from, next, router) => {
        console.log('[自定义] 预加载数据 for', to.name);
        // 预加载数据逻辑
        next({ preloadedData: 'some data' });
    }
});
```

## 调试技巧

### 1. 追踪导航流程
启用调试模式后，可以清楚地看到整个导航流程：
1. 导航开始
2. 路由匹配
3. 钩子执行（beforeEach → renderEach → afterEach）
4. 导航完成

### 2. 识别性能问题
通过调试日志的时间戳，可以识别哪个阶段耗时最长。

### 3. 调试路由配置
如果路由没有正确匹配，调试日志会显示匹配的路由名称和参数，帮助定位配置问题。

### 4. 监控钩子执行
可以清楚地看到每个钩子的执行顺序和返回结果，便于调试复杂的导航逻辑。

## 性能考虑

调试模式会在生产环境中产生额外的日志输出，因此：

- ✅ **开发环境**: 推荐启用 `debug: true`
- ❌ **生产环境**: 推荐禁用 `debug: false` 或不设置（默认为 false）

## 演示示例

查看 `example/debug-demo.html` 文件，体验完整的调试模式功能。

## 常见问题

**Q: 调试模式会影响性能吗？**  
A: 是的，调试模式会产生额外的日志输出。建议只在开发环境使用。

**Q: 可以动态切换调试模式吗？**  
A: 目前不支持动态切换。需要在创建路由器实例时设置。

**Q: 调试日志可以自定义吗？**  
A: 目前不支持自定义。如需自定义日志，可以使用全局钩子配合 console.log 实现。

## 相关文档

- [路由配置指南](./routes.md)
- [钩子系统](./hooks.md)
- [导航API](./navigation.md)
