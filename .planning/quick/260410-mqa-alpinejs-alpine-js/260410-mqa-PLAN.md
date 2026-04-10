# Quick Task 260410-mqa: 引入alpinejs，使用alpine-js技能

**任务ID:** 260410-mqa
**描述:** 引入alpinejs，使用alpine-js技能
**创建日期:** 2026-04-10
**状态:** 计划中

## 目标

- KylinRouterOptions增加一个data属性，在实例化时创建一个全局alpine store供全局访问
- host元素启用x-data，以便host所有子元素均可以访问全局store中的数据
- 全局alpine store要包括：
  - current: 当前路由信息
  - modal：模态信息和方法，如openModal等
  - routes：访问RouteRegistry

## 计划任务

### Task 1: 扩展 KylinRouterOptions 类型定义

**文件:** `src/types/config.ts`

**操作:**
- 在 `KylinRouterOptiopns` 类型中添加 `data` 属性
- 类型定义为 `Record<string, any>` 或更具体的接口

**变更:**
```typescript
export type KylinRouterOptiopns = {
    // ... 现有属性
    /** Alpine.js 全局 store 初始数据 */
    data?: Record<string, any>;
};
```

**完成标准:**
- [ ] KylinRouterOptiopns 包含 data 属性
- [ ] TypeScript 编译无错误

---

### Task 2: 创建 Alpine.js 集成管理器

**文件:** `src/features/alpine.ts` (新建)

**操作:**
- 创建 AlpineManager 类用于管理 Alpine.js 集成
- 实现 store 初始化逻辑
- 实现 x-data 绑定逻辑

**内容:**
```typescript
import Alpine from 'alpinejs';
import type { KylinRouter } from '@/router';

export class AlpineManager {
    constructor(private router: KylinRouter) {}

    /**
     * 初始化 Alpine.js store
     */
    initStore(initialData?: Record<string, any>): void {
        // 创建全局 store
        Alpine.store('kylin', {
            // current: 当前路由信息
            get current() {
                return this.router.routes.current;
            },

            // modal: 模态信息和方法
            get modal() {
                return this.router.modalState;
            },
            openModal: (config: any) => this.router.openModal(config),
            closeModal: () => this.router.closeTopModal(),

            // routes: 访问 RouteRegistry
            get routes() {
                return this.router.routes;
            },

            // 自定义数据
            ...initialData
        });

        // 启动 Alpine.js
        Alpine.start();
    }

    /**
     * 为 host 元素绑定 x-data
     */
    bindHostData(host: HTMLElement): void {
        host.setAttribute('x-data', '{}');
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        // Alpine.js 不需要特殊清理
    }
}
```

**完成标准:**
- [ ] AlpineManager 类创建完成
- [ ] initStore 方法实现
- [ ] bindHostData 方法实现

---

### Task 3: 在 KylinRouter 中集成 AlpineManager

**文件:** `src/router.ts`

**操作:**
- 导入 AlpineManager
- 在构造函数中处理 options.data
- 在 attach() 方法中初始化 Alpine.js
- 为 host 元素绑定 x-data

**变更:**
1. 导入 AlpineManager:
```typescript
import { AlpineManager } from "./features/alpine";
```

2. 添加属性:
```typescript
/** Alpine.js 管理器 */
protected alpineManager?: AlpineManager;
```

3. 在构造函数中保存 data 选项:
```typescript
// 存储解析后的最终配置
this.options = Object.assign(
    {
        mode: "history",
        base: "",
        debug: false,
        data: {}, // 默认空对象
    },
    options && typeof options === "object" && "routes" in options
        ? options
        : {
              routes: options,
          },
);
```

4. 在 attach() 方法中初始化 Alpine.js（在设置 context provider 之后）:
```typescript
// 初始化 Alpine.js
this.alpineManager = new AlpineManager(this);
this.alpineManager.initStore(this.options.data);
this.alpineManager.bindHostData(this.host);
```

5. 在 detach() 方法中清理:
```typescript
// 清理 Alpine.js
if (this.alpineManager) {
    this.alpineManager.cleanup();
}
```

**完成标准:**
- [ ] AlpineManager 在 KylinRouter 中正确初始化
- [ ] host 元素成功绑定 x-data
- [ ] TypeScript 编译无错误

---

## 验证标准

1. **类型检查**: TypeScript 编译无错误
2. **功能验证**:
   - Alpine.js store 可通过 `Alpine.store('kylin')` 访问
   - store 包含 current、modal、routes 属性
   - host 元素具有 x-data 属性
3. **向后兼容**: 不传递 data 选项时也能正常工作

## 风险评估

- **低风险**: 仅添加新功能，不影响现有逻辑
- **兼容性**: Alpine.js 已安装，无需额外依赖
