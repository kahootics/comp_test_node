import z from "zod";
import { DuplicateKeyError, IllegalStateError, NotFoundError, ValidationError } from "../../../errors/common-errors.mjs";
import { DBDataInitSchemas } from "./data-base-init.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DBRecordsStore } from "./records-store.js";
import { rename } from "fs/promises";
import { Log } from "../../../tools/console.js";
import { PlainRecord } from "./plain-record.js";
import type { Brand } from "../../types/general-types.js";
import { EditableFieldDescriptor, type editableSchema, type editableType } from "./editable-field.js";
import { createReadStream } from "fs";
import { readLines } from "../../../tools/read-lines.mjs";
import { writeNdjsonPipeline } from "../../../tools/companion-util.js";

// PATH CONSTANTS ================================================================
export const root = 'src/data/db/';
const main = root + 'main/';
const db_suffix = '_db';

// DATABASE TYPE =================================================================

const dbTypeRegEx = /^(?:[A-Z_]{4})$/;
export const dbTypeSchema = z.string().regex(dbTypeRegEx).transform(it => it as dbType);

// PRIVATE HELPERS =====================================================================

function _validateType(type: string): asserts type is dbType {
    if (type.length !== 4)
        throw new ValidationError("A database type must have 4 characters: " + type);
    if (type.toUpperCase() !== type)
        throw new ValidationError("A database type must compose of only upper case characters: " + type);
    if (!type.match(dbTypeRegEx))
        throw new ValidationError("A database type cannot contain special characters: " + type);
}

function _buildEditablesSchema(editables: Iterable<EditableFieldDescriptor>) {
    const result: { [label: string]: editableSchema; } = {};
    for (const editable of editables) {
        result[editable.label] = editable.getSchema();
    }
    return result;
}

const _buildRecordsStoreSchema = (
    type: dbType,
    dataScheme: { [field: string]: z.ZodTypeAny; },
    editablesSchemas: { [key: string]: editableSchema; }
) => z.object({
    // 4 characters to identify the database the record belongs to (case-sensitive!)
    type: z.literal(type),
    // A unique identifier among records in the same db 
    id: z.string().regex(/^(?:[A-Z0-9]{5,6})$/).brand('storeId'),
    // Array of records under the same ID; they differ in version and are therefore separated for contextual use
    records: z.array(z.object({
        // 3 characters to distinguish among records
        inv: z.string().regex(/^(?:[A-Z0-9]{3})$/).brand('inv'),
        // A list of versions the data in this record is compatible for
        versions: z.array(z.string().nonempty()).nonempty(),
        // bundle-dependent data
        data: z.object(/* Static Non-modifiable data goes in here */ dataScheme),
        // bundle-dependent editable data
        editables: z.object(/* Editable data goes in here */ editablesSchemas)
    }))
});
/* ============================= *
 * The combo type + inv + id
 * ensures that every set of data
 * is identifiable by a single string,
 * ============================= */


// TYPES ======================================================================
export type dbType = Brand<string, 'database type'>;

export interface DataBaseInit {
    readonly [type: string]: {
        [field: string]: z.ZodTypeAny;
    }
}
export type dbRecordsStore = z.infer<ReturnType<typeof _buildRecordsStoreSchema>>;
export type dbRecord = dbRecordsStore['records'][number];

// CLASS IMPLEMENTATION ================================================================

export class DataBase {
    // CLASS PRIVACY AND CACHING ===============================================
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    /** Maps each db type to its corresponding database. */
    static readonly #register = new Map<dbType, DataBase>();

    // FINAL PROPERTIES =========================================================
    /** Type of the database (unique). */
    readonly #type: dbType;
    /** Path to the database from the project root. */
    readonly #path: string;
    /** Object containing the `zod` record-data validators. */
    readonly #dataSchema: { [field: string]: z.ZodTypeAny; };
    /** Object listing each editable field, with associated editable type, of the db's records. */
    readonly #editableFields: Map<string, EditableFieldDescriptor>;

    // STATE DESCRIPTORS ========================================================
    readonly #ready: Promise<void> | null = null;
    /** An empty promise; *the database will be accessible only after it's resolved*. */
    get ready(): Promise<void> {
        if (this.#ready) return this.#ready;
        throw new IllegalStateError('Cannot read state of database');
    }

    /** 
     * *Await before starting any writing operation*.   
     * If a writing operation starts, the resulting promise should be 
     * stored here to ensure no concurrent writing operation starts.
     */
    #writePermission: Promise<void> = Promise.resolve();
    /**
     * @param callback - A function that will be called once write permission has fulfilled.
     * @returns an empty promise that should be awaited to ensure completion of the operation.
     */
    async #onWriteAllowed(callback: () => Promise<void>): Promise<void> {
        return this.#writePermission = this.#writePermission.then(callback);
    }

    // INTERNAL DATA ============================================================
    #recordsStores: Map<dbRecordsStore['id'], DBRecordsStore> | null = null;
    /** Database of records stores; only access once `ready` is fulfilled. */
    get recordsStores() {
        if (this.#recordsStores) return this.#recordsStores;
        throw new IllegalStateError('Cannot access database before fully loading it');
    }

    // STARTUP =========================================================================
    private constructor(
        token: symbol,
        type: dbType,
        dataSchema: { [field: string]: z.ZodTypeAny; },
        allEditables: EditableFieldDescriptor[]
    ) {
        // Enforce privacy
        if (token !== DataBase.#constructionToken)
            throw new PrivateConstructorError("DataBase", { init: { method: 'initAll', type: 'factory' } });

        // Build and load the database
        this.#type = type;
        const lcType = type.toLowerCase();
        this.#path = main + lcType + db_suffix + '.ndjson';
        this.#dataSchema = dataSchema;
        this.#editableFields = new Map(allEditables.map(e => [e.label, e]));

        // Each key must be unique across editable and readonly fields 
        // (also reserved keywords are filtered out)
        this.#verifyUniquenessOfKeys();

        // Load the database; client must await the `ready`.
        this.#ready = this.#loadDB();
    }

    /**
     * Private factory constructor.
     * 
     * @param type - Database unique 4 characters identifier.
     * @param dataSchema - A zod schema to enforce a specific shape on the database's records immutable data.
     * @returns an empty promise; the database data will be safe to access once such promise has resolved.
    */
    static async #of(type: string, dataSchema: { [field: string]: z.ZodTypeAny; }) {
        _validateType(type);
        if (this.#register.has(type)) {
            throw new DuplicateKeyError(`${type} already exists in the DataBase register`);
        }
        // Request the editable fields known for the database.
        const allEditables = await EditableFieldDescriptor.getAllOrInit(type);
        // Make the database instance
        const database = new this(this.#constructionToken, type, dataSchema, allEditables);
        // Register it
        this.#register.set(type, database);
        // Return state of data loading
        return database.ready;
    }
    /**
     * Initializes all the databases in the project.
     * @returns a promise whose resolution ensures safe access to all the available databases.
     */
    public static async initAll(): Promise<void[]> {
        const buffer: Promise<void>[] = [];
        for (const [type, dataSchema] of Object.entries(DBDataInitSchemas)) {
            buffer.push(this.#of(type, dataSchema));
        }
        return Promise.all(buffer);
    }

    // PERSISTENCE =====================================================================
    /**
     * Loads the entire database with its records stores, validates and builds all
     * the database's sub-structures.
     * @returns an empty promise indicating wheter the database has fully loaded.
     */
    async #loadDB() {
        if (this.#recordsStores || this.#ready) return;
        try {
            const dataStream = createReadStream(this.#path);
            const reader = readLines(dataStream);

            const temp = new Map();

            for await (const rawJsonLine of reader) {
                const rawData = JSON.parse(rawJsonLine);
                const parsed = await this.#storesSchema.parseAsync(rawData);
                const recordsStore = new DBRecordsStore(parsed);
                temp.set(recordsStore.id, recordsStore);
            }

            this.#recordsStores = temp;

        } catch (e: any) {
            if ('code' in e && e.code === 'ENOENT') {
                this.#recordsStores = new Map();
                Log.wrn(
                    'Cannot find database at ' + this.#path
                    + '\nA new empty database has been initialized'
                    + '\nIf this is not the expected outcome, '
                    + 'please exit and verify the data is at the correct path.'
                );
            } else throw e;
        }
        return;
    }
    /**
     * Saves the database's current state on disk.
     * @returns a promise that fulfills once writing operation has completed.
     */
    async #updateDB() {
        await this.ready;

        const tmpPath = this.#path + '.tmp';

        return this.#onWriteAllowed(async () => {
            await writeNdjsonPipeline(tmpPath, this.#toIterableJSONs());
            await rename(tmpPath, this.#path);
        });
    }

    async* #toIterableJSONs() {
        for (const store of this.recordsStores.values()) {
            yield store;
        }
    }

    // ACCESSORS =======================================================================
    public static get(type: string): DataBase {
        const db = this.#register.get(type as dbType);
        if (!db)
            throw new NotFoundError(type, { type: 'database' });
        return db;
    }

    public getFlatRecords(): PlainRecord[] {
        const result: PlainRecord[] = [];
        for (const store of this.recordsStores.values()) {
            for (const record of store.records) {
                result.push(new PlainRecord(store.id, this.#type, record));
            }
        }
        return result;
    }

    // INTERFACE =======================================================================

    /* #getHTMLByType()

    public getHTMLFlatRecord(record: PlainRecord) {
        record
    } */

    // SCHEMAS OF THE DATABASE =========================================================
    #schemaCache: ReturnType<typeof _buildRecordsStoreSchema> | null = null;
    /** Zod schema of the entire database. */
    get #storesSchema() {
        return this.#schemaCache ??=
            _buildRecordsStoreSchema(this.#type, this.#dataSchema, this.#editablesSchema);
    }
    #editablesSchemaCache: ReturnType<typeof _buildEditablesSchema> | null = null;
    /** Zod schema for the editable fields of the database. */
    get #editablesSchema() {
        return this.#editablesSchemaCache ??= _buildEditablesSchema(this.#editableFields.values());
    }
    /** Resets both caches for the database full schema and the editable fields one. */
    #resetSchemasCaches() {
        this.#schemaCache = null;
        this.#editablesSchemaCache = null;
    }

    // ADD NEW RECORD TO DATABASE ======================================================
    /** 
     * Helper for record insertion;   
     * creates a new records store if necessary  
     * and reports back the results of the addition operation.
     */
    #addRecord(
        storeId: dbRecordsStore['id'],
        data: dbRecord['data'],
        version: dbRecord['versions'][number],
        editables: dbRecord['editables']
    ): {
        newStore: boolean,
        newRecord: boolean,
        inv: dbRecord['inv']
    } {
        let store = this.recordsStores.get(storeId);
        const newStore = !store;
        if (!store) {
            store = new DBRecordsStore({ type: this.#type, id: storeId, records: [] });
            this.recordsStores.set(storeId, store);
        }
        const { new: newRecord, inv } = store.addRecord(data, version, editables);
        return { newStore, newRecord, inv }
    }
    /**
     * Adds one record to a specific records store (a new store is made if needed)
     * after validating the data.
     * 
     * @param storeId - Identifier of the store where the new record belongs (can be a new store).
     * @param newData - Unmodifiable data for the new record (will be parsed).
     * @param newVersion - Version for the new record.
     * @returns an object indicating the result of the operation (`ok`), 
     * with the error message in case it failed,
     * a boolean indicating whether the record was added
     * to an existing store or a new one was made.
     */
    public async addRecord(
        storeId: dbRecordsStore['id'],
        newData: dbRecord['data'],
        newVersion: dbRecord['versions'][number]
    ) {
        // Validation
        const result = await z.object(this.#dataSchema).safeParseAsync(newData);
        if (!result.success) {
            return { ok: false, error: result.error.message }
        }
        // Add validated record
        const defaultEditables = await EditableFieldDescriptor.getDefaultObject(this.#type);
        const res = this.#addRecord(storeId, newData, newVersion, defaultEditables);
        // Save edits
        await this.#updateDB();
        return { ok: true, ...res };
    }
    /**
     * Adds one or more records to each's records store 
     * (a new store is made if needed)
     * after validating the data of each.
     * 
     * @param newVersion - Version for the new record.
     * @param newRecords - Records to add to various store.
     * @param newRecords.storeId - Identifier of the store where the new record belongs (can be a new store).
     * @param newRecords.newData - Unmodifiable data for the new record (will be parsed).
     * @returns an object indicating the result of the operation (`ok`), 
     * with the error messages in case any failed,
     * a map of stores with an object containing 
     * a boolean indicating whether a record was added
     * to an existing store or a new one was made.    
     * 
     * @remarks
     * Since two records of the same version cannot co-exist in the same
     * store (an error will stop the execution), 
     * it is impossible for the results array in the values of
     * the results map to have a length different from 1.
     */
    public async addRecordsBatch(
        newVersion: dbRecord['versions'][number],
        newRecords: {
            storeId: dbRecordsStore['id'],
            newData: dbRecord['data']
        }[]
    ) {
        // Batch validations
        const validations = await Promise.all(
            newRecords.map(async ({ storeId, newData }) => ({
                storeId, newData,
                result: await z.object(this.#dataSchema).safeParseAsync(newData)
            }))
        );
        // If error, don't add any record
        const errors = validations.filter(v => !v.result.success);
        if (errors.length > 0) {
            return {
                ok: false,
                errors: errors.map(e => ({
                    storeId: e.storeId,
                    error: e.result.error!.message
                }))
            };
        }
        // Prepare for batch additions
        const defaultEditables = await EditableFieldDescriptor.getDefaultObject(this.#type);
        const resultsBuffer = new Map<
            dbRecordsStore['id'], {
                newStore: boolean,
                newRecord: boolean,
                inv: dbRecord['inv']
            }[]>();
        // Add each record and report the result
        for (const { storeId, newData } of validations) {
            const result = this.#addRecord(storeId, newData, newVersion, defaultEditables);
            if (!resultsBuffer.has(storeId)) resultsBuffer.set(storeId, []);
            resultsBuffer.get(storeId)!.push(result);
        }
        // Update database and give back results
        await this.#updateDB();
        return { ok: true, results: resultsBuffer };
    }

    // MANAGE EDITABLE FIELDS ==========================================================
    /** 
     * Verifies that all the database immutable fields 
     * do not have a name duplicate among the editable fields.
     * 
     * @remarks
     * It's impossible the two groups have duplicates among themselves because
     * they are unique keys per construction.
     */
    #verifyUniquenessOfKeys() {
        const immutableFields = new Set(Object.keys(this.#dataSchema));
        const duplicates = new Set<DuplicateKeyError>();

        immutableFields.forEach(field => {
            if (PlainRecord.isReservedKeyword(field)) {
                duplicates.add(
                    new DuplicateKeyError(`Immutable field ${field} of db ${this.#type} cannot use a reserved keyword`)
                )
                immutableFields.delete(field);
            }
        })

        for (const label of this.#editableFields.keys()) {
            if (immutableFields.has(label)) {
                duplicates.add(new DuplicateKeyError(`Editable field ${label} cannot have the same name as an immutable field in db ${this.#type}`));
            }
            if (PlainRecord.isReservedKeyword(label)) {
                duplicates.add(
                    new DuplicateKeyError(`Editable field ${label} of db ${this.#type} cannot use a reserved keyword`)
                )
            }
        }

        if (duplicates.size === 0) return;
        throw new AggregateError(duplicates)
    }

    /**
     * 
     * @param label - Name of the editable field to introduce.
     * @param type - Type of the new editable field.
     * @param defVal - Default value to assign uninitialized fields.
     * @returns the instance of the new editable field descriptor.
     */
    public async addEditableField(label: string, type: editableType, defVal: any) {
        if (this.#editableFields.has(label))
            throw new DuplicateKeyError(`Editable field ${label} already exists for this db (${this.#type})`);
        if (Object.keys(this.#dataSchema).includes(label))
            throw new DuplicateKeyError(`Editable field ${label} cannot have the same name as an immutable field in db ${this.#type}`);
        if (PlainRecord.isReservedKeyword(label))
            throw new DuplicateKeyError(`Editable field ${label} cannot use a reserved keyword in db ${this.#type}`);

        const res = await EditableFieldDescriptor.create(this.#type, { label, type, defVal })
        this.#resetSchemasCaches();
        return res;
    }

    async deprecateEditableField(label: string) {
        if (!this.#editableFields.has(label))
            throw new NotFoundError(label, { type: 'editable field' });
        return EditableFieldDescriptor.deprecate(this.#type, await EditableFieldDescriptor.getByLabel(this.#type, label))
    }

    /* #findEditableFieldValues(label: string) {
        if(!this.#editableFields.has(label))
            throw new NotFoundError(label, {type: 'editable field'});
        const wouldDelete = [];
        for(const store of this.recordsStores.values()) {}
    } */
    private async deleteEditableField(label: string) {
        if (!this.#editableFields.has(label))
            throw new NotFoundError(label, { type: 'editable field' });
        this.#resetSchemasCaches();
        return EditableFieldDescriptor.delete(this.#type, await EditableFieldDescriptor.getByLabel(this.#type, label))
    }
}
