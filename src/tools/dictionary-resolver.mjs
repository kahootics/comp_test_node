//@ ts-check
import { IllegalArgumentError, IllegalStateError } from "../errors/common-errors.mjs";
import { escapeRegExp, fromCamelToKebab, toSafeKebab } from "./string-parsers.mjs";

/**
 * @typedef {object} DictionaryResolverOptions
 * @prop {string} keyPrefix
 * @prop {string} keySuffix
 * @prop {boolean} keysToKebab Converts all keys from camel case to kebab keys (only the keys, prefix and suffix are not converted)
 * @prop {string} valuePrefix
 * @prop {string} valueSuffix
*/

/**
 * 
 * @param {string} prefix 
 * @param {{ [key: string]: string }} dictionary 
 * @param {Partial<DictionaryResolverOptions>} options 
 * @returns {(text: string) => string}
 */
export function dictionayResolver(
    prefix, dictionary, options = {},
) {
    prefix = prefix.trim();

    const {
        keySuffix = '',
        keysToKebab = false,
        valuePrefix = '',
        valueSuffix = ''
    } = options

    /** @type {Map<string, string>} */
    const resolverMap = new Map();
    for (const [key, value] of Object.entries(dictionary)) {
        resolverMap.set(
            prefix + (keysToKebab ? fromCamelToKebab(key) : key) + keySuffix,
            valuePrefix + value + valueSuffix
        );
    }

    if (resolverMap.size === 0) {
        throw new IllegalArgumentError(`Cannot use empty dictionary for substitutions`);
    }

    const keysExp = [...resolverMap.keys()]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|");

    const regex = new RegExp(`(?<!\\w)(?:${keysExp})(?!\\w)`, "g");

    /**
     * 
     * @param {string} match 
     * @returns {string}
     */
    function _replacer(match) {
        const matched = resolverMap.get(match);
        if (matched === undefined)
            throw new IllegalStateError(`Cannot replace ${match} for it was not in the original dictionary: ${JSON.stringify(Array.from(resolverMap))}`);
        return matched;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    return function resolve(text) {
        return text.replaceAll(regex, _replacer);
    };
}