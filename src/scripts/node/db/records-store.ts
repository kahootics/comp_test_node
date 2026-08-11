import { IllegalArgumentError, NotFoundError, ValidationError } from "../../../errors/common-errors.mjs";
import { deepEquals } from "../../../tools/string-parsers.js";
import type { dbRecordsStore } from "./data-base.js";
import { type dbRecord, DBRecord } from "./record.js";

export class DBRecordsStore {
    readonly #records: Map<dbRecord['inv'], DBRecord>;
    readonly #id: dbRecordsStore['id'];
    readonly #type: dbRecordsStore['type'];
    #allVersions: Set<dbRecord['versions'][number]> | null = null;

    /** A symbol to identify the store from the record's interface. */
    readonly #symbolIdentifier: symbol;

    get id(): string { return this.#id; };
    get type() { return this.#type; };

    /** All the versions for which a record is available in the store. */
    get allVersions(): Set<dbRecord['versions'][number]> {
        if (this.#allVersions) return this.#allVersions;
        const result = new Set<dbRecord['versions'][number]>();
        for (const [, record] of this.#records) {
            record.versions.forEach(ver => result.add(ver));
        }
        return this.#allVersions = result;
    }

    /**
     * Retrieves a specific record from the store with a given 'inv'.
     * 
     * @param inv - Store specific identificative for a record.
     * @returns the record with the specified `inv` from the store.
     * 
     * @throws {NotFoundError} If no record with the given `inv` was found.
     */
    getRecordByInv(inv: dbRecord['inv']): DBRecord {
        if (!this.#records.has(inv))
            throw new NotFoundError(inv, { type: 'record with invariant' });
        return this.#records.get(inv)!;
    }
    /**
     * Retrieves a specific record from the store based on the specified version.
     * 
     * @param ver - Version for the requested record.
     * @returns the record with the specified `inv` from the store.
     * 
     * @throws {NotFoundError} If no record with the given version was found.
     */
    getRecordByVersion(ver: string): DBRecord {
        for (const [, record] of this.#records) {
            if (record.versions.includes(ver)) return record;
        }
        throw new NotFoundError(ver, { type: 'record with version' });
    }

    constructor(store: dbRecordsStore) {
        this.#id = store.id;
        this.#type = store.type;
        this.#symbolIdentifier = Symbol(this.#id);
        this.#records = new Map(store.records.map(r => [r.inv, new DBRecord(r, this.#symbolIdentifier)]));
        this.#validateRecordsVersions();
    }

    /**
     * Ensures that the records in a store don't have overelapping versions,
     * which would cause a duplicate index to be created in a view.
     */
    #validateRecordsVersions() {
        const versions = new Set<string>();
        this.#records.forEach(record => {
            record.versions.forEach(vers => {
                if (versions.has(vers))
                    throw new ValidationError(`Records store with id ${this.id} in db ${this.type} has records with duplicate version ${vers}`);
                versions.add(vers);
            });
        })
    }

    /**
     * Adds a new record to the store.
     * 
     * @param newData - Readonly data that defines the record.
     * @param newVersion - Version value of the new record.
     * @param defaultEditables - default values for the editable fields.
     * @returns an object with the inv identificative of the new record in the store and a boolean indicating if the data in the record was unique in the store.
     * 
     * @throws {IllegalArgumentError} If a record with the same version as the new one is already present in the store.
     */
    addRecord(
        newData: dbRecord['data'],
        newVersion: dbRecord['versions'][number],
        defaultEditables: dbRecord['editables']
    ): { new: boolean, inv: dbRecord['inv'] } {
        // Duplicate versions are not allowed
        if (this.allVersions.has(newVersion))
            throw new IllegalArgumentError(`Record store ${this.#id} of db ${this.#type} already has a registered record for version ${newVersion}`);
        // Invalidate allVersions list
        this.#allVersions = null;

        // If the record holds the same data as another,
        // then its version will be added to that record's
        // versions list
        for (const [, record] of this.#records) {
            if (deepEquals(record.data, newData)) {
                if (!record.versions.includes(newVersion)) {
                    record.addVersion(newVersion,this.#symbolIdentifier);
                }
                return { new: false, inv: record.inv };
            }
        }

        // If the record is new, add a new entry 
        // with a unique inv
        const newInv = this.#newUniqueInv();
        const newRecord = new DBRecord({
            inv: newInv,
            versions: [newVersion],
            data: newData,
            editables: defaultEditables,
        }, this.#symbolIdentifier);
        this.#records.set(newInv, newRecord);
        return { new: true, inv: newInv };
    }

    /**
     * @returns a three alphanumeric characters sequence unique among the other `inv`
     */
    #newUniqueInv(): string {
        let inv: string;
        do {
            inv = _randomAlNum(3);
        } while (this.#records.has(inv));
        return inv;
    }


    toJSON(): dbRecordsStore {
        return {
            id: this.#id,
            type: this.#type, 
            records: Array.from(this.#records.values())
        }
    }


}


const ALPHANUMERICS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function _randomAlNum(quantity?: number): string {
    const targetLength = Math.floor(Math.abs(quantity ?? 1));
    let result = '';
    while (result.length < targetLength) {
        const i = Math.floor(Math.random() * ALPHANUMERICS.length);;
        result += ALPHANUMERICS.charAt(i);
    }
    return result;
}
