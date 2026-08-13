import z from "zod";
import { DuplicateKeyError, IllegalStateError, NotFoundError, ValidationError } from "../../../errors/common-errors.mjs";
import type { Brand } from "../../types/general-types.js";
import { EditableFieldDescriptor, type editableSchema, type editableType } from "./editable-field.js";
import { DBDataInitSchemas } from "./data-base-init.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DBRecordsStore } from "./records-store.js";

export const root = 'src/data/db/';
const main = root + 'main/';
const db_suffix = '_db';

const dbTypeRegEx = /^(?:[A-Z_]{4})$/;

export const dbTypeSchema = z.string().regex(dbTypeRegEx).transform(it => it as dbType);
export type dbType = Brand<string, 'database type'>;

export interface DataBaseInit {
    readonly [type: string]: { [field: string]: z.ZodTypeAny; };
}
export type dbRecordsStore = z.infer<ReturnType<typeof _buildRecordsStoreSchema>>


export class DataBase {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    /** Maps each db type to its corresponding database. */
    static readonly #register = new Map<dbType, DataBase>();

    /** Type of the database (unique). */
    readonly #type: dbType;
    /** Path to the database. */
    readonly #path: string;
    /** Object containing the `zod` record-data validators. */
    readonly #dataSchema: { [field: string]: z.ZodTypeAny; };
    /** Object listing each editable field, with associated editable type, of the db's records. */
    readonly #editableFields: Map<string, EditableFieldDescriptor>;

    readonly #ready: Promise<void>;
    /** An empty promise; the database will be accessible only after it's resolved. */
    get ready() { return this.#ready; }

    #recordsStores: Map<dbRecordsStore['id'],DBRecordsStore> | null = null;
    /** Database of records stores; only access once `ready` is fulfilled. */
    get recordsStores() {
        if (this.#recordsStores) return this.#recordsStores;
        throw new IllegalStateError('Cannot access database before fully loading it');
    }

    private constructor(
        token: symbol,
        type: dbType,
        dataSchema: { [field: string]: z.ZodTypeAny; },
        allEditables: EditableFieldDescriptor[]
    ) {
        // Enforce privacy
        if (token !== DataBase.#constructionToken)
            throw new PrivateConstructorError("DataBase", { init: { method: '#of', type: 'factory' } });

        // 
        this.#type = type;

        const lcType = type.toLowerCase();
        this.#path = main + lcType + db_suffix + '.json';
        this.#dataSchema = dataSchema;

        this.#editableFields = new Map(allEditables.map(e => [e.label, e]));

        this.#ready = this.#loadDB();
    }

    static async #of(type: string, dataSchema: { [field: string]: z.ZodTypeAny; }) {
        _validateType(type);
        if (this.#register.has(type)) {
            throw new DuplicateKeyError(`${type} already exists in the DataBase register`);
        }
        const allEditables = await EditableFieldDescriptor.getAllOrInit(type);
        this.#register.set(type, new this(this.#constructionToken, type, dataSchema, allEditables));
    }

    public static async initAll(): Promise<void[]> {
        const buffer = [];
        for (const [type, dataSchema] of Object.entries(DBDataInitSchemas)) {
            buffer.push(this.#of(type, dataSchema));
        }
        return Promise.all(buffer);
    }

    public static get(type: string): DataBase {
        const db = this.#register.get(type as dbType);
        if (!db)
            throw new NotFoundError(type, { type: 'database' });
        return db;
    }

    async #loadDB() {
        if (this.#recordsStores) return;
        this.#recordsStores = await import(this.#path, { with: { type: 'json' } })
            .then(data => this.schema.parseAsync(data.default))
            .then(parsed => new Map(parsed.recordsStores
                .map(store => {
                    const rStore = new DBRecordsStore(store);
                    return [rStore.id ,rStore];
                }))
            );
    }
    toJSON(): z.infer<ReturnType<typeof _buildDBSchema>> {
        return {
            type: this.#type,
            recordsStores: this.#getAllRecordStoresJSON()
        }
    }
    #getAllRecordStoresJSON(): dbRecordsStore[] {
        const res: dbRecordsStore[] = [];
        for (const store of this.recordsStores.values()) {
            res.push(store.toJSON())
        }
        return res;
    }

    #schemaCache: ReturnType<typeof _buildDBSchema> | null = null;
    get schema() {
        return this.#schemaCache ??=
            _buildDBSchema(this.#type, this.#dataSchema, this.editablesSchema);
    }

    #editablesSchemaCache: ReturnType<typeof _buildEditablesSchema> | null = null;
    get editablesSchema() {
        return this.#editablesSchemaCache ??= _buildEditablesSchema(this.#editableFields.values());
    }

    async addEditableField(label: string, type: editableType, defVal: any) {
        if(this.#editableFields.has(label))
            throw new DuplicateKeyError(`Editable field ${label} already exists for this db (${this.#type})`);
        const res = await EditableFieldDescriptor.create(this.#type, { label, type, defVal })
        this.#schemaCache = this.#editablesSchemaCache = null; // invalidate
        return res;
    }

    async deprecateEditableField(label: string) {
        if(!this.#editableFields.has(label))
            throw new NotFoundError(label, {type: 'editable field'});
        return EditableFieldDescriptor.deprecate(this.#type,await EditableFieldDescriptor.getByLabel(this.#type,label))
    }

    /* #findEditableFieldValues(label: string) {
        if(!this.#editableFields.has(label))
            throw new NotFoundError(label, {type: 'editable field'});
        const wouldDelete = [];
        for(const store of this.recordsStores.values()) {}
    } */
    async deleteEditableField(label: string) {
        if(!this.#editableFields.has(label))
            throw new NotFoundError(label, {type: 'editable field'});
        this.#schemaCache = this.#editablesSchemaCache = null; // invalidate
        return EditableFieldDescriptor.delete(this.#type,await EditableFieldDescriptor.getByLabel(this.#type,label))
    }
}

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
    id: z.string(),
    // Array of records under the same ID; they differ in version and are therefore separated for contextual use
    records: z.array(z.object({
        // 3 characters to distinguish among records
        inv: z.string().regex(/^(?:[A-Za-z0-9]{3})$/),
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

function _buildDBSchema(
    type: dbType,
    dataScheme: { [field: string]: z.ZodTypeAny; },
    editablesSchemas: { [key: string]: editableSchema; }
) {
    return z.object({
        type: z.literal(type),
        recordsStores: z.array(_buildRecordsStoreSchema(type, dataScheme, editablesSchemas))
    });
}
