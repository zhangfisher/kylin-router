# Loading 状态功能说明

## 功能概述

在路由导航时，Kylin Router 会自动在对应的 outlet 中显示 loading 状态，等 view 加载完成后再将实际内容插入。这提供了更好的用户体验，让用户知道系统正在处理他们的请求。

## 工作原理

### 1. 导航流程

当用户导航到一个新路由时：

```
用户点击链接
    ↓
路由匹配
    ↓
检查 view 是否已加载
    ↓
未加载 → 显示 <kylin-loading>
    ↓
异步加载 view
    ↓
加载成功 → 渲染实际内容（替换loading）
加载失败 → 移除loading，记录错误
```

### 2. 递归渲染

对于嵌套路由（如 `/a/b/c`），每一层都会独立处理 loading 状态：

```
根路由 (/)
    ↓
显示 loading
    ↓
加载完成，渲染内容
    ↓
子路由 (a)
    ↓
在父路由的 outlet 中显示 loading
    ↓
加载完成，渲染内容
    ↓
子子路由 (b)
    ...
```

## 技术实现

### 核心方法

#### 1. `_renderRouteHierarchy`
修改了递归渲染逻辑，在渲染前检查是否需要加载 view：

```typescript
// 检查当前层是否已加载组件
let loadResult = (route as any).viewContent;

// 如果有 view 但还没有加载，先显示 loading
if (route.view && !loadResult) {
    this.log(`渲染流程: 路由 ${route.name} 需要加载，先显示 loading`);
    this._showLoadingInOutlet(outlet);

    // 加载 view
    loadResult = await this._loadViewForRoute(route);

    if (!loadResult) {
        this.log(`渲染流程: 路由 ${route.name} 加载失败`);
        this._hideLoadingInOutlet(outlet);
        continue;
    }
}
```

#### 2. `_showLoadingInOutlet`
在 outlet 中显示 loading 状态：

```typescript
protected _showLoadingInOutlet(outlet: HTMLElement): void {
    this.log("渲染流程: 显示 loading 状态");

    // 创建 loading 元素
    const loadingElement = document.createElement("kylin-loading");
    loadingElement.setAttribute("data-role", "loading-indicator");

    // 清空 outlet 并插入 loading
    outlet.innerHTML = "";
    outlet.appendChild(loadingElement);
}
```

#### 3. `_hideLoadingInOutlet`
隐藏 outlet 中的 loading 状态：

```typescript
protected _hideLoadingInOutlet(outlet: HTMLElement): void {
    this.log("渲染流程: 隐藏 loading 状态");

    const loadingElement = outlet.querySelector("kylin-loading[data-role='loading-indicator']");
    if (loadingElement) {
        loadingElement.remove();
    }
}
```

#### 4. `_loadViewForRoute`
为单个路由加载 view：

```typescript
protected async _loadViewForRoute(route: RouteItem): Promise<any> {
    if (!route.view) {
        return null;
    }

    this.log(`渲染流程: 加载路由 ${route.name} 的 view`);

    try {
        const view = route.view;
        let loadResult;

        if (isViewOptions(view)) {
            loadResult = await this.viewLoader.loadView(
                typeof view.form === "string" || typeof view.form === "function"
                    ? view.form
                    : view.form,
                view,
            );
        } else if (typeof view === "string" || typeof view === "function") {
            loadResult = await this.viewLoader.loadView(view, undefined);
        } else {
            loadResult = { success: true, content: view };
        }

        if (loadResult.success) {
            this.log(`渲染流程: 路由 ${route.name} view 加载成功`);
            (route as any).viewContent = loadResult.content;
            return loadResult.content;
        } else {
            this.log(`渲染流程: 路由 ${route.name} view 加载失败`, loadResult.error);
            return null;
        }
    } catch (error) {
        console.error(`渲染流程: 路由 ${route.name} view 加载异常:`, error);
        return null;
    }
}
```

## 使用示例

### 基本用法

```typescript
const router = new KylinRouter(app, {
    routes: {
        name: 'home',
        path: '/',
        view: {
            form: async () => {
                // 模拟异步加载
                await new Promise(resolve => setTimeout(resolve, 2000));
                return '<div>加载完成的内容</div>';
            }
        }
    }
});

router.attach();
```

### 嵌套路由

```typescript
const router = new KylinRouter(app, {
    routes: {
        name: 'parent',
        path: '/',
        view: '<div>父路由 <kylin-outlet></kylin-outlet></div>',
        children: [
            {
                name: 'child',
                path: 'child',
                view: {
                    form: async () => {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        return '<div>子路由内容</div>';
                    }
                }
            }
        ]
    }
});
```

## 用户体验优势

### 1. 即时反馈
- 用户点击链接后立即看到 loading 状态
- 不会让用户怀疑是否点击成功

### 2. 清晰的状态指示
- 明确告知用户内容正在加载
- 减少用户焦虑

### 3. 分层显示
- 嵌套路由的 loading 状态独立显示
- 每个区域有自己的 loading 指示器

### 4. 错误处理
- 加载失败时移除 loading
- 在控制台记录错误信息

## 自定义 Loading 组件

你可以自定义 `kylin-loading` 组件的样式和动画：

```css
kylin-loading[data-role='loading-indicator'] {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #667eea;
}

kylin-loading[data-role='loading-indicator']::after {
    content: '加载中...';
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

## 性能考虑

### 1. 按需加载
- 只有当 view 还未加载时才显示 loading
- 已加载的内容直接渲染，无需等待

### 2. 异步处理
- view 加载是异步的，不阻塞主线程
- 使用 Promise 处理异步操作

### 3. 内存管理
- 使用 `data-role` 属性标识 loading 元素
- 加载完成后及时移除，避免内存泄漏

## 测试与演示

完整的演示页面：`example/public/app/loading-demo.html`

演示场景：
1. 快速加载（0.5秒）
2. 慢速加载（2秒）
3. 嵌套路由 loading
4. 加载失败处理

## 相关提交

- `3256a56` - feat(outlet-rendering): 添加路由导航时的loading状态显示
- `5c13c0b` - feat(example): 添加loading状态演示页面

## 向后兼容性

此功能完全向后兼容：
- 不影响现有的路由配置
- 已加载的内容不受影响
- 可选功能，无需修改现有代码
