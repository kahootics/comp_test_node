
export default async function fetchSheetAsCSV(sheetId:string, sheetGID: string) {

    const URL = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGID}`;
    const res = await fetch(URL);

    if (!res.ok) {
        throw new Error(`Spreadsheet fetch at"${URL}" failed: ${res.status}`);
    }

    return res.text()
}