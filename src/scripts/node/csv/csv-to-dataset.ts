

import { CsvError, parse,  } from 'csv-parse/sync';
import normalizeCellValue from './normalize-cell-value.js';
import normalizeCellArray from './normalize-cell-array.js';
import { ValidationError } from '../../../errors/common-errors.mjs';

export interface OptionalStringSymbols {
    newLineReplacer?: string, 
    arraySeparator?: string,
    arrayIndicator?: string,
    objectNotation?: string
}
/**
 * Validate any amount of strings to be a symbol
 * @param strings - Rest parameter that accepts any number of strings to validate
 * @throws {ValidationError} If any of the provided strings is not valid
 */
function validateSymbolStrings(...strings: string[]) {
    const invalid: Set<string> = new Set();
    strings.forEach(str => {
        if(!(str.length < 4 && /^[^a-zA-Z0-9]+$/.test(str)))
            invalid.add(str);
    })   
    if(invalid.size === 1) 
        throw new ValidationError(`${[...invalid][0]} does not represent a valid string symbol`);
    if(invalid.size > 1)
        throw new ValidationError(`${[...invalid].join(', ').replace(/, ([^,]+)$/g, ' and ')} do not represent valid string symbols`);
}
/**
 * Parses a CSV string into a JavaScript array of objects.
 * 
 * @param csv - CSV string to parse
 * @param csvOptional - (optional) Parsing configuration
 * @param csvOptional.newLineReplacer - Symbol replaced with `\n` in the output.
 * If omitted, no replacement is performed.
 * @param csvOptional.arraySeparator - Symbol used to split a cell into an array.
 * Defaults to `"|"`.
 * @param csvOptional.arrayIndicator - Symbol that marks a header as an array.
 * Defaults to `"[]"`.
 * @param csvOptional.objectNotation - Symbol used to build nested objects from flat keys.
 * Defaults to `"_"`.
 * @returns an array of objects obtained from the CSV
 * 
 * @remarks
 * New lines may not be preserved through Google Sheets —
 * it is recommended to use a placeholder symbol in the sheet
 * and pass it as `newLineReplacer`.
 * 
 * Valid symbols must be **shorter than 4 characters** and contain **only non-alphanumeric characters**.
 * 
 * @throws {ValidationError} If any provided symbol fails validation
 * @throws {CsvError} if provided csv is not parseable according to expected format
 * 
 * @example
 * ```ts
 * const data = await csvIntoDataset(csv, {
 *     newLineReplacer: '\\',
 *     arraySeparator: '|',
 *     arrayIndicator: '[]',
 *     objectNotation: '_'
 * });
 * ```
 * @example
 * - **object**: 
 * ```js
 * {
 *    image_name: "name",
 *    image_src: "https://bah.png"
 * }
 * ``` 
 * - *becomes* 
 * ```js
 * {
 *    image: {
 *        name: "name",
 *        src: "https://bah.png"
 *    }
 * }
 * ```
 * @example
 * ```md
 * image_name | image_srcset[]
 *  --------- | --------------
 *  sunset    | "https://sunset.png"|"https://sunset.720p.png"
 *  dawn      | 
 * ```
 * Results in
 * ```js
 * [
 *   {
 *    image: {
 *        name: "sunset",
 *        srcset: [ 
 *            "https://sunset.png", 
 *            "https://sunset.720p.png" 
 *        ]
 *    }
 *   },
 *   {
 *    image: {
 *        name: "dawn",
 *        srcset: null
 *    }
 *   }
 * ]
 * ```
 */
export async function csvIntoDataset(
    csv: string, 
    csvOptional?: OptionalStringSymbols
) {
    // Validate all optional parameters
    const arraySeparator = csvOptional?.arraySeparator ?? '|';
    const arrayIndicator = csvOptional?.arrayIndicator ?? '[]';
    const objectNotation = csvOptional?.objectNotation ?? '_';
    validateSymbolStrings(arraySeparator, arrayIndicator, objectNotation, csvOptional?.newLineReplacer ?? '#');

    // First line of CSV represents column headers
    // Parse csv into array of { correspondingColumnHeader: value }
    const records: { [key: string]: string }[] = parse(csv, {
        columns: true,
        skip_empty_lines: false,
    });

    const data = records.map((record) => {

        const dataPiece: { [key: string]: any } = {};

        for(let [key, value] of Object.entries(record)) {

            const unpackedKeys = key.split(objectNotation);
            let current = dataPiece;

            unpackedKeys.forEach((splitKey, i) => {

                let isLast = (i + 1) === unpackedKeys.length;

                if(isLast) {
                    
                    if(splitKey.endsWith(arrayIndicator)) {
                        current[splitKey.replaceAll(arrayIndicator, '')] = normalizeCellArray(value, arraySeparator, csvOptional?.newLineReplacer);
                    } else {
                        current[splitKey] = normalizeCellValue(value, csvOptional?.newLineReplacer);
                    }
                    
                } else {
                    current[splitKey] ??= {};
                    current = current[splitKey];
                }

            });
        }
        return dataPiece;
    });

    return data;
    
}

