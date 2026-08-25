
import type { CsvOptionalSymbols } from "../csv-optional-symbols.js";
import { isNull } from "./is-null.js";
import normalizeCellValue from "./normalize-cell-value.js";

/**
 * Splits a string into an array of normalized values
 * @param array - A string representing an array of elements separated by the `separator` parameter
 * @param options.arraySeparator - A symbol used to separate the elements of the string array
 * @param options.newLineReplacer - (optional) Symbol replaced with `\n` in the output.
 * If omitted, no replacement is performed.
 * @returns an array containing the elements of the string array
 */
export default function normalizeCellArray(array: string, options: CsvOptionalSymbols) {

    if (isNull(array)) return null;

    return array.split(options.arraySeparator).map(value => normalizeCellValue(value, options));

}