import z from "zod";
import { writeFile, rename } from 'node:fs/promises'
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DuplicateKeyError, IllegalAccessError, IllegalArgumentError, IllegalStateError, NotFoundError } from "../../../errors/common-errors.mjs";
import { dbTypeSchema } from "./data-base.js";
import { Log } from "../../../tools/console.js";
import { escapeHtml } from "../../../tools/string-parsers.js";
import dbConfig from "../../../config/db-config.mjs";
import type { dbType } from "./data-base.js";

const { editablesPath } = dbConfig;

/**
 * 
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
 * Creates a schema for an editable to enforce on its data.
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

const editableEntrySchema = z.object({
    label: z.string(),
    type: editableTypeSchema,
    config: z.record(z.string(), z.unknown()),
    defVal: z.any(),
    deprecated: z.boolean().optional()
});

const allEditablesSchema = z.array(
    z.tuple([
        dbTypeSchema,
        z.array(editableEntrySchema)
    ])
);

type editableEntry = z.infer<typeof editableEntrySchema>

function _buildSchemaFor<K extends editableType>(type: K, config: EditableTypeConfig[K]): ReturnType<(typeof makeSchema)[K]> {
    const builder = makeSchema[type] as unknown as (c: EditableTypeConfig[K]) => ReturnType<(typeof makeSchema)[K]>;
    return builder(config);
}

function _parseConfigFor<K extends editableType>(type: K, config: unknown): EditableTypeConfig[K] {
    const parser = configSchemas[type] as unknown as z.ZodType<EditableTypeConfig[K]>;
    return parser.parse(config);
}

export class EditableFieldDescriptor {
    // CLASS PRIVACY AND CACHING ===============================================
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    static #register: Map<dbType, EditableFieldDescriptor[]> | null = null;
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
    readonly #label: string;
    readonly #type: editableType;
    readonly #defaultVal: editableValue;
    readonly #config: editableConfig;
    readonly #schema: editableSchema;

    // STATE DESCRIPTORS =================================================
    #deprecated?: boolean;

    // GETTERS ==================================================================
    get label() { return this.#label; }
    get type() { return this.#type; }
    get defaultVal() { return this.#defaultVal; }
    get deprecated() { return this.#deprecated ?? false }

    // STARTUP =========================================================================
    private constructor(token: symbol, schema: editableSchema, label: string, type: editableType, config: EditableTypeConfig[editableType], defVal: editableValue, deprecated?: boolean) {
        // Enforce privacy
        if (token !== EditableFieldDescriptor.#constructionToken)
            throw new PrivateConstructorError("EditableFieldDescriptor", { init: { method: 'create', type: 'factory' } });

        this.#schema = schema;
        this.#label = label;
        this.#type = type;
        this.#defaultVal = defVal;
        this.#deprecated = deprecated;
        this.#config = config;
    }

    static #of(desc: editableEntry) {
        const { label, type, config, defVal, deprecated } = desc;
        const validConfig = _parseConfigFor(type, config);
        const schema = _buildSchemaFor(type, validConfig);
        const validDefault = schema.parse(defVal);
        return new this(this.#constructionToken, schema, label, type, validConfig, validDefault, deprecated);
    }

    // PUBLIC INTERFACE ==============================================================

    getSchema() {
        return this.#schema;
    }
    buildInput(initValue: editableValue): string {
        return (editableInputs[this.#type] as (n: string, v: any, c: any) => string)(this.#label, initValue, this.#config);
    }

    public toJSON(): editableEntry {
        return { label: this.#label, type: this.#type, defVal: this.#defaultVal, config: this.#config, deprecated: this.#deprecated };
    }

    // CLASS PERSISTENCE ============================================================

    static async #ensureRegister(): Promise<Map<dbType, EditableFieldDescriptor[]>> {
        if (this.#register) return this.#register;
        try {
            const mod = await import(editablesPath, { with: { type: 'json' } });
            return allEditablesSchema.parseAsync(mod.default)
                .then(edtbls =>
                    this.#register = new Map(
                        edtbls.map(([db, desc]) =>
                            [db, desc.map(d => this.#of(d))]
                        )
                    )
                );
        } catch (e: any) {
            if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'ENOENT') {
                Log.wrn(
                    'Cannot find editable fields register at ' + editablesPath
                    + '\nA new register has been initialized'
                    + '\nIf this is not expected outcome, please exit and verify paths'
                )
                return this.#register = new Map();
            }
            throw e;
        }
    }

    static async #updateRegister(): Promise<void> {
        if (!this.#register)
            throw new IllegalStateError("Cannot update register without it having been loaded first");
        const data = JSON.stringify(Array.from(this.#register));
        const tmpPath = editablesPath + '.tmp';

        return this.#onWriteAllowed(async () => {
            await writeFile(tmpPath, data, 'utf-8');
            await rename(tmpPath, editablesPath);
        });
    }

    // CLASS INTERFACE ==========================================================

    static async getAllOrInit(db: dbType) {
        const register = await this.#ensureRegister();
        if (register.has(db)) return register.get(db)!
        const init: EditableFieldDescriptor[] = []
        register.set(db, init);
        return init;
    }

    static async getAll(db: dbType): Promise<EditableFieldDescriptor[]> {
        const register = await this.#ensureRegister();
        if (register.has(db)) return register.get(db)!
        throw new NotFoundError(db, { type: 'database entry in editable fields descriptors register with db type' })
    }
    static async getByLabel(db: dbType, label: string): Promise<EditableFieldDescriptor> {
        const maybes = await this.getAll(db);
        const found = maybes.find(desc => desc.#label === label);
        if (!found) throw new NotFoundError(label, { type: 'Editable field descriptor with label' })
        return found;
    }

    static async getDefaultObject(dbType: dbType) {
        const register = await this.#ensureRegister();
        if (!register.has(dbType))
            throw new NotFoundError(dbType, { type: 'database entry in editable fields descriptors register with db type' })

        if (this.#defaultObjects.has(dbType))
            return this.#defaultObjects.get(dbType)!;

        const result: Record<editableEntry['label'], editableValue> = {}
        register.get(dbType)!.forEach(ed => {
            result[ed.#label] = ed.#defaultVal;
        });
        this.#defaultObjects.set(dbType, result);
        return result;
    }

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

    // CLASS LIMITED ACCESS INTERFACE =======================================================

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
