# 任务：添加调试功能到 KylinRouter

## 任务描述

为 KylinRouter 添加调试模式，方便开发时调试路由导航流程和钩子执行。

## 需要实现的功能

1. **类型定义**: 在 `KylinRouterOptiopns` 中添加 `debug?: boolean` 选项
2. **默认值**: 默认为 `false`
3. **调试信息**: 当 `debug = true` 时，在以下场景打印调试信息：
   - 路由导航开始/结束
   - 各个钩子执行前后
   - 路由匹配结果
   - 参数提取结果
   - 守卫执行结果
   - 错误和异常

## 需要修改的文件

1. **src/types.ts**
   - 在 `KylinRouterOptiopns` 接口中添加 `debug?: boolean`

2. **src/router.ts**
   - 在构造函数中处理 debug 选项
   - 添加调试日志属性和方法
   - 在关键位置添加调试日志

3. **src/features/hooks.ts**（如果存在）
   - 在钩子执行前后添加调试日志

## 调试信息格式

使用统一的格式：
```
[Router Debug] 导航开始: from=/home to=/about
[Router Debug] 钩子执行: onBeforeResolve
[Router Debug] 路由匹配: matched=/about params={id: '123'}
[Router Debug] 导航完成: to=/about
```

## 预期效果

- 开发者可以通过设置 `debug: true` 来调试路由问题
- 不影响生产环境性能（默认关闭）
- 提供清晰的路由导航流程可视化
