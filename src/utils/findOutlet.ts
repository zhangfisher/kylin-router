import type { KylinOutlet } from "@/components/outlet";

/**
 * 在指定元素内部查找 kylin-outlet 元素
 * @param el - 要搜索的父元素
 * @returns 找到的 kylin-outlet 元素，如果未找到返回 null
 */
export function findOutlet(el: HTMLElement): KylinOutlet[] {
    if (!el) return [];

    // 查找所有 kylin-outlet 元素（包括 el 本身，如果 el 是 kylin-outlet）
    const allOutlets = Array.from(el.tagName?.toLowerCase() === "kylin-outlet"
        ? [el, ...Array.from(el.querySelectorAll("kylin-outlet"))]
        : el.querySelectorAll("kylin-outlet"));

    // 过滤掉嵌套在另一个 kylin-outlet 内部的元素（不包括 el 本身）
    return allOutlets.filter((outlet) => {
        // 如果就是 el 本身，直接过滤掉
        if (outlet === el) return false;

        // 检查当前 outlet 的父元素中是否有 kylin-outlet（在 el 到 outlet 之间）
        let parent = outlet.parentElement;
        while (parent && parent !== el) {
            if (parent.tagName?.toLowerCase() === "kylin-outlet") {
                return false; // 被嵌套，过滤掉
            }
            parent = parent.parentElement;
        }
        return true; // 没有被嵌套，保留
    });
}
