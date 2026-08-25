import type { HeaderKeys } from "../headers-types.js";

export function ensurePath<T>(target: Record<string, any>, keys: HeaderKeys, defaultValue: T) {
    let current: any = target;
    const lastI = keys.length - 1;
    keys.forEach((key, i) => {
        if (i === lastI) current = (current[key] ??= defaultValue);
        else { current[key] ??= {}; current = current[key]; }
    });
    return current;
}
