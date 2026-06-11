#!/bin/bash
cd "E:\Work\Code\kylin-router"

echo "=== 测试结果摘要 ==="
echo ""

echo "1. 基础路由匹配渲染:"
bun test src/__tests__/features.render.test.ts -t "基础路由匹配渲染" 2>&1 | grep -E "pass|fail"
echo ""

echo "2. 通配符路由匹配渲染:"
bun test src/__tests__/features.render.test.ts -t "通配符路由匹配渲染" 2>&1 | grep -E "pass|fail"
echo ""

echo "3. 嵌套路由渲染:"
bun test src/__tests__/features.render.test.ts -t "嵌套路由渲染" 2>&1 | grep -E "pass|fail"
echo ""

echo "4. 默认路由和重定向:"
bun test src/__tests__/features.render.test.ts -t "默认路由和重定向" 2>&1 | grep -E "pass|fail"
echo ""

echo "5. 错误渲染:"
bun test src/__tests__/features.render.test.ts -t "错误渲染" 2>&1 | grep -E "pass|fail"
echo ""

echo "6. 导航回退:"
bun test src/__tests__/features.render.test.ts -t "导航回退" 2>&1 | grep -E "pass|fail"
echo ""

echo "7. 多次重复渲染:"
bun test src/__tests__/features.render.test.ts -t "多次重复渲染" 2>&1 | grep -E "pass|fail"
echo ""

echo "8. KeepAlive 缓存功能:"
bun test src/__tests__/features.render.test.ts -t "KeepAlive" 2>&1 | grep -E "pass|fail"
echo ""

echo "9. 异步视图加载:"
bun test src/__tests__/features.render.test.ts -t "异步视图加载" 2>&1 | grep -E "pass|fail"
echo ""

echo "10. 边界情况:"
bun test src/__tests__/features.render.test.ts -t "边界情况" 2>&1 | grep -E "pass|fail"
echo ""

echo "11. 路由守卫与渲染交互:"
bun test src/__tests__/features.render.test.ts -t "路由守卫与渲染交互" 2>&1 | grep -E "pass|fail"
echo ""

echo "12. 渲染钩子:"
bun test src/__tests__/features.render.test.ts -t "渲染钩子" 2>&1 | grep -E "pass|fail"
echo ""

echo "13. 特殊路由场景:"
bun test src/__tests__/features.render.test.ts -t "特殊路由场景" 2>&1 | grep -E "pass|fail"
echo ""

echo "14. 多级路由切换:"
bun test src/__tests__/features.render.test.ts -t "多级路由切换" 2>&1 | grep -E "pass|fail"
echo ""

echo "15. 路由参数变化:"
bun test src/__tests__/features.render.test.ts -t "路由参数变化" 2>&1 | grep -E "pass|fail"
echo ""

echo "16. 渲染版本控制:"
bun test src/__tests__/features.render.test.ts -t "渲染版本控制" 2>&1 | grep -E "pass|fail"
echo ""

echo "17. 视图容器管理:"
bun test src/__tests__/features.render.test.ts -t "视图容器管理" 2>&1 | grep -E "pass|fail"
echo ""
