# 测试模式

**分析日期：** 2026-04-07

## 测试框架

**Runner:**
- Bun Test (Bulldozer)
- 配置：内置在 Bun 运行时中
- 执行命令：`bun test`、`bun test --watch`

**测试环境：**
- DOM 模拟：`happy-dom` 20.8.9
- 测试工具：原生 `describe`、`it`、`expect` API
- 全局对象模拟：Window 对象和 document 对象

**测试命令：**
```bash
bun test                    # 运行所有测试
bun test --watch            # 监视模式
```

## 测试文件组织

**位置：**
- 测试文件与源代码同级：`src/__tests__/`
- 文件命名：`[module].[function].test.ts`

**文件结构：**
```
src/
├── __tests__/
│   ├── utils.traverseOutlet.test.ts
│   └── components.base.test.ts
└── [源代码文件]
```

**命名模式：**
- `[模块名].[功能名].test.ts`：`utils.traverseOutlet.test.ts`
- `[组件名].test.ts`：`components.base.test.ts`

## 测试结构

**Suite 组织：**
```typescript
describe("traverseOutlet", () => {
    describe("基本功能测试", () => {
        it("应该正确遍历单个 outlet", () => {
            // 测试代码
        });
        
        it("应该正确遍历多个兄弟 outlet（同一层）", () => {
            // 测试代码
        });
    });
    
    describe("层级计算测试", () => {
        // 更多测试
    });
});
```

**分层测试模式：**
- 第一层：功能模块描述
- 第二层：测试场景描述
- 第三层：具体测试用例

## 测试环境创建

**工厂函数模式：**
```typescript
function createTestEnvironment(html: string) {
    const window = new Window({
        url: "http://localhost:8080/",
        width: 1024,
        height: 768,
    });
    
    const document = window.document;
    
    // 设置全局对象
    // @ts-ignore
    globalThis.document = document;
    // @ts-ignore
    globalThis.window = window;
    
    // 注册自定义元素
    window.customElements.define(
        "kylin-outlet",
        class extends window.HTMLElement {
            constructor() {
                super();
            }
        }
    );
    
    document.body.innerHTML = html;
    const host = document.body.firstElementChild as unknown as HTMLElement;
    
    return { window, document, host };
}
```

**环境配置特点：**
- 模拟浏览器环境
- 注册自定义 Web Components
- 设置 HTML 内容
- 返回测试所需元素

## Mocking 模式

**DOM 元素 Mocking：**
```typescript
// 创建自定义元素
window.customElements.define(
    "kylin-outlet",
    class extends window.HTMLElement {
        constructor() {
            super();
        }
    }
);
```

**全局对象模拟：**
```typescript
// @ts-ignore
globalThis.document = document;
// @ts-ignore
globalThis.window = window;
// @ts-ignore
window.SyntaxError = SyntaxError;
```

**Router 实例 Mocking：**
```typescript
const host = document.createElement("div") as any;
document.body.appendChild(host);
const router = new KylinRouter(host, []);
```

## 断言模式

**DOM 元素验证：**
```typescript
expect(result.length).toBe(1);
expect(result[0].length).toBe(1);
expect(result[0][0].deref()).toBeDefined();
expect(result[0][0].deref()?.tagName.toLowerCase()).toBe("kylin-outlet");
```

**WeakRef 验证：**
```typescript
const outletRef = result[0][0];
expect(outletRef).toBeInstanceOf(WeakRef);
const outlet = outletRef.deref();
expect(outlet).toBeInstanceOf(window.HTMLElement);
expect(outlet?.id).toBe("test");
```

**性能验证：**
```typescript
const startTime = Date.now();
// 执行测试操作
const endTime = Date.now();
expect(endTime - startTime).toBeLessThan(100);
```

## Fixtures 和测试数据

**HTML 模板：**
```typescript
const html = /* html */ `
    <div>
        <kylin-outlet id="outlet1"></kylin-outlet>
        <kylin-outlet id="outlet2">
            <kylin-outlet id="outlet3"></kylin-outlet>
        </kylin-outlet>
    </div>
`;
```

**DOM 结构构建：**
```typescript
const level1 = document.createElement("div") as any;
const level2 = document.createElement("div") as any;
const level3 = document.createElement("div") as any;
const testElement = document.createElement("div") as any;

host.appendChild(level1);
level1.appendChild(level2);
level2.appendChild(level3);
level3.appendChild(testElement);
```

## 测试类型

**单元测试：**
- 工具函数测试：`traverseOutlet()`
- 组件基类功能测试：`KylinRouterElementBase`
- DOM 操作验证

**集成测试：**
- 组件间交互测试
- 事件传递测试
- Context 共享测试

**性能测试：**
- 深层嵌套查找性能
- 内存泄漏防护验证
- 批量操作性能

## 测试覆盖

**覆盖范围：**
- 基本功能测试
- 边界情况测试
- 错误处理测试
- 性能测试

**场景覆盖：**
- 单个元素操作
- 多元素批量操作
- 深层嵌套结构
- 复杂 DOM 结构
- 内存管理验证

## Common Patterns

**异步测试：**
```typescript
// 当前测试主要使用同步测试模式
// 异步操作依赖 Promise 和事件监听
```

**测试夹具：**
```typescript
beforeAll(() => {
    // 全局设置
});

afterAll(() => {
    // 清理工作
});
```

**参数化测试：**
```typescript
// 使用多个测试用例覆盖不同场景
describe("多种边界情况", () => {
    it("空容器", () => { /* 测试 */ });
    it("非目标元素", () => { /* 测试 */ });
    it("深层嵌套", () => { /* 测试 */ });
});
```

**自定义匹配器：**
- 使用 `expect()` 内置匹配器
- 自定义类型验证：`toBeInstanceOf(WeakRef)`
- DOM 结构验证：`toHaveAttribute()`、`toContainElement()`

---

*Testing analysis: 2026-04-07*