

import { parse } from 'csv-parse/sync';
import normalizeCellValue from './normalize-cell-value.js';
import fetchSheetAsCSV from './fetch-sheet-as-csv.js';
import normalizeCellArray from './normalize-cell-array.js';


export default async function fetchSheetDataset(sheetId: string, sheetGID: string | number, newLineReplacer?: string, arraySeparator?: string) {

    const csv = await fetchSheetAsCSV(sheetId, `${sheetGID}`);

    const records: { [key: string]: string }[] = parse(csv, {
        columns: true,
        skip_empty_lines: false,
    });

    const data = records.map((record) => {
        /* Iterate through each record (object made like: "key1_key2_key3": "value" ) */
        const dataPiece: { [key: string]: any } = {};

        for(let [key, value] of Object.entries(record)) {

            const unpackedKeys = key.split('_');
            let current = dataPiece;

            unpackedKeys.forEach((splitKey, i) => {

                let isLast = (i + 1) === unpackedKeys.length;

                if(isLast) {
                    
                    if(splitKey.endsWith('[]')) {
                        current[splitKey.replaceAll('[]', '')] = normalizeCellArray(value, arraySeparator, newLineReplacer);
                    } else {
                        current[splitKey] = normalizeCellValue(value, newLineReplacer);
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
