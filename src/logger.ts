export type KylinRouterLogger = {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    fatal: (message: string, ...args: any[]) => void;
};

export function createLogger(): KylinRouterLogger {
    function createLog(level: keyof KylinRouterLogger, output: (...args: any[]) => void) {
        return (message: string | Error, args: any[]) => {
            output(
                `[${level.toUpperCase()}] ${
                    typeof message === "string" ? message.params(...args) : message.message
                }`,
            );
        };
    }
    return {
        debug: createLog("debug", console.debug),
        info: createLog("info", console.info),
        warn: createLog("warn", console.warn),
        error: createLog("error", console.error),
        fatal: createLog("fatal", console.error),
    };
}
