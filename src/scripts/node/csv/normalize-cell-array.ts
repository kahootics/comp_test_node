
import normalizeCellValue from "./normalize-cell-value.js";

/**
 * Splits a string into an array of normalized values
 * @param array - A string representing an array of elements separated by the `separator` parameter
 * @param separator - A symbol used to separate the elements of the string array
 * @param newLineReplacer - (optional) Symbol replaced with `\n` in the output.
 * If omitted, no replacement is performed.
 * @returns an array containing the elements of the string array
 */
export default function normalizeCellArray(array: string, separator: string, newLineReplacer?: string): any[] | null {

    if(array.length <= 2 || array === 'null') return null;

    return array.split(separator).map( value => normalizeCellValue(value, newLineReplacer) );
    
}