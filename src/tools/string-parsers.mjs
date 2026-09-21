// @ts-check
import { IllegalArgumentError, IllegalStateError } from "../errors/common-errors.mjs";

/** 
 * Converts string to kebab case
 * 
 * @param {string} string 
 * @returns {string}
 */
export function toSafeKebab(string) {
    return string
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/** 
 * Converts string from kebab case 
 * 
 * @param {string} string
 * @returns {string}
 */
export function fromSafeKebab(string) {
    return string
        .split("-")
        .filter(Boolean)
        .map(toCapitalized)
        .join(" ");
}

/**
 * 
 * @param {string} word 
 * @returns 
 */
export function toCapitalized(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * @param {string} string - String to normalize
 * @returns {string} normalized string
 */
export function toNormalized(string) {
    return string
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();
}

/**
 * 
 * @param {string} s 
 * @returns {string}
 */
export function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @type {Record<string,string>} */
const escapes = {
    ['&']: '&amp;',
    ['<']: '&lt;',
    ['>']: '&gt;',
    ['"']: '&quot;',
    ["'"]: '&#39;',
};

const matcher = new RegExp(
    Object.keys(escapes)
        .map(k => escapeRegExp(k))
        .join('|'), 'g'
);

/**
 * 
 * @param {string} o 
 * @returns 
 */
export function escapeHtml(o) {
    return o.replace(matcher, (matched) => {
        const matching =   escapes[matched];
        if(matching) return matching;
        throw new IllegalStateError('')
    });
}

/**
 * Extracts a portion of string between two provided substrings
 * @param {string} str - The entire string to extract from
 * @param {string} start - String to start the extraction from
 * @param {string} end - String to end the extraction at
 * @returns {string|null} the extracted string or `null`
 */
export function extractBetween(	str,   	start,   	end) {
	const regex = new RegExp(`${escapeRegExp(start)}([^\\s]+?)${escapeRegExp(end)}`);
   	const match = str.match(regex);
   	return match && (match[1] ?? '');
}

/**
 * Formats an array of values into a CSV and swaps the last comma with an "and"
 * @param {string[]} joiners - Array of strings to join into a comma separated list
 * @param {string} [and] - (optional) Swapped in place of last comma   
 * Defaults to `"and"`
 * @returns {string} formatted list
 */
export function formatList(joiners, and) {
    return joiners.join(', ').replace(/, ([^,]+)$/g, ` ${and} $1`);
}

/**
 * @param {string[]} list - list of strings among which to find duplicates.
 * @returns {Set<string>} a set containing all duplicate strings from the list.
 */
export function duplicatesOfStringList(list) {
    /** @type {Set<string>} */
    const buffer = new Set();
    /** @type {Set<string>} */
    const duplicates = new Set();
    list.forEach(str => {
        if (buffer.has(str)) duplicates.add(str)
        else buffer.add(str);
    });
    return duplicates;
}

const queryParser = /^(?<key>\w[\w_.~-]*?)=(?<value>\w[\w_.~-]*?)$/
/** 
 * Parses a query string and returns a map of all of its pairs. 
 * 
 * @param {string} string 
 * @returns {Map<string,string>}
 */
export function parseQueryString(string) {
    const entries = string.split('&');
    if (entries.length < 1)
        throw new IllegalArgumentError(string + " is not a valid query string");

    /** @type {Map<string,string>} */
    const result = new Map();
    entries.forEach(entry => {
        const { key, value } = entry.match(queryParser)?.groups ?? {};
        if (key && value)
            result.set(key, value);
        else throw new IllegalArgumentError(`Invalid query field no.${result.size} in ${string}`);
    });
    return result;
}
/** 
 * Recursively sorts any object key within the passed data structure. 
 * 
 * @param {unknown} value 
 * @returns {unknown}
 */
function sortKeysDeep(value) {
    if (Array.isArray(value)) {
        return value.map(sortKeysDeep);
    }
    /** @type Record<string,unknown> */
    const start = {};
    if (value !== null && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                acc[key] = sortKeysDeep(
                    /** @type {Record<string,unknown>} */(value)[key]
                );
                return acc;
            }, start);
    }
    return value;
}
/**
 * Converts a JavaScript value to a JavaScript Object Notation (JSON) string 
 * with any object key within the passed data structure sorted recursively by name.
 * 
 * @param {unknown} obj
 * @returns {string} 
 */
export function stableStringify(obj) {
    return JSON.stringify(sortKeysDeep(obj));
}

/**
 * 
 * @param {object} a 
 * @param {object} b 
 * @returns 
 */
export function deepEquals(a, b) {
    return stableStringify(a) === stableStringify(b);
}