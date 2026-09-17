import z, { ZodObject } from "zod";
import { DuplicateKeyError, IllegalStateError, NotFoundError, ValidationError } from "../../../errors/common-errors.mjs";
import { DBInitSchemas } from "./data-base-init.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DBRecordsStore } from "./records/records-store.js";
import { rename } from "fs/promises";
import { Log } from "../../../tools/console.js";
import { FlatRecord } from "./records/flat-record.js";
import { EditableFieldDescriptor } from "./editables/editable-field.js";
import { writeNdjsonPipeline } from '../writers/write-ndjson-pipeline.js';
import type { editableConfig, editableType } from "./editables/editable-field.js";
import dbConfig from "../../../config/db-config.mjs";
import { _verifyUniquenessOfKeys } from "./helpers/verify-uniqueness-of-keys.js";
import type { dbType, dataLabel, dbStoreId, dbRecordData, dbRecordEditables, dbRecordVersions, dbRecordVersion, dbRecordInv, dbDataShape, dbDerivedShape } from "./data-base-types.d.js";
import { _validateDBIdentifier } from "./helpers/validate-db-identifier.js";
import { AsyncOperationQueue } from "../../../tools/async-operation-queue.mjs";
import { readNdjsonPipeline } from "../writers/read-ndjson-pipeline.js";
import { _buildEditablesShape } from "./editables/build-editables-shape.js";
import { _buildRecordsStoreSchema } from "./helpers/build-records-store-schema.js";
import { _isReservedKeyword } from "./base-field.js";

// PATH CONSTANTS ================================================================
const { main, db_suffix } = dbConfig;

// CLASS IMPLEMENTATION ================================================================

class DataBase<T extends dbType = dbType> {

    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    // FINAL PROPERTIES =========================================================
    /** Type of the database (unique). */
    readonly #type: T;
    /** Type of the database (unique). */
    get type() { return this.#type; }

    /** Path to the database from the project root. */
    readonly #path: string;

    /** Object containing the `zod` record-data schema shape. */
    readonly #dataShape: dbDataShape<T>;
    /** Object containing the `zod` record-data schema shape. */
    get dataShape() { return { ...this.#dataShape }; }

    /** Object containing the `zod` record-derived-data schema shape. */
    readonly #derivedShape: dbDerivedShape<T>;
    /** Object containing the `zod` record-derived-data schema shape. */
    get derivedShape() { return { ...this.#derivedShape }; }

    // STATE DESCRIPTORS ========================================================
    readonly #ready: Promise<void> | null = null;
    /** An empty promise; *the database can be accessed only after it's resolved*. */
    get ready(): Promise<void> {
        if (this.#ready) return this.#ready;
        throw new IllegalStateError('Cannot read state of database');
    }

    /** Write queue to avoid concurrency. */
    readonly #writeQueue = new AsyncOperationQueue();

    // INTERNAL DATA ============================================================
    #nullableEditableFields: Map<dataLabel, EditableFieldDescriptor> | null = null;
    /** Object listing each editable field, with associated editable type, of the db's records. */
    get #editableFields(): Map<dataLabel, EditableFieldDescriptor> {
        if (this.#nullableEditableFields) return this.#nullableEditableFields;
        throw new IllegalStateError('Cannot access database before fully loading it');
    };

    #recordsStores: Map<dbStoreId, DBRecordsStore<T>> | null = null;
    /** Database of records stores; only access once `ready` is fulfilled. */
    get recordsStores() {
        if (this.#recordsStores) return this.#recordsStores;
        throw new IllegalStateError('Cannot access database before fully loading it');
    }

    // STARTUP =========================================================================
    private constructor(
        token: symbol,
        type: T,
        dataShape: dbDataShape<T>,
        derivedShape: dbDerivedShape<T>
    ) {
        // Enforce privacy
        if (token !== DataBase.#constructionToken)
            throw new PrivateConstructorError("DataBase", { init: { method: 'of', type: 'factory' } });

        // Build and load the database
        this.#type = type;
        const lcType = type.toLowerCase();
        this.#path = main + lcType + db_suffix + '.ndjson';
        this.#dataShape = dataShape;
        this.#derivedShape = derivedShape;

        // Load the database; client must await the `ready`.
        this.#ready = this.#loadEditableFields()
            // Each key must be unique across editable and readonly fields 
            // (also reserved keywords are filtered out)
            .then(() => this.#verifyUniquenessOfKeys())
            .then(() => this.#loadDB());
    }

    /** 
     * Verifies that all the database fields 
     * do not have a name duplicate among the others.
     * 
     * @remarks
     * It's impossible that a group has duplicates among themselves because
     * it is made of unique keys per construction.
     */
    #verifyUniquenessOfKeys() {
        _verifyUniquenessOfKeys(
            this.#type,
            Object.keys(this.#dataShape),
            Object.keys(this.#derivedShape),
            this.#editableFields.keys()
        );
    }

    public static of<T extends dbType>(
        type: T,
        dataShape: dbDataShape<T>,
        derivedShape: dbDerivedShape<T>
    ): DataBase<T> {
        return new this(this.#constructionToken, type, dataShape, derivedShape);
    }

    // PERSISTENCE =====================================================================
    async #loadEditableFields() {
        // Request the editable fields known for the database.
        const allEditables = await EditableFieldDescriptor.getAllOrInit(this.#type);
        this.#nullableEditableFields = new Map(allEditables.map(e => [e.label, e]));
        return;
    }
    /**
     * Loads the entire database with its records stores, validates and builds all
     * the database's sub-structures.
     * @returns an empty promise indicating wheter the database has fully loaded; the same promise is stored in the `#ready`.
     */
    async #loadDB() {
        //if (this.#ready) return this.#ready;
        if (this.#recordsStores) return;
        try {
            const temp = new Map();

            const parsedReader = readNdjsonPipeline(this.#path, this.#storesSchema);

            for await (const parsed of parsedReader) {
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

        return this.#writeQueue.enqueue(async () => {
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


    public getFlatRecords(): FlatRecord<T>[] {
        const result: FlatRecord<T>[] = [];
        for (const store of this.recordsStores.values()) {
            for (const record of store.records) {
                result.push(new FlatRecord(store.id, this.#type, record));
            }
        }
        return result;
    }

    public async * streamFlatRecords(): AsyncGenerator<FlatRecord<T>> {

        for (const store of this.recordsStores.values()) {
            for (const record of store.records) {
                yield new FlatRecord(store.id, this.#type, record);
            }
        }
    }

    // SCHEMAS OF THE DATABASE =========================================================
    #schemaCache: ReturnType<typeof _buildRecordsStoreSchema<T>> | null = null;
    /** Zod schema of the entire database. */
    get #storesSchema() {
        return this.#schemaCache ??=
            _buildRecordsStoreSchema<T>(this.#type, this.#dataShape, this.#derivedShape, this.#editablesShape);
    }
    #editablesShapeCache: ReturnType<typeof _buildEditablesShape> | null = null;
    /** Zod schema for the editable fields of the database. */
    get #editablesShape() {
        return this.#editablesShapeCache ??= _buildEditablesShape(this.#editableFields.values());
    }
    /** Resets both caches for the database full schema and the editable fields one. */
    #resetSchemasCaches() {
        this.#schemaCache = null;
        this.#editablesShapeCache = null;
    }
    #derivedSchemaCache: z.ZodObject<any> | null = null;
    get #derivedSchema() {
        return this.#derivedSchemaCache ??= z.object(this.#derivedShape).partial();
    }

    // VALIDATION ==========================================================

    assertValidDerived(derived: unknown): void {
        this.#derivedSchema.parse(derived ?? {});
    }

    // ADD NEW RECORD TO DATABASE ======================================================
    /** 
     * Helper for record insertion;   
     * creates a new records store if necessary  
     * and reports back the results of the addition operation.
     */
    #addRecord(
        storeId: dbStoreId,
        data: dbRecordData<T>,
        version: dbRecordVersion,
        editables: dbRecordEditables<T>
    ): {
        newStore: boolean,
        newRecord: boolean,
        inv: dbRecordInv
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
        storeId: dbStoreId,
        newData: dbRecordData<T>,
        newVersion: dbRecordVersion
    ) {
        // Validation
        const result = await z.object(this.#dataShape).safeParseAsync(newData);
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
        newVersion: dbRecordVersion,
        newRecords: {
            storeId: dbStoreId,
            newData: dbRecordData<T>
        }[]
    ) {
        // Batch validations
        const validations = await Promise.all(
            newRecords.map(async ({ storeId, newData }) => ({
                storeId, newData,
                result: await z.object(this.#dataShape).safeParseAsync(newData)
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
            dbStoreId, {
                newStore: boolean,
                newRecord: boolean,
                inv: dbRecordInv
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
     * 
     * @param label - Name of the editable field to introduce.
     * @param type - Type of the new editable field.
     * @param defVal - Default value to assign uninitialized fields.
     * @returns the instance of the new editable field descriptor.
     */
    public async addEditableField<E extends editableType>(label: string, type: E, defVal: any, config: editableConfig<E>) {
        if (this.#editableFields.has(label as dataLabel))
            throw new DuplicateKeyError(`Editable field ${label} already exists for this db (${this.#type})`);
        if (Object.keys(this.#dataShape).includes(label))
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


class DataBaseRegister {
    /** Maps each db type to its corresponding database. */
    readonly #register = new Map<dbType, DataBase>();

    /**
     * Private factory constructor.
     * 
     * @param type - Database unique 4 characters identifier.
     * @param dataShape - A zod schema to enforce a specific shape on the database's records immutable data.
     * @returns the database instance; the database data will be safe to access once the ready promise has resolved.
    */
    #of<T extends dbType>(
        type: T,
        dataShape: dbDataShape<T>,
        derivedShape: dbDerivedShape<T>
    ): DataBase<T> {
        // Cannot build same database twice
        if (this.#register.has(type)) {
            throw new DuplicateKeyError(`${type} already exists in the DataBase register`);
        }
        // Make the database instance
        const database = DataBase.of(type, dataShape, derivedShape);
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
    #getDB<T extends dbType>(type: T): DataBase<T> {

        // Early exit if db is already loaded in register
        const db = this.#register.get(type)
        if (db) return db as any as DataBase<T>;

        if (type in DBInitSchemas) {
            // Validate identificator shape
            _validateDBIdentifier(type);

            // Get schemas
            const dataShape = DBInitSchemas[type].data;
            if (!dataShape)
                throw new NotFoundError(type, { type: 'data schema for database' });

            const derivedShape = DBInitSchemas[type].derived;
            if (!derivedShape)
                throw new NotFoundError(type, { type: 'derived data schema for database' });

            return this.#of(type, dataShape, derivedShape);
        }
        throw new NotFoundError(type, { type: 'database with type' });
    }

    /**
     * 
     * @param type 
     * @returns 
     */
    public get(type: string): DataBase {
        try {
            _validateDBIdentifier(type);
            return this.#getDB(type);
        }
        catch (e: unknown) {
            if (e instanceof ValidationError) {
                throw new NotFoundError(type, { type: 'database of type' });
            }
            throw e;
        }
    }

    /**
     * Initializes all the databases in the project.
     * @returns a promise whose resolution ensures safe access to all the available databases.
     */
    public async initAll(): Promise<void[]> {
        const buffer: Promise<void>[] = [];
        if (this.#register)
            for (const type of Object.keys(DBInitSchemas)) {
                buffer.push(this.#getDB(type as dbType).ready);
            }
        return Promise.all(buffer);
    }


}

export type { DataBase };
export const DataBaseRegistry = new DataBaseRegister();