
import { parse } from 'csv-parse';
import { ValidationError } from '../../../errors/common-errors.mjs';
import { writeFile } from 'node:fs/promises';
import { createReadStream, type PathLike } from 'node:fs';
import z from 'zod';
import { Log } from '../../../tools/console.js';

export interface OptionalStringSymbols {
    newLineReplacer?: string,
    arraySeparator?: string,
    arrayIndicator?: string,
    objectNotation?: string,
    nestedObjArray?: string,
}
/**
 * Validate any amount of strings to be a symbol
 * @param strings - Rest parameter that accepts any number of strings to validate
 * @throws {ValidationError} If any of the provided strings is not valid
 */
function validateSymbolStrings(...strings: string[]) {
    const invalid: Set<string> = new Set();
    strings.forEach(str => {
        if (!(str.length < 4 && /^[^a-zA-Z0-9]+$/.test(str)))
            invalid.add(str);
    })
    if (invalid.size === 1)
        throw new ValidationError(`${[...invalid][0]} does not represent a valid string symbol`);
    if (invalid.size > 1)
        throw new ValidationError(`${[...invalid].join(', ').replace(/, ([^,]+)$/g, ' and ')} do not represent valid string symbols`);
}
/* 
function parseHeaderSchema(headers: string[]) {
  const idx = headers.findIndex(h => /\[i\]$/.test(h));
  if (idx === -1) return { fields: headers, array: null };

  const fields = headers.slice(0, idx);
  const arrayName = headers[idx]?.replace(/\[i\]$/, '');
  const itemSchema = parseHeaderSchema(headers.slice(idx + 1));

  return { fields, array: { name: arrayName, columnIndex: idx, itemSchema } };
}

function insertRow(targetArray, schema, row, prevRow) {
  const scalarValues = schema.fields.map((_, i) => row[i]);
  const prevScalarValues = prevRow ? schema.fields.map((_, i) => prevRow[i]) : null;
  const sameAsLast = !!prevRow && scalarValues.every((v, i) => v === prevScalarValues[i]);

  let obj;
  if (sameAsLast && targetArray.length > 0) {
    obj = targetArray[targetArray.length - 1]; // continua l'oggetto precedente
  } else {
    obj = {};
    schema.fields.forEach((f, i) => { obj[f] = coerce(row[i]); });
    if (schema.array) obj[schema.array.name] = [];
    targetArray.push(obj);
  }

  if (schema.array) {
    const idxVal = Number(row[schema.array.columnIndex]);
    if (idxVal === -1) return; // sentinella: array resta vuoto

    const itemRow = row.slice(schema.array.columnIndex + 1);
    const prevItemRow = sameAsLast && prevRow ? prevRow.slice(schema.array.columnIndex + 1) : null;
    insertRow(obj[schema.array.name], schema.array.itemSchema, itemRow, prevItemRow);
  }
}
 */
async function csvToDataset(
    csvPath: PathLike,
    csvOptional?: OptionalStringSymbols
) {

    // Validate all optional parameters
    const arraySeparator = csvOptional?.arraySeparator ?? '|';
    const arrayIndicator = csvOptional?.arrayIndicator ?? '[]';
    const objectNotation = csvOptional?.objectNotation ?? '_';
    const nestedObjArray = csvOptional?.nestedObjArray ?? '[i]';
    validateSymbolStrings(arraySeparator, arrayIndicator, objectNotation, csvOptional?.newLineReplacer ?? '#');

    // Build stream    
    const parser = createReadStream(csvPath, 'utf-8').pipe(
        parse({ columns: false, skip_empty_lines: true, trim: true })
    );

    // Parse row by row
    for await (const rawRow of parser) {
        const res = z.array(z.string()).safeParse(rawRow);
        if(!res.success) {
            Log.err(res.error);
            continue;
        }
        const row = res.data;

        
    }
}