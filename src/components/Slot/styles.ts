import { css } from "lit";

/**
 * KylinSlot 组件样式
 *
 * @module components/Slot/styles
 */
export const styles = css`
    :host {
        display: none;
    }

    :host([active]) {
        display: block;
    }
`;
