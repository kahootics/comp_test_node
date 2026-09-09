import { IllegalArgumentError } from "../../../../errors/common-errors.mjs";
import { formatList } from "../../../../tools/string-parsers.js";
import type { dbRecord, dbRecordInv, dbRecordVersions, dbStoreId, dbType } from "../data-base-types.d.js";

export class FlatRecord<T extends dbType> {

    readonly #baseRecord: dbRecord<T>;
    readonly #storeId: dbStoreId;
    readonly #type: T;
    readonly #versions: dbRecordVersions;

    readonly #id: string;

    get id(): string { return this.#id; }
    get type() { return this.#type; }
    get storeId() { return this.#storeId; }
    get inv() { return this.#baseRecord.inv; }
    get versions() { return this.#versions; } 
    get data() { return this.#baseRecord.data; }
    get editables() { return this.#baseRecord.editables; }

    constructor(
        storeId: dbStoreId,
        dbType: T,
        baseRecord: dbRecord<T>,
        versions?: string[]
    ) {
        this.#baseRecord = baseRecord;
        this.#storeId = storeId;
        this.#type = dbType;
        this.#id = [dbType, this.#baseRecord.inv, storeId].join('-');

        if (versions) {
            const unsupported = versions.filter(v => !this.supportsVersion(v));
            if (unsupported.length > 0)
                throw new IllegalArgumentError(`Versions ${formatList(unsupported)
                    } are not supported by record ${this.#type}-${this.#storeId}-${this.inv}`);
            this.#versions = versions;

        } else this.#versions = this.#baseRecord.versions
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
            inv: dbRecordInv,
            type: T,
            versions: string[]
        } & typeof this.data & typeof this.editables;
    }

    public supportsVersion(version: string): boolean {
        return this.#baseRecord.versions.includes(version);
    }

    public extractVersions(...versions: string[]) {
        const t = new FlatRecord(this.#storeId, this.#type, this.#baseRecord, versions);
    }

}


