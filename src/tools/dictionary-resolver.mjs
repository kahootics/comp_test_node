//@ ts-check
import { IllegalArgumentError, IllegalStateError } from "../errors/common-errors.mjs";
import { escapeRegExp } from "./string-parsers.mjs";

/**
 * 
 * @param {string} prefix 
 * @param {{ [key: string]: string }} dictionary 
 * @returns {(text: string) => string}
 */
export function dictionayResolver(
    prefix,     dictionary
) {
    prefix = prefix.trim();

    /** @type {Map<string, string>} */
    const resolverMap = new Map();
    for (const [key, value] of Object.entries(dictionary)) {
        resolverMap.set(prefix + key, value); // chiave NON escapata
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
        if (!matched)
            throw new IllegalStateError(`Cannot replace ${match} for it was not in the original dictionary`);
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