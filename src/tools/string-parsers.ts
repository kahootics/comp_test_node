import { IllegalArgumentError } from "../errors/common-errors.mjs";

/** Converts string to kebab case */
export function toSafeKebab(string: string) {
    return string
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/** Converts string from kebab case */
export function fromSafeKebab(string: string) {
    return string
        .split("-")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * @param string - String to normalize
 * @returns normalized string
 */
export function toNormalized(string: string) {
    return string
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();
}

export function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/**
 * Extracts a portion of string between two provided substrings
 * @param str - The entire string to extract from
 * @param start - String to start the extraction from
 * @param end - String to end the extraction at
 * @returns the extracted string or `null`
 */
export function extractBetween(
	str: string,
   	start: string,
   	end: string
): string | null {

	const regex = new RegExp(`${escapeRegExp(start)}([^\\s]+?)${escapeRegExp(end)}`);
   	const match = str.match(regex);
   	return match && (match[1] ?? '');
}

/**
 * Formats an array of values into a CSV and swaps the last comma with an "and"
 * @param joiners - Array of strings to join into a comma separated list
 * @param and - (optional) Swapped in place of last comma   
 * Defaults to `"and"`
 * @returns formatted list
 */
export function formatList(joiners: string[], and?: string): string {
    return joiners.join(', ').replace(/, ([^,]+)$/g, ` ${and} $1`);
}

/**
 * @param list - list of strings among which to find duplicates.
 * @returns a set containing all duplicate strings from the list.
 */
export function duplicatesOfStringList(list: string[]) {
    const buffer = new Set<string>();
    const duplicates = new Set<string>();
    list.forEach(str => {
        if (buffer.has(str)) duplicates.add(str)
        else buffer.add(str);
    });
    return duplicates;
}

const queryParser = /^(?<key>\w[\w_.~-]*?)=(?<value>\w[\w_.~-]*?)$/
/** Parses a query string and returns a map of all of its pairs. */
export function parseQueryString(string: string) {
    const entries = string.split('&');
    if (entries.length < 1)
        throw new IllegalArgumentError(string + " is not a valid query string");

    const result = new Map<string, string>();
    entries.forEach(entry => {
        const { key, value } = entry.match(queryParser)?.groups ?? {};
        if (key && value)
            result.set(key, value);
        else throw new IllegalArgumentError(`Invalid query field no.${result.size} in ${string}`);
    });
    return result;
}
/** Recursively sorts any object key within the passed data structure. */
function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortKeysDeep);
    }
    if (value !== null && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
                return acc;
            }, {} as Record<string, unknown>);
    }
    return value;
}
/**
 * Converts a JavaScript value to a JavaScript Object Notation (JSON) string 
 * with any object key within the passed data structure sorted recursively by name.
 */
export function stableStringify(obj: unknown): string {
    return JSON.stringify(sortKeysDeep(obj));
}

export function deepEquals(a: object, b: object) {
    return stableStringify(a) === stableStringify(b);
}