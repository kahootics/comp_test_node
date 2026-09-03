import z from "zod";
import { IllegalAccessError, IllegalArgumentError } from "../../../errors/common-errors.mjs";
import type { editableSchema } from "./editable-field.js";
import type { dbRecord } from "./data-base.js";


/**
 * 
 * This class only allows acces to clones of the original data, so that no inproper edit is transmitted to the database.
 */
export class DBRecord implements dbRecord {
    readonly #inv: dbRecord['inv'];
    readonly #versions: dbRecord['versions'];
    readonly #data: dbRecord['data'];
    readonly #editables: dbRecord['editables'];

    readonly #accessToken: symbol;


    get inv() { return this.#inv; }
    get data() { return this.#data; }
    get versions() { return Array.from(this.#versions) }
    get editables() { return structuredClone(this.#editables); }

    constructor(record: dbRecord, accessToken: symbol) {
        this.#accessToken = accessToken;
        this.#inv = record.inv;
        this.#versions = record.versions;
        // A clone for safety
        this.#data = Object.freeze(structuredClone(record.data));
        // original
        this.#editables = structuredClone(record.editables);

    }

    addVersion(ver: string, accessToken: symbol) {
        if (this.#accessToken !== accessToken)
            throw new IllegalAccessError("Only the record store can add versions to a record");
        if (this.#versions.includes(ver))
            throw new IllegalArgumentError(`Duplicate version ${ver} for record ${this.#inv}`);
        this.#versions.push(ver);
    }

    /**
     * Saves edits made to an *editable* field.
     * 
     * @param delta
     * @param schema
     * @returns
     */
    saveEdits(
        delta: Partial<dbRecord['editables']>,
        editablesSchemas: { [label: string]: editableSchema; }
    ): { ok: true; } | { ok: false; error: string; } {
        const safeSchema = z.object(editablesSchemas).partial();
        const result = safeSchema.safeParse(delta);
        if (!result.success) {
            return { ok: false, error: result.error.message };
        }
        Object.assign(this.#editables, result.data);
        return { ok: true };
    }

    toJSON(): dbRecord {
        return {
            inv: this.#inv,
            versions: this.versions,
            data: this.data,
            editables: this.#editables
        };
    }
}

