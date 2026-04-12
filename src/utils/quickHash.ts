export function quickHash(str: string, length: number = 12) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // 转32位整数
    }
    // 转十六进制并截取
    return Math.abs(hash).toString(36).substring(0, length);
}
