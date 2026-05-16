import type { Alpine } from "alpinejs";

/**
 * 用于为注入数据
 * 
 * 
 *<div id="a" x-data="dropdown()" 
     x-inject-data="{ extraProp: 'A专属', type: 'premium' }">
    <span x-text="extraProp"></span>
    <span x-text="type"></span>
</div>
 * @param Alpine
 */
export function registerInjectDataDirective(Alpine: Alpine): void {
    // 注册自定义指令
    Alpine.directive("inject-data", (el, { expression }, { evaluate }) => {
        const extraData = evaluate(expression);
        const componentData = Alpine.$data(el);
        Object.assign(componentData, extraData);
    });
}
