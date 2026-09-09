
interface DBRequest {
    kind: 'db';
    type: string;
}
interface ViewRequest {
    kind: 'view';
    name: string;
}
declare const MAIN_TABLE_ID: string;


class DataClient {
    #table: HTMLTableElement;

    constructor(token: symbol, mainTableId: string) {
        const MainTable = document.getElementById(mainTableId)
        if (!(MainTable instanceof HTMLTableElement))
            throw new Error() // tbd
        this.#table = MainTable;
    }

    #takeRowSnapshot(row: HTMLTableRowElement) {
        
    }

    #takeTableSnapshot() {
        const rows = this.#table.querySelectorAll('tr');
        
    }

    #appendSaveButtons() {}

    async loadRecords(source: DBRequest | ViewRequest) {
    const url = source.kind === 'db'
        ? `/db/${source.type}/records`
        : `/view/${source.name}/records`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Errore caricamento: ${res.status}`);
    this.#table.innerHTML = await res.text();
    this.#takeTableSnapshot(); 
}
}