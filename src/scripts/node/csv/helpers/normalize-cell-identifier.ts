import { ValidationError } from "../../../../errors/common-errors.mjs";
import type { CsvOptionalSymbols } from "../csv-optional-symbols.js";
import { isNull } from "./is-null.js";

/**
 * Normalizes a CSV value element into corresponding JS types
 * @param value - Cell content to normalize
 * @param newLineReplacer - (optional) Symbol replaced with `\n` in the output.
 * If omitted, no replacement is performed.
 * @returns normalized content inputted
 */
export default function normalizeCellIdentifier(value: string, options: CsvOptionalSymbols) {

    if (isNull(value)) return null;
    if (value === 'TRUE') throw new ValidationError(`An identifier cannot be a boolean`);
    if (value === 'FALSE') throw new ValidationError(`An identifier cannot be a boolean`);
    if(options.newLineReplacer && value.includes(options.newLineReplacer)) 
        throw new ValidationError(`An identifier cannot include a newline marker: ${value}`);
    return (value.trim());
}
