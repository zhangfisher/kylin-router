/**
 * 在指定元素内部查找 kylin-outlet 元素
 * @param element - 要搜索的父元素
 * @returns 找到的 kylin-outlet 元素，如果未找到返回 null
 */
export function findOutletInElement(
    element: HTMLElement
): HTMLElement | null {
    if (!element) return null;

    // 深度查找第一个 kylin-outlet 元素
    return element.querySelector('kylin-outlet');
}
