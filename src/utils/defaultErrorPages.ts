import { NotFoundPage } from "@/pages/404";
import { ServiceErrorPage } from "@/pages/500";
import { CommonErrorPage } from "@/pages/commonError";
import type { ErrorPageHandler } from "@/types";

/**
 * 获取默认的 errorPages 配置
 */
export function getDefaultErrorPages(): Record<string, ErrorPageHandler> {
    return {
        "404": NotFoundPage,
        "500": ServiceErrorPage,
        "*": CommonErrorPage,
    };
}
