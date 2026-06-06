import normalizeCellValue from "./normalize-cell-value.js";

export default function normalizeCellArray(array: string, separator?: string, newLineReplacer?: string): any[] | null {

    if(array.length <= 3 || array === 'null') return null;

    return array.split((separator ? separator : '|')).map( value => normalizeCellValue(value, newLineReplacer) );
    
}