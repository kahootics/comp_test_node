import z from "zod";
import { DuplicateKeyError, IllegalStateError, NotFoundError } from "../../../errors/common-errors.mjs";
import { DBInitSchemas } from "./data-base-init.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DBRecordsStore } from "./records/records-store.js";
import { rename } from "fs/promises";
import { Log } from "../../../tools/console.js";
import { FlatRecord } from "./records/flat-record.js";
import { EditableFieldDescriptor } from "./editable-field.js";
import { createReadStream } from "fs";
import { readLines } from "../../../tools/read-lines.mjs";
import { writeNdjsonPipeline } from '../writers/write-ndjson-pipeline.js';
import type { editableConfig, editableSchema, editableType } from "./editable-field.js";
import dbConfig from "../../../config/db-config.mjs";
import { _verifyUniquenessOfKeys } from "./helpers/verify-uniqueness-of-keys.js";
import type { dbType, dataLabel, dbRecordsStore, dbRecord, dbInitSchemas } from "./data-base-types.d.js";
import { _validateDBIdentifier } from "./helpers/validate-db-identifier.js";

// PATH CONSTANTS ================================================================
const { main, db_suffix } = dbConfig;

// DATABASE TYPE =================================================================

/** Regular expression a databsse identifier must match. */
export const dbTypeRegEx = /^(?:[A-Z_]{4})$/;
/** Zod schema enforcing the database identifier shape. */
export const dbTypeSchema = z.string().regex(dbTypeRegEx)/* .brand('database') */.refine(
    (type) => Object.keys(DBInitSchemas).includes(type)
).transform(type => type as dbType);

const dbStoreIdRegEx = /^(?:[A-Z0-9]{5,6})$/;
export const dbStoreIdSchema = z.string().regex(dbStoreIdRegEx).brand('storeId');

export const dbRecordInvSchema = z.string().regex(/^(?:[A-Z0-9]{3})$/).brand('inv');

export const dbRecordVersionsSchema = z.array(z.string().nonempty()).nonempty();

export const reservedKeywords = Object.freeze({
    type: dbTypeSchema,
    versions: dbRecordVersionsSchema,
    storeId: dbStoreIdSchema,
    inv: dbRecordInvSchema
});

export function _isReservedKeyword(key: string) {
    return key === 'id' || Object.keys(reservedKeywords).includes(key);
}

/**
 * Build the object that associates the labels of each 
 * editable field descriptors of the database to their
 * schema (to enforce on the values).
 * 
 * @param editables - Editable field descriptors of the database.
 * @returns the zod schema each record in the database must enforce on their editable fields.
 */
function _buildEditablesSchema(editables: Iterable<EditableFieldDescriptor>) {
    const result: { [label: dataLabel]: editableSchema; } = {};
    for (const editable of editables) {
        result[editable.label] = editable.schema;
    }
    return result;
}

/**
 * @param type - Database identifier; each store will be required to know the database it belongs to.
 * @param dataSchema - Zod schema to enforce on each record's immutable fields.
 * @param editablesSchemas - Zod schema to enforce on each record's editable fields.
 * @returns a zod schema to enforce on each store within the specified database.
 */
export function _buildRecordsStoreSchema<T extends dbType>(
    type: T,
    dataSchema: dbInitSchemas[T]['data'],
    editablesSchemas: { [key: dataLabel]: editableSchema; }
) {
    return z.object({
        // 4 characters to identify the database the record belongs to (case-sensitive!)
        type: z.literal(type),
        // A unique identifier among records in the same db 
        id: dbStoreIdSchema,

        // Array of records under the same ID; they differ in version and are therefore separated for contextual use
        records: z.array(z.object({
            // 3 characters to distinguish among records
            inv: dbRecordInvSchema,
            // A list of versions the data in this record is compatible for
            versions: dbRecordVersionsSchema,
            // bundle-dependent data
            data: z.object(/* Static Non-modifiable data goes in here */ dataSchema),
            // bundle-dependent editable data
            editables: z.object(/* Editable data goes in here */ editablesSchemas)
        }))
    });
}
// CLASS IMPLEMENTATION ================================================================

export class DataBase<T extends dbType = dbType> {
    // CLASS PRIVACY AND CACHING ===============================================
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    /** Maps each db type to its corresponding database. */
    static readonly #register = new Map<dbType, DataBase>();

    // FINAL PROPERTIES =========================================================
    /** Type of the database (unique). */
    readonly #type: T;
    /** Path to the database from the project root. */
    readonly #path: string;
    /** Object containing the `zod` record-data validators. */
    readonly #dataSchema: dbInitSchemas[T]['data'];
    /** Object containing the `zod` record-derived-data validators. */
    readonly #derivedSchema: dbInitSchemas[T]['derived'];


    // STATE DESCRIPTORS ========================================================
    readonly #ready: Promise<void> | null = null;
    /** An empty promise; *the database can be accessed only after it's resolved*. */
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
    #optionalEditableFields: Map<dataLabel, EditableFieldDescriptor> | null = null;
    /** Object listing each editable field, with associated editable type, of the db's records. */
    get #editableFields(): Map<dataLabel, EditableFieldDescriptor> {
        if (this.#optionalEditableFields) return this.#optionalEditableFields;
        throw new IllegalStateError('Cannot access database before fully loading it');
    };
    #recordsStores: Map<dbRecordsStore<T>['id'], DBRecordsStore<T>> | null = null;
    /** Database of records stores; only access once `ready` is fulfilled. */
    get recordsStores() {
        if (this.#recordsStores) return this.#recordsStores;
        throw new IllegalStateError('Cannot access database before fully loading it');
    }

    // STARTUP =========================================================================
    private constructor(
        token: symbol,
        type: T,
        dataSchema: dbInitSchemas[T]['data'],
        derivedSchema: dbInitSchemas[T]['derived']
    ) {
        // Enforce privacy
        if (token !== DataBase.#constructionToken)
            throw new PrivateConstructorError("DataBase", { init: { method: 'initAll', type: 'factory' } });

        // Build and load the database
        this.#type = type;
        const lcType = type.toLowerCase();
        this.#path = main + lcType + db_suffix + '.ndjson';
        this.#dataSchema = dataSchema;
        this.#derivedSchema = derivedSchema;

        // Load the database; client must await the `ready`.
        this.#ready = this.#loadEditableFields()
            // Each key must be unique across editable and readonly fields 
            // (also reserved keywords are filtered out)
            .then(() => this.#verifyUniquenessOfKeys())
            .then(() => this.#loadDB());
    }

    /**
     * Private factory constructor.
     * 
     * @param type - Database unique 4 characters identifier.
     * @param dataSchema - A zod schema to enforce a specific shape on the database's records immutable data.
     * @returns the database instance; the database data will be safe to access once the ready promise has resolved.
    */
    static #of<T extends dbType>(
        type: T,
        dataSchema: dbInitSchemas[T]['data'],
        derivedSchema: dbInitSchemas[T]['derived']
    ): DataBase<T> {
        // Cannot build same database twice
        if (this.#register.has(type)) {
            throw new DuplicateKeyError(`${type} already exists in the DataBase register`);
        }
        // Make the database instance
        const database = new this(this.#constructionToken, type, dataSchema, derivedSchema);
        // Register it as fulfilled
        this.#register.set(type, database as any as DataBase);
        // Return database (ready must be awaited before use)
        return database;
    }
    /**
     * Private method to get a database either 
     * from the internal register
     * or by loading it from disk.
     * 
     * @param type - The type of database to retrieve (not type checked).
     * @returns the database requested.
     * 
     * @throws {NotFoundError} If the database requested does not have an initilizer.
     */
    static #getDB<T extends dbType>(type: T): DataBase<T> {

        // Early exit if db is already loaded in register
        const db = this.#register.get(type)
        if (db) return db as any as DataBase<T>;

        if (type in DBInitSchemas) {
            // Validate identificator shape
            _validateDBIdentifier(type);

            // Get schemas
            const dataSchema = DBInitSchemas[type].data;
            if (!dataSchema)
                throw new NotFoundError(type, { type: 'data schema for database' });

            const derivedSchema = DBInitSchemas[type].derived;
            if (!derivedSchema)
                throw new NotFoundError(type, { type: 'derived data schema for database' });

            // Register the promise
            return this.#of(type, dataSchema, derivedSchema);
        }
        throw new NotFoundError(type, { type: 'database with type' });
    }

    /**
     * Initializes all the databases in the project.
     * @returns a promise whose resolution ensures safe access to all the available databases.
     */
    public static async initAll(): Promise<void[]> {
        const buffer: Promise<void>[] = [];
        if (this.#register)
            for (const type of Object.keys(DBInitSchemas)) {
                buffer.push(this.#getDB(type as dbType).ready);
            }
        return Promise.all(buffer);
    }


    // PERSISTENCE =====================================================================
    async #loadEditableFields() {
        // Request the editable fields known for the database.
        const allEditables = await EditableFieldDescriptor.getAllOrInit(this.#type);
        this.#optionalEditableFields = new Map(allEditables.map(e => [e.label, e]));
        return;
    }
    /**
     * Loads the entire database with its records stores, validates and builds all
     * the database's sub-structures.
     * @returns an empty promise indicating wheter the database has fully loaded; the same promise is stored in the `#ready`.
     */
    async #loadDB() {
        if (this.#ready) return this.#ready;
        if (this.#recordsStores) return;
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

        } catch (e: unknown) {
            if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
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
     * @returns a promise that fulfills once the writing operation has completed.
     */
    async #updateDB() {
        await this.ready;

        const tmpPath = this.#path + '.tmp';

        return this.#onWriteAllowed(async () => {
            await writeNdjsonPipeline(tmpPath, this.#toIterableJSONs());
            await rename(tmpPath, this.#path);
        });
    }

    async *#toIterableJSONs() {
        for (const store of this.recordsStores.values()) {
            yield store;
        }
    }

    // ACCESSORS =======================================================================
    /**
     * 
     * @param type 
     * @returns 
     */
    public static get<T extends dbType>(type: T): DataBase<T> {
        return this.#getDB(type);
    }

    public getFlatRecords(): FlatRecord<T>[] {
        const result: FlatRecord<T>[] = [];
        for (const store of this.recordsStores.values()) {
            for (const record of store.records) {
                result.push(new FlatRecord(store.id, this.#type, record));
            }
        }
        return result;
    }

    /*  #getColumnStaticHeaders() {
         const staticFieldsH = Object.entries(this.#dataSchema).map(
             ([label,schema]) => new StaticColumn(label,schema.type)
         )
     } */

    // INTERFACE =======================================================================

    /* #getHTMLByType()

    public getHTMLFlatRecord(record: FlatRecord) {
        record
    } */

    // SCHEMAS OF THE DATABASE =========================================================
    #schemaCache: ReturnType<typeof _buildRecordsStoreSchema<T>> | null = null;
    /** Zod schema of the entire database. */
    get #storesSchema() {
        return this.#schemaCache ??=
            _buildRecordsStoreSchema<T>(this.#type, this.#dataSchema, this.#editablesSchema);
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
        storeId: dbRecordsStore<T>['id'],
        data: dbRecord<T>['data'],
        version: dbRecord<T>['versions'][number],
        editables: dbRecord<T>['editables']
    ): {
        newStore: boolean,
        newRecord: boolean,
        inv: dbRecord<T>['inv']
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
        storeId: dbRecordsStore<T>['id'],
        newData: dbRecord<T>['data'],
        newVersion: dbRecord<T>['versions'][number]
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
        newVersion: dbRecord<T>['versions'][number],
        newRecords: {
            storeId: dbRecordsStore<T>['id'],
            newData: dbRecord<T>['data']
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
            dbRecordsStore<T>['id'], {
                newStore: boolean,
                newRecord: boolean,
                inv: dbRecord<T>['inv']
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
        _verifyUniquenessOfKeys(
            this.#type,
            Object.keys(this.#dataSchema),
            Object.keys(this.#derivedSchema),
            this.#editableFields.keys()
        );
    }

    /**
     * 
     * @param label - Name of the editable field to introduce.
     * @param type - Type of the new editable field.
     * @param defVal - Default value to assign uninitialized fields.
     * @returns the instance of the new editable field descriptor.
     */
    public async addEditableField(label: string, type: editableType, defVal: any, config: editableConfig) {
        if (this.#editableFields.has(label as dataLabel))
            throw new DuplicateKeyError(`Editable field ${label} already exists for this db (${this.#type})`);
        if (Object.keys(this.#dataSchema).includes(label))
            throw new DuplicateKeyError(`Editable field ${label} cannot have the same name as an immutable field in db ${this.#type}`);
        if (_isReservedKeyword(label))
            throw new DuplicateKeyError(`Editable field ${label} cannot use a reserved keyword in db ${this.#type}`);

        const res = await EditableFieldDescriptor.create(this.#type, { label, type, defVal, config })
        this.#resetSchemasCaches();
        return res;
    }

    async deprecateEditableField(label: string) {
        if (!this.#editableFields.has(label as dataLabel))
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
        if (!this.#editableFields.has(label as dataLabel))
            throw new NotFoundError(label, { type: 'editable field' });
        this.#resetSchemasCaches();
        return EditableFieldDescriptor.delete(this.#type, await EditableFieldDescriptor.getByLabel(this.#type, label))
    }
}


