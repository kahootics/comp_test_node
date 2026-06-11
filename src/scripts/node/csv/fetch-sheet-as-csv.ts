
/**
 * Function that fetches a Google Spreadsheet sheet in csv format
 * @param sheetId - the speadsheet id (the string after "/d/" to the next "/" in the URI)
 * @param sheetGID - the sheet gid (the string in the parameter "gid" in the URI)
 * @returns a string representing the sheet in .csv format
 * @throws an error if fetching operation fails
 */
export default async function fetchSheetAsCSV(sheetId:string, sheetGID: string) {

    const URL = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGID}`;
    const res = await fetch(URL);

    if (!res.ok) {
        throw new Error(`Spreadsheet fetch at"${URL}" failed: ${res.status}`);
    }

    return res.text()
}