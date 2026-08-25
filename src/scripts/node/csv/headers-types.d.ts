
import type { Brand } from '../../types/general-types.js';
import type normalizeCellArray from './helpers/normalize-cell-array.ts';
import type normalizeCellIdentifier from './helpers/normalize-cell-identifier.ts';
import type normalizeCellValue from './helpers/normalize-cell-value.ts';

export interface OptionalStringSymbols {
    csvDelimiter?: string,
    newLineReplacer?: string,
    arraySeparator?: string,
    arrayIndicator?: string,
    objectNotation?: string,
    nestedObjArray?: string,
    idIndicator?: string
}

export interface HeaderTypes {
    flat: Brand<string, 'flat'>;
    index: Brand<string, 'index'>;
    nested: Brand<string, 'nested'>;
}
export interface ValueTypes {
    flat: ReturnType<typeof normalizeCellValue>;
    array: ReturnType<typeof normalizeCellArray>;
    identifier: ReturnType<typeof normalizeCellIdentifier>
}
export type HeaderKeys = HeaderTypes[keyof HeaderTypes][];
