import z from "zod";
import { writeFile, rename, readFile } from 'node:fs/promises'
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DuplicateKeyError, IllegalAccessError, IllegalArgumentError, IllegalStateError, NotFoundError } from "../../../errors/common-errors.mjs";
import { dbTypeSchema } from "./data-base.js";
import { Log } from "../../../tools/console.js";
import { escapeHtml } from "../../../tools/string-parsers.js";
import dbConfig from "../../../config/db-config.mjs";
import type { dataLabel, dbType } from "./data-base.js";

const { editablesPath } = dbConfig;

/**
 * Editable field descriptors' configurations interface.
 * 
 * This interface serves as a type safety net for the rest of the related script.
 */
interface EditableTypeConfig {
    checklist: { options: string[] };
    list: { options: string[] };
    url: {};
    paragraph: {};
    line: {};
    value: { min: number, max: number };
    int: { min: number, max: number };
    check: {};
}

/**
 * Zod schemas per type for the configuration of the editable field.
 */
const configSchemas = {
    checklist: z.object({ options: z.array(z.string()).nonempty() }),
    list: z.object({ options: z.array(z.string()).nonempty() }),
    paragraph: z.object({}),
    line: z.object({}),
    url: z.object({}),
    value: z.object({ min: z.number(), max: z.number() }).refine(
        o => o.max > o.min,
        { error: 'Cannot have minimum value greater than the maximum' }
    ),
    int: z.object({ min: z.int32(), max: z.int32() }).refine(
        o => o.max > o.min,
        { error: 'Cannot have minimum value greater than the maximum' }
    ),
    check: z.object({}),
} satisfies {
    [K in editableType]: z.ZodType<EditableTypeConfig[K]>
};

/**
 * Creates a schema for an editable field to enforce on the data contained in it.
 */
const makeSchema = {
    checklist: ({ options }) => z.array(z.enum(_nonEmptyTuple(options)))
        .refine(
            l => new Set(l).size === l.length,
            { error: 'Cannot select same option twice' }
        ),
    list: ({ options }) => z.enum(_nonEmptyTuple(options)),
    paragraph: () => z.string(),
    line: () => z.string(),
    url: () => z.string().regex(/^https:\/\/\S+$/),
    value: ({ min, max }) => z.number().min(min).max(max),
    int: ({ min, max }) => z.int32().min(min).max(max),
    check: () => z.boolean(),
} satisfies {
    [K in editableType]: (config: EditableTypeConfig[K]) => z.ZodTypeAny
};

function _nonEmptyTuple(arr: string[]): [string, ...string[]] {
    if (arr.length === 0)
        throw new IllegalArgumentError("A 'list' type field must have at least one valid option");
    return arr as [string, ...string[]];
}

const editableTypeKeys = Object.keys(makeSchema) as [editableType, ...editableType[]];
const editableTypeSchema = z.enum(editableTypeKeys);

export type editableType = keyof EditableTypeConfig;
export type editableSchema = ReturnType<(typeof makeSchema)[editableType]>;
export type editableValue = z.infer<editableSchema>;
export type editableConfig = EditableTypeConfig[editableType];

const editableInputs = {
    checklist: (name, initValue, { options }) =>
        `<false-select name="${name}">${options.map(o =>
            `<option value="${escapeHtml(o)}" ${initValue.includes(o) ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')
        }</false-select>`,
    list: (name, initValue, { options }) =>
        `<select name="${name}">${options.map(o =>
            `<option value="${escapeHtml(o)}" ${o === initValue ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')
        }</select>`,
    paragraph: (name, initValue) => `<textarea name="${name}">${escapeHtml(initValue)}</textarea>`,
    line: (name, initValue) => `<input type="text" name="${name}" value="${escapeHtml(initValue)}" />`,
    url: (name, initValue) => `<input type="url" pattern="https://.*" name="${name}" value="${escapeHtml(initValue)}" />`,
    value: (name, initValue, { max, min }) => `<input type="number" min="${min}" max="${max}" name="${name}" value="${initValue}" />`,
    int: (name, initValue, { max, min }) => `<input type="number" step="1" min="${min}" max="${max}" name="${name}" value="${initValue}" />`,
    check: (name, initValue) => `<input type="checkbox" name="${name}" ${initValue ? 'checked' : ''} />`,
} satisfies {
    [K in editableType]: (
        name: string,
        initValue: z.infer<ReturnType<(typeof makeSchema)[K]>>,
        config: EditableTypeConfig[K]
    ) => string
};

/**
 * Represents the schema of each descriptor (JSON-like)
 * while in the register.
 */
const editableEntrySchema = z.object({
    label: z.string(),
    type: editableTypeSchema,
    config: z.record(z.string(), z.unknown()),
    defVal: z.any(),
    deprecated: z.boolean().optional()
});

/** 
 * Schema for the register of all the descriptors.   
 * This shape is used to aid in the creation of a map. 
 */
const allEditablesSchema = z.array(
    z.tuple([
        dbTypeSchema,
        z.array(editableEntrySchema)
    ])
);

type editableEntry = z.infer<typeof editableEntrySchema>;

// PRIVATE HELPERS ====================================================
/**
 * Helper to build a value-parsing zod schema for an editable field descriptor;
 * the casts are necessary to move from the generic union type of `makeSchema`
 * to an intersection type
 * 
 * @param type - Editable's type as a string.
 * @param config - Descriptor's specific configuration (use empty {} if none is necessary).
 * @returns the zod schema to parse *values* for the descriptor.
 */
function _buildSchemaFor<K extends editableType>(type: K, config: EditableTypeConfig[K]): ReturnType<(typeof makeSchema)[K]> {
    const builder = makeSchema[type] as unknown as (c: EditableTypeConfig[K]) => ReturnType<(typeof makeSchema)[K]>;
    return builder(config);
}
/**
 * Helper to validate an editable field descriptor's configuration.
 * 
 * @param type - Editable's type as a string.
 * @param config - Configuration to parse based on the editable field type specified (not type checked).
 * @returns the parsed (and typed) configuration.
 */
function _parseConfigFor<K extends editableType>(type: K, config: unknown): EditableTypeConfig[K] {
    const parser = configSchemas[type] as unknown as z.ZodType<EditableTypeConfig[K]>;
    return parser.parse(config);
}
// CLASS ========================================================

export class EditableFieldDescriptor {
    // CLASS PRIVACY AND CACHING ===============================================
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    /**
     * Register containing all the arrays of editable field descriptors
     * assigned each to a specific database.
     */
    static #register: Map<dbType, EditableFieldDescriptor[]> | null = null;
    /** The loading register's promise; returns the register once fulfilled. */
    static #registerIsLoading: Promise<Map<dbType, EditableFieldDescriptor[]>> | null = null;
    
    /** Cached default objects for each database that has editable fields registered. */
    static readonly #defaultObjects = new Map<dbType, Record<editableEntry['label'], editableValue>>();

    // CLASS STATE DESCRIPTORS =================================================
    /** 
     * Await before starting any writing operation.   
     * If a writing operation starts, a promise should be 
     * stored here to ensure no concurrent writing operation starts.
     */
    static #writePermission: Promise<void> = Promise.resolve();
    /**
     * @param callback - A function that will be called once write permission has fulfilled.
     * @returns an empty promise that should be awaited to ensure completion of the operation.
     */
    static async #onWriteAllowed(callback: () => Promise<void>) {
        return this.#writePermission = this.#writePermission.then(callback);
    }

    // FINAL PROPERTIES =========================================================
    readonly #label: dataLabel;
    readonly #type: editableType;
    readonly #defaultVal: editableValue;
    /** 
     * Configuration options for the specific descriptor's instance.   
     * This data is only used for construction of the instance's schema from the base version.
     */
    readonly #config: editableConfig;
    readonly #schema: editableSchema;

    // STATE DESCRIPTORS =======================================================
    #deprecated?: true;

    // GETTERS ==================================================================
    /** Label of the descriptor. */
    get label() { return this.#label; }
    /** Editable field type (unrelated to database); determines the shape of the data that it is supposed to hold. */
    get type() { return this.#type; }
    /** Default value for the field. */
    get defaultVal() { return this.#defaultVal; }
    /** Schema enforced on the values held by the editable field. */
    get schema() { return this.#schema; }
    /** Boolean flag indicating whether the descriptor has been marked as deprecated. */
    get deprecated(): boolean { return this.#deprecated ?? false }

    // STARTUP =========================================================================
    private constructor(token: symbol, schema: editableSchema, label: string, type: editableType, config: EditableTypeConfig[editableType], defVal: editableValue, deprecated?: boolean) {
        // Enforce privacy
        if (token !== EditableFieldDescriptor.#constructionToken)
            throw new PrivateConstructorError("EditableFieldDescriptor", { init: { method: 'create', type: 'factory' } });

        this.#schema = schema;
        this.#label = label as dataLabel;
        this.#type = type;
        this.#defaultVal = defVal;
        this.#deprecated = deprecated ? true : undefined;
        this.#config = config;
    }

    /**
     * The constructor's helper.
     * 
     * Builds a descriptor from its base parameters 
     * (whether they are coming from its de-serialized self or a new instance).
     * 
     * Validates the configuration and schema.
     */
    static #of(desc: editableEntry) {
        const { label, type, config, defVal, deprecated } = desc;
        const validConfig = _parseConfigFor(type, config);
        const schema = _buildSchemaFor(type, validConfig);
        const validDefault = schema.parse(defVal);
        return new this(this.#constructionToken, schema, label, type, validConfig, validDefault, deprecated);
    }

    /**
     * Factory method for the class.   
     * Creates, validates and registers a new editable field descriptor for a database.
     * 
     * @param db - Database in whose registered array the descriptor will be placed.
     * @param desc - Object ontaining the parameter to use for creating the descriptor.
     * @returns the descriptor created.
     * 
     * @throws {DuplicateKeyError} If the label specified is already being used for another descriptor in the same array.
     */
    static async create(db: dbType, desc: { label: string, type: editableType, defVal: any, config: Record<string, unknown> }) {
        const validDesc = this.#of(desc);
        const register = await this.#ensureRegister();

        // Not using public methods `getAll` or `getByLabel` because 
        // "not found" throws but it's exactly what we want here.
        const editables = register.get(db);

        if (editables) {
            if (editables.find(ed => ed.#label === validDesc.#label))
                throw new DuplicateKeyError(`Cannot have two editable fields with the same label: ${validDesc.label} for db of type ${db}`);

            editables.push(validDesc);

        } else {
            register.set(db, [validDesc]);
        }

        this.#defaultObjects.delete(db);
        await this.#updateRegister();

        return validDesc;
    }

    // PUBLIC INTERFACE ==============================================================

    /** 
     * @param initValue - Value of the editable field at build-time.
     * @returns a html string containing a form input with the editable field's configuration set to the specified value.
     */
    public buildInput(initValue: editableValue): string {
        return (editableInputs[this.#type] as (n: string, v: any, c: any) => string)(this.#label, initValue, this.#config);
    }

    /** Serializes the descriptor in a JSON stringfy-able object */
    public toJSON(): editableEntry {
        return { label: this.#label, type: this.#type, defVal: this.#defaultVal, config: this.#config, deprecated: this.#deprecated };
    }

    // CLASS PERSISTENCE ============================================================

    /**
     * @returns the register of all the descriptors (as a promise).
     */
    static async #ensureRegister(): Promise<Map<dbType, EditableFieldDescriptor[]>> {
        if (this.#register) return this.#register;
        if (this.#registerIsLoading) return this.#registerIsLoading;

        return this.#registerIsLoading = readFile(editablesPath, 'utf-8')
            .then(file => JSON.parse(file))
            .then(rawData => allEditablesSchema.parseAsync(rawData))
            .then(edtbls =>
                this.#register = new Map(
                    edtbls.map(([db, desc]) => [db, desc.map(d => this.#of(d))])
                )
            )
            .catch((e: unknown) => {
                if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
                    Log.wrn(
                        'Cannot find editable fields register at ' + editablesPath
                        + '\nA new register has been initialized'
                        + '\nIf this is not expected outcome, please exit and verify paths'
                    );
                    return this.#register = new Map();
                }
                throw e;
            })
            .finally(() => { this.#registerIsLoading = null; });
    }

    /**
     * Enqueues a register update (a writing operation).
     * @returns a promise to await to the operation'completion.
     */
    static async #updateRegister(): Promise<void> {
        if (!this.#register)
            throw new IllegalStateError("Cannot update register without it having been loaded first");

        const register = this.#register;

        return this.#onWriteAllowed(async () => {
            const data = JSON.stringify(Array.from(register));
            const tmpPath = editablesPath + '.tmp';
            await writeFile(tmpPath, data, 'utf-8');
            await rename(tmpPath, editablesPath);
        });
    }

    // CLASS INTERFACE ==========================================================

    /**
     * Loads (if it is not already) the register of editable field descriptors
     * and returns the requested array of them for the specified 
     * database or initializes a new one.
     * 
     * @param db - Database identifier, each db has its own array of descriptors.
     * @returns a promise of the array of `EditableFieldDescriptor` belonging to the specified database;
     * if the database has no registered array, a new empty one is initialized and returned.
     * 
     * @remarks
     * A warning is generated if the register file did not exist at all; 
     * it will be initialized as empty.
     */
    static async getAllOrInit(db: dbType) {
        const register = await this.#ensureRegister();
        const dbOwnFields = register.get(db);
        if (dbOwnFields) return dbOwnFields;
        const init: EditableFieldDescriptor[] = []
        register.set(db, init);
        return init;
    }

    /**
     * Gets the array of editable field descriptors belonging to the specified database.
     * 
     * @param db - Database identifier with editable fields in the register.
     * @returns a promise with the array of `EditableFieldDescriptor` belonging to the specified database;
     * 
     * @throws {NotFoundError} If the database has no registered array.
     */
    static async getAll(db: dbType): Promise<EditableFieldDescriptor[]> {
        const register = await this.#ensureRegister();
        if (register.has(db)) return register.get(db)!
        throw new NotFoundError(db, { type: 'database entry in editable fields descriptors register with db type' })
    }

    /** 
     * Gets a specific field descriptor by a specified label
     * from the array of descriptors of the database.
     * 
     * @param db - Database identifier with editable fields in the register.
     * @param label - Label of the descriptor to get.
     * @returns the requested descriptor in a promise.
     * 
     * @throws {NotFoundError} If no editable field descriptor with the specified label was found.
     */
    static async getByLabel(db: dbType, label: string): Promise<EditableFieldDescriptor> {
        const maybes = await this.getAll(db);
        const found = maybes.find(desc => desc.#label === label);
        if (!found) throw new NotFoundError(label, { type: 'Editable field descriptor with label' })
        return found;
    }

    /**
     * Builds an object of editable fields belonging to a db 
     * with the default values specified in their descriptors;   
     * built objects are cached internally.
     * 
     * @warning  
     * For the same database, if no new field has been created,
     * this method will return *the same* default object unless
     * the parameter `clone` is set to `true`.   
     * Make sure to always clone it before use or it will corrupt future uses.
     * 
     * @param db - Database identifier with editable fields in the register.
     * @returns an object of editable fields belonging to a db 
     * with default values as specified in their descriptors.
     * 
     * @throws {NotFoundError} If the database has no array of descriptors in the register.
     */
    static async getDefaultObject(db: dbType, clone?: true) {
        const register = await this.#ensureRegister();
        if (!register.has(db))
            throw new NotFoundError(db, { type: 'database entry in editable fields descriptors register with db type' })

        if (this.#defaultObjects.has(db))
            return this.#defaultObjects.get(db)!;

        const result: Record<editableEntry['label'], editableValue> = {}
        register.get(db)!.forEach(ed => {
            result[ed.#label] = ed.#defaultVal;
        });
        this.#defaultObjects.set(db, result);
        return clone ? structuredClone(result) : result;
    }

    // CLASS LIMITED ACCESS INTERFACE =======================================================

    /**
     * Marks as deprecated a descriptor.
     * 
     * @param db - Database identifier with editable fields in the register.
     * @param desc - Editable field descriptor to deprecate.
     * @returns the deprecated descriptor (the same as the one passed).
     * 
     * @throws {IllegalAccessError} If the descriptor does not belong to the array registered for the database.
     */
    static async deprecate(db: dbType, desc: EditableFieldDescriptor) {
        const list = await this.getAll(db);
        const target = list.find(d => d === desc);
        if (target) {
            target.#deprecated = true;
            await this.#updateRegister();
            return target;
        }
        throw new IllegalAccessError(`Descriptor ${JSON.stringify(desc)} does not belong to db of type ${db}`);
    }

    /**
     * Deletes a descriptor from the register (this action has permanence).
     * 
     * @param db - Database identifier with editable fields in the register.
     * @param desc - Editable field descriptor to delete.
     * @returns the deleted descriptor (the same as the one passed).
     * 
     * @throws {IllegalAccessError} If the descriptor does not belong to the array registered for the database.
     */
    static async delete(db: dbType, desc: EditableFieldDescriptor) {
        const list = await this.getAll(db);
        const targetI = list.findIndex(d => d === desc);
        if (targetI >= 0) {
            const [res] = list.splice(targetI, 1);
            await this.#updateRegister();
            return res!;
        }
        throw new IllegalAccessError(`Descriptor ${JSON.stringify(desc)} does not belong to db of type ${db}`);
    }
}
