export function quickHash(str: string, length: number = 12) {
    let hash = 2166136261; // offset_basis
    const fnvPrime = 16777619;

    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, fnvPrime);
    }

    // 确保32位无符号整数
    hash >>>= 0;
    return hash.toString(36).substring(0, length);
}
