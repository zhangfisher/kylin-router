import type { KylinRouterOptions } from "./types/config";

export type KylinRouterLogger = {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
};

export function createLogger(options: KylinRouterOptions): KylinRouterLogger {
    function createLog(level: keyof KylinRouterLogger, output: (...args: any[]) => void) {
        return (message: string | Error, ...args: any[]) => {
            if (!options.debug) {
                if (["debug", "info"].includes(level)) {
                    return;
                }
            }
            // 处理 Error 类型
            if (message instanceof Error) {
                output(`[${level.toUpperCase()}] ${message.message}`, ...args);
                return;
            }

            // 处理参数：函数类型需要调用
            const processedArgs = args.map((arg) => {
                return typeof arg === "function" ? arg() : arg;
            });

            let finalMessage = `[${level.toUpperCase()}] ${message}`;
            let positionalArgs: any[] = [];

            // 特殊处理：当只有一个参数且是数组时，展开为位置参数
            if (processedArgs.length === 1 && Array.isArray(processedArgs[0])) {
                positionalArgs = processedArgs[0];
            } else {
                // 处理多参数情况
                for (const arg of processedArgs) {
                    // 对象参数用于属性插值
                    if (arg && typeof arg === "object" && !Array.isArray(arg)) {
                        // 检查对象是否有属性被使用
                        let used = false;
                        finalMessage = finalMessage.replace(/\{([^}]+)\}/g, (match, content) => {
                            const trimmed = content.trim();
                            const parts = trimmed.split(/\s+/);

                            if (parts.length === 1) {
                                // 简单占位符: {key}
                                const key = parts[0];
                                if (key in arg) {
                                    used = true;
                                    return String(arg[key]);
                                }
                                return match; // 属性不存在，保留原样
                            }

                            // 格式占位符: 2段及以上
                            // 规则：前缀紧跟{，后缀紧跟}，中间是属性名
                            let prefix = "";
                            let key = "";
                            let suffix = "";

                            if (parts.length === 2) {
                                // 2段：判断是 {prefix key} 还是 {key suffix}
                                // 通过检查哪段在对象中存在来决定
                                const [first, last] = parts;
                                if (first in arg) {
                                    // {key suffix} 格式
                                    key = first;
                                    suffix = last;
                                } else if (last in arg) {
                                    // {prefix key} 格式
                                    prefix = first;
                                    key = last;
                                } else {
                                    // 都不在对象中，默认 {prefix key} 格式
                                    prefix = first;
                                    key = last;
                                }
                            } else {
                                // 3段及以上：第一段是前缀，最后一段是后缀，中间合并为属性名
                                prefix = parts[0];
                                suffix = parts[parts.length - 1];
                                key = parts.slice(1, -1).join(" ");
                            }

                            // 格式占位符始终标记为已使用
                            used = true;
                            if (key in arg && arg[key] !== "" && arg[key] !== null && arg[key] !== undefined) {
                                return prefix + String(arg[key]) + suffix;
                            }

                            // 属性不存在或为空，返回空字符串（不输出前后缀）
                            return "";
                        });
                        // 如果对象属性没有被使用，加入位置参数列表
                        if (!used) {
                            positionalArgs.push(arg);
                        }
                    } else {
                        // 非对象参数加入位置参数列表
                        positionalArgs.push(arg);
                    }
                }
            }

            // 处理位置占位符 {}（只处理空占位符）
            let argIndex = 0;
            finalMessage = finalMessage.replace(/\{\}/g, () => {
                if (argIndex < positionalArgs.length) {
                    return String(positionalArgs[argIndex++] ?? "");
                }
                return "{}";
            });

            // 移除已使用的位置参数，剩余参数传递给 console
            const remainingArgs = positionalArgs.slice(argIndex);
            output(finalMessage, ...remainingArgs);
        };
    }
    return {
        debug: createLog("debug", console.debug),
        info: createLog("info", console.info),
        warn: createLog("warn", console.warn),
        error: createLog("error", console.error),
    };
}
