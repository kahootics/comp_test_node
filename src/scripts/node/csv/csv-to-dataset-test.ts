
import { parse } from 'csv-parse';
import { writeFile } from 'node:fs/promises';
import { createReadStream, type PathLike } from 'node:fs';
import z, { object, string } from 'zod';
import { Log } from '../../../tools/console.js';
import { validateSymbolStrings } from './validate-symbol-strings.js';
import type { Brand } from '../../types/general-types.js';
import { IllegalArgumentError, IllegalStateError, NotFoundError, ValidationError } from '../../../errors/common-errors.mjs';
import normalizeCellArray from './normalize-cell-array.js';
import normalizeCellValue from './normalize-cell-value.js';
import { escapeRegExp, formatList, stableStringify } from '../../../tools/string-parsers.js';

// Effects[i],Effects[i]_

export interface OptionalStringSymbols {
    newLineReplacer?: string,
    arraySeparator?: string,
    arrayIndicator?: string,
    objectNotation?: string,
    nestedObjArray?: string,
}

interface HeaderTypes {
    flat: Brand<string, 'flat'>;
    index: Brand<string, 'index'>;
    nested: Brand<string, 'nested'>;
}
interface ValueTypes {
    flat: string | number | boolean | null;
    array: this['flat'][];
}
function MakeHeaderSchema(
    csvOptional?: OptionalStringSymbols
) {
    // Validate all optional parameters
    const arraySeparator = csvOptional?.arraySeparator ?? '|';
    const arrayIndicator = csvOptional?.arrayIndicator ?? '[]';
    const objectNotation = csvOptional?.objectNotation ?? '_';
    const nestedObjArray = csvOptional?.nestedObjArray ?? '[i]';
    const newLineReplacer = csvOptional?.newLineReplacer;
    validateSymbolStrings(arraySeparator, arrayIndicator, objectNotation, csvOptional?.newLineReplacer ?? '#', nestedObjArray);

    class HeaderEntry {

        readonly keys: HeaderTypes[keyof HeaderTypes][];
        readonly #lastI: number;
        readonly i: number;
        readonly type: keyof HeaderTypes;
        readonly valueType: keyof ValueTypes;
        readonly #flat: string;
        get flat() { return this.#flat; }

        constructor(label: string, index: number) {
            if (!Number.isSafeInteger(index))
                throw new IllegalArgumentError(`An array index must be an integer, but ${index} is not`);
            this.i = index;

            label = label.trim();
            // Chech if it's an array
            if (label.endsWith(arrayIndicator)) {
                label = label.replaceAll(arrayIndicator, '');
                this.valueType = 'array'
            } else this.valueType = 'flat';

            if (label.endsWith(nestedObjArray)) {
                label = label.replaceAll(nestedObjArray, '');
                this.type = 'index';
            } else if (label.includes(nestedObjArray + objectNotation)) {
                label = label.replaceAll(nestedObjArray, '');
                this.type = 'nested';
            } else {
                this.type = 'flat';
            }

            this.#flat = label;
            const unpackedKeys = label.split(new RegExp(`\\s*${escapeRegExp(objectNotation)}\\s*`));
            if (!unpackedKeys[0]?.trim())
                throw new IllegalArgumentError(`${label} has no key for object notation`);

            this.keys = unpackedKeys as HeaderTypes[typeof this.type][];
            this.#lastI = this.keys.length - 1;

        }

        getColumnValue(row: string[]) {
            const value = row[this.i];
            if (!value)
                throw new NotFoundError('value at column ' + this.i);
            return value;
        }

        getLastKey(target: { [key: string]: any }) {
            let current = target;

            return this.keys.find((splitKey, i) => {

                let isLast = (i === this.#lastI);

                if (isLast) {

                    return current[splitKey];

                } else {
                    current[splitKey] ??= {};
                    current = current[splitKey];
                }

            });

        }

        setLastKey(target: { [key: string]: any }, value: any) {
            let current = target;

            this.keys.forEach((splitKey, i) => {

                let isLast = (i === this.#lastI);

                if (isLast) {

                    current[splitKey] = value;

                } else {
                    current[splitKey] ??= {};
                    current = current[splitKey];
                }

            });

        }

        assignValue(target: { [key: string]: any }, value: string) {

            this.setLastKey(
                target,
                this.valueType === 'array'
                    ? normalizeCellArray(value, arraySeparator, newLineReplacer)
                    : normalizeCellValue(value, newLineReplacer));

        }

        getIndex(value: string) {
            const index = Number(value);
            if (!Number.isInteger(index))
                throw new ValidationError(`An index value must be an integer, but ${value} is not`);
            return index;
        }

        isNestedIn(that: HeaderEntry): boolean {
            return that.#flat.includes(this.#flat);
        }
    }

    return class HeadersSchema {
        headers: HeaderEntry[];
        nestedHeaders: Map<HeaderEntry, HeaderEntry[]>;

        indexMaps = new Map<HeaderEntry, Map<string, Record<string, any>[]>>();

        length: number;

        declare objectNotation: string
        declare arrayIndicator: string
        declare arraySeparator: string
        declare newLineReplacer: string

        constructor(rawHeaders: string[]) {
            this.headers = [];
            this.nestedHeaders = new Map();

            this.headers = rawHeaders.map((header, i) => new HeaderEntry(header, i));
            this.length = this.headers.length;

            const orphaned = this.headers
                .filter(header => {
                    const { type } = header;
                    if (type === 'index') {
                        this.nestedHeaders.set(header, []);
                    }
                    else if (type === 'nested') return true;
                    return false;
                })
                .filter(header => {
                    for (const [index, list] of this.nestedHeaders.entries()) {
                        if (header.isNestedIn(index)) {
                            list.push(index)
                            return false;
                        }
                    }
                    return true;
                });

            if (orphaned.length > 0)
                throw new ValidationError(`${formatList(orphaned.map(h => h.flat))} headers are fields of an object nested into an array, but no index header was provided for such array`);

        }

        getHeaderEntry(i: number): HeaderEntry {
            const header = this.headers[i];
            if (!header)
                throw new NotFoundError(String(i), { type: 'header at index' });
            return header
        }

        parse(row: string[]) {
            const result: Record<string, any> = {};

            let nestingI: HeaderEntry | undefined;
            row.forEach((value, i) => {
                const header = this.getHeaderEntry(i);
                switch (header.type) {
                    case 'flat':
                        header.assignValue(result, value);
                        break;
                    case 'index':
                        const index = header.getIndex(value);
                        if (index >= 0) {
                            if (nestingI)
                                throw new IllegalStateError(`Cannot have two indexes to track for nesting arrays`);
                            nestingI = header
                        }
                        break;
                    case 'nested':

                        break;

                    default:
                        throw new Error()
                }
            });

            if (nestingI) {
                let NestedMap = this.indexMaps.get(nestingI);
                if (!NestedMap) {
                    NestedMap = new Map();
                    this.indexMaps.set(nestingI, NestedMap);
                }

                const identifier = stableStringify(result);
                let nestingArr = NestedMap.get(identifier);
                if (!nestingArr) {
                    nestingArr = [];
                    // the map will hold the reference to the array
                    NestedMap.set(identifier, nestingArr);
                    nestingI.setLastKey(result, nestingArr);
                }

                const nestedObj = {};

                nestingArr[nestingI.i] = nestedObj;

            } else return result;
        }


    }
}


async function* csvToDataset(
    csvPath: PathLike,
    csvOptional?: OptionalStringSymbols
) {

    class HeadersSchema extends MakeHeaderSchema(csvOptional) { };

    // Build stream    
    const parser = createReadStream(csvPath, 'utf-8').pipe(
        parse({ columns: false, skip_empty_lines: true, trim: true })
    );

    let schema: HeadersSchema | undefined;
    // Parse row by row
    for await (const rawRow of parser) {
        // Row type parsing (safe measure)
        const res = z.array(z.string()).safeParse(rawRow);
        if (!res.success) {
            Log.err(res.error);
            continue;
        }
        const row = res.data;

        if (!schema) {
            schema = new HeadersSchema(row);
            continue;
        }

        const result = schema.parse(row);
        if (result) yield result;

    }
}

// ==================================

const mockCsv =
`type,formID,editorID,name,keywords[],value,weight,ingredientValue,effects[i],effects[i]_formID,effects[i]_magnitude,effects[i]_area,effects[i]_duration,effects[i]_conditions[i],effects[i]_conditions[i]_logic,effects[i]_conditions[i]_name
INGR,000134AA,Thistle01,Thistle Branch,VendorItemIngredient,1,0.1,23,0,0003EAEB,3,0,60,0,AND,example01
INGR,000134AA,Thistle01,Thistle Branch,VendorItemIngredient,1,0.1,23,0,0003EAEB,3,0,60,1,AND,example02
INGR,000134AA,Thistle01,Thistle Branch,VendorItemIngredient,1,0.1,23,1,00073F23,2,0,10,,,
INGR,000134AA,Thistle01,Thistle Branch,VendorItemIngredient,1,0.1,23,2,00090041,3,0,0,,,
INGR,000134AA,Thistle01,Thistle Branch,VendorItemIngredient,1,0.1,23,3,0003EB1E,2,0,60,,,`

const mockResult = [
    {
        type: 'INGR',
        formID: '000134AA',
        editorID: 'Thistle01',
        name: 'Thistle Branch',
        keywords: ['VendorItemIngredient'],
        value: 1,
        weight: 0.1,
        ingredientValue: 23,
        effects: [
            {
                formID: '0003EAEB',
                magnitude: 3,
                area: 0,
                duration: 60,
                conditions: [
                    {
                        logic: 'AND',
                        name: 'example01'
                    }, {
                        logic: 'AND',
                        name: 'example02'
                    }
                ]
            }, {
                formID: '00073F23',
                magnitude: 2,
                area: 0,
                duration: 10,
                conditions: []
            }, {
                formID: '00090041',
                magnitude: 3,
                area: 0,
                duration: 0,
                conditions: []
            }, {
                formID: '0003EB1E',
                magnitude: 2,
                area: 0,
                duration: 60,
                conditions: []
            }
        ]
    }
]

/* INGR,0001B3BD,Snowberry,Snowberries,VendorItemFood|GiftFlower,4,0.1,38,0,0003EAEA,3,0,60,
INGR,0001B3BD,Snowberry,Snowberries,VendorItemFood|GiftFlower,4,0.1,38,1,0003EB29,1,0,30,
INGR,0001B3BD,Snowberry,Snowberries,VendorItemFood|GiftFlower,4,0.1,38,2,0003EAEB,3,0,60,
INGR,0001B3BD,Snowberry,Snowberries,VendorItemFood|GiftFlower,4,0.1,38,3,0003EAEC,3,0,60,
INGR,0002F44C,Nightshade,Nightshade,VendorItemIngredient,8,0.1,53,0,0003EB42,2,0,1,
INGR,0002F44C,Nightshade,Nightshade,VendorItemIngredient,8,0.1,53,1,00073F2B,100,0,5,
INGR,0002F44C,Nightshade,Nightshade,VendorItemIngredient,8,0.1,53,2,0010DE5E,1,0,10,
INGR,0002F44C,Nightshade,Nightshade,VendorItemIngredient,8,0.1,53,3,0003EB26,4,0,60, */



