
import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import z from 'zod';
import { Log } from '../../../tools/console.js';
import { HeadersSchema } from './headers-schema.js';
import { CsvOptionalSymbols } from './csv-optional-symbols.js';
import type { OptionalStringSymbols } from './headers-types.js';
import type { PathLike } from 'node:fs';

/**
 * Asynchronous generator function that parses a CSV file and returns the parsed records one by one.
 * 
 * @param csvPath - Path to a csv text file file to parse.
 * @param csvOptions - Optional fields to use during parsing; see {@link CsvOptionalSymbols} for details.
 * @yields a fully parsed record extracted from the csv.
 */
export async function* csvStreamParser(
    csvPath: PathLike,
    csvOptions?: OptionalStringSymbols
) {
    let schema: HeadersSchema | undefined;
    const options = CsvOptionalSymbols.of(csvOptions);
    // Build stream    
    const parser = createReadStream(csvPath, 'utf-8').pipe(
        parse({
            delimiter: options.csvDelimiter,
            columns: false,
            skip_empty_lines: true,
            trim: true
        })
    );

    let i: number = 0;
    // Parse row by row
    for await (const rawRow of parser) {
        // Row type parsing (safe measure)
        const res = z.array(z.string()).safeParse(rawRow);
        if (!res.success) {
            Log.err(res.error, `at row ${i}`);
            continue;
        }
        const row = res.data;

        // Ensure schema is available
        if (!schema) {
            schema = await HeadersSchema.from(row, options);
            i++;
            continue;
        }

        try {
            const result = schema.parse(row);
            if (result) yield result;
        } catch (e) {
            if (e instanceof Error) {
                e.message = `(at row number ${i} or previous) ` + e.message;
            }
            throw e;
        } finally {
            i++; // Increase row count
        }
        
    } if (schema) {
        try {
            const result = schema.flush();
            if (result) yield result;
        } catch (e) {
            if (e instanceof Error) {
                e.message = `(at row number ${i}) ` + e.message;
            }
            throw e;
        }
    }
}
