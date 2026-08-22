import type { HeaderKeys } from "../rr.js";

export function setPath<T>(target: Record<string, any>, keys: HeaderKeys, value: T) {
    let current = target;
    const lastI = keys.length - 1;
    keys.forEach((key, i) => {
        if (i === lastI) current[key] = value;
        else { current[key] ??= {}; current = current[key]; }
    });
}

