import { ValidationError } from "../../../../errors/common-errors.mjs";

/**
 * Validate any amount of strings to be a symbol
 * @param strings - Rest parameter that accepts any number of strings to validate
 * @throws {ValidationError} If any of the provided strings is not valid
 */
export function validateSymbolStrings(...strings: string[]) {
    const invalid: Set<string> = new Set();
    strings.forEach(str => {
        if (!(str.length < 4 && /^[^a-zA-Z0-9]+$/.test(str)))
            invalid.add(str);
    });
    if (invalid.size === 1)
        throw new ValidationError(`${[...invalid][0]} does not represent a valid string symbol`);
    if (invalid.size > 1)
        throw new ValidationError(`${[...invalid].join(', ').replace(/, ([^,]+)$/g, ' and ')} do not represent valid string symbols`);
}
