import type { dbRecord, dbRecordsStore, dbType } from "../data-base.js";
import type { DBRecord } from "../record.js";


export class FlatRecord {

    readonly #baseRecord: DBRecord;
    readonly #storeId: dbRecordsStore['id'];
    readonly #type: dbRecordsStore['type'];

    readonly #id: string;

    get id(): string { return this.#id; }
    get type() { return this.#type; }
    get storeId() { return this.#storeId; }
    get inv() { return this.#baseRecord.inv; }
    get versions() { return this.#baseRecord.versions; }
    get data() { return this.#baseRecord.data; }
    get editables() { return this.#baseRecord.editables; }

    constructor(
        storeId: dbRecordsStore['id'],
        dbType: dbType,
        baseRecord: DBRecord
    ) {
        this.#baseRecord = baseRecord;
        this.#storeId = storeId;
        this.#type = dbType;
        this.#id = [dbType, this.#baseRecord.inv, storeId].join('-');
    }

    public toJSON() {
        const result = {
            id: this.id,
            inv: this.#baseRecord.inv,
            type: this.type,
            versions: this.versions,
        }
        Object.assign(result, this.data, this.editables);
        return result as {
            id: string,
            inv: dbRecord['inv'],
            type: dbType,
            versions: string[]
        } & typeof this.data & typeof this.editables;
    }

    public supportsVersion(version: string): boolean {
        return this.#baseRecord.versions.includes(version);
    }
}