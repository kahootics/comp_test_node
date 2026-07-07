import fetchSheetAsCSV from './fetch-sheet-as-csv.js';
import { type OptionalStringSymbols, csvIntoDataset } from './csv-to-dataset.js';

/**
 * @param sheetId - Id of online public spreadsheet
 * @param sheetGID - GId of the sheet
 * @param csvOptions - (optional) Parsing configuration
 * @param csvOptions.newLineReplacer - Symbol replaced with `\n` in the output.
 * If omitted, no replacement is performed.
 * @param csvOptions.arraySeparator - Symbol used to split a cell into an array.
 * Defaults to `"|"`.
 * @param csvOptions.arrayIndicator - Symbol that marks a header as an array.
 * Defaults to `"[]"`.
 * @param csvOptions.objectNotation - Symbol used to build nested objects from flat keys.
 * Defaults to `"_"`.
 * @returns an array of objects obtained from the fetched CSV
 */

export default async function fetchSheetDataset(
    sheetId: string,
    sheetGID: string | number,
    csvOptions?: OptionalStringSymbols
) {
    const csv = await fetchSheetAsCSV(sheetId, `${sheetGID}`);
    return csvIntoDataset(csv, csvOptions);
}
