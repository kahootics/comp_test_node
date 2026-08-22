
import type { Brand } from '../../types/general-types.js';
import type normalizeCellArray from './helpers/normalize-cell-array.ts';
import type normalizeCellValue from './helpers/normalize-cell-value.ts';

// Effects[i],Effects[i]_Name

export interface OptionalStringSymbols {
    newLineReplacer?: string,
    arraySeparator?: string,
    arrayIndicator?: string,
    objectNotation?: string,
    nestedObjArray?: string,
}

export interface HeaderTypes {
    flat: Brand<string, 'flat'>;
    index: Brand<string, 'index'>;
    nested: Brand<string, 'nested'>;
}
export interface ValueTypes {
    flat: ReturnType<typeof normalizeCellValue>;
    array: ReturnType<typeof normalizeCellArray>;
}
export type HeaderKeys = HeaderTypes[keyof HeaderTypes][];


