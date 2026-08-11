import z from "zod";
import { writeFile } from 'node:fs/promises'
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { DuplicateKeyError, IllegalAccessError, IllegalArgumentError, IllegalStateError, NotFoundError } from "../../../errors/common-errors.mjs";
import { dbTypeSchema, root, type dbType } from "./data-base.js";

declare const DATA_OG_ATT: string // temp
const editablesPath = root + 'editdb/editables.json';

// Editable field will be created and modified at runtime
const editableSchemas = {
    list: z.array(z.string()),
    paragraph: z.string(),
    line: z.string(),
    value: z.number(),
    int: z.int32(),
    check: z.boolean()
} as const;

const editableTypeKeys = Object.keys(editableSchemas) as [editableType, ...editableType[]];
const editableTypeSchema = z.enum(editableTypeKeys);

export type editableType = keyof typeof editableSchemas;
export type editableSchema = typeof editableSchemas[editableType]
export type editableValue = z.infer<editableSchema>;

const inputInit = (name: string, initValue: string) => `name="${name}" ${DATA_OG_ATT}="${initValue}"`; // add html escape
const editableInputs: Record<editableType, (name: string, initValue: string, ...args: any[]) => string> = {
    list: (name, initValue, ...options) => `<select ${inputInit(name, initValue)} value="${initValue}" >${options}</select>`, // ignore
    paragraph: (name, initValue) => 'textarea',
    line: (name, initValue) => `text`, // ignore
    value: (name, initValue) => `<input ${inputInit(name, initValue)} type="number" value="${initValue}" />`,
    int: (name, initValue) => `<input ${inputInit(name, initValue)} type="number" step="1" value="${initValue}" />`,
    check: (name, initValue) => `<input ${inputInit(name, initValue)} type="checkbox" ${initValue ? 'checked' : ''} />`
};

const editableEntrySchema = z.object({
                label: z.string(),
                type: editableTypeSchema,
                defVal: z.any(),
                deprecated: z.boolean().optional()
            });

const allEditablesSchema = z.array(
    z.tuple([
        dbTypeSchema,
        z.array(editableEntrySchema        )
    ])
);

type editableEntry = z.infer<typeof editableEntrySchema>

export class EditableFieldDescriptor {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    static #register: Map<dbType, EditableFieldDescriptor[]> | null = null;

    readonly #label: string;
    readonly #type: editableType;
    readonly #defaultVal: editableValue;
    #deprecated?: boolean;

    get label() { return this.#label; }
    get type() { return this.#type; }
    get defaultVal() { return this.#defaultVal; }
    get deprecated() { return this.#deprecated ?? false }


    private constructor(token: symbol, label: string, type: editableType, defVal: editableValue, deprecated?: boolean) {
        // Enforce privacy
        if (token !== EditableFieldDescriptor.#constructionToken)
            throw new PrivateConstructorError("EditableFieldDescriptor", { init: { method: 'create', type: 'factory' } });

        this.#label = label;
        this.#type = type;
        this.#defaultVal = defVal;
        this.#deprecated = deprecated;
    }

    static #of(desc: editableEntry) {
        const { label, type, defVal, deprecated } = desc;
        const validDefault = editableSchemas[type].parse(defVal);
        return new this(this.#constructionToken, label, type, validDefault, deprecated);
    }

    public getSchema() {
        return editableSchemas[this.#type];
    }

    public buildInput(initValue: string) {
        return editableInputs[this.#type](this.#label, initValue);
    }

    toJSON() {
        return this.#deprecated ?
            { label: this.#label, type: this.#type, defVal: this.#defaultVal, deprecated: this.#deprecated }
            : { label: this.#label, type: this.#type, defVal: this.#defaultVal };
    }

    static async #ensureRegister(): Promise<Map<dbType, EditableFieldDescriptor[]>> {
        if (this.#register) return this.#register;
        const mod = await import(editablesPath, { with: { type: 'json' } });
        return allEditablesSchema.parseAsync(mod.default)
            .then(edtbls =>
                this.#register = new Map(
                    edtbls.map(([db, desc]) =>
                        [db, desc.map(d => this.#of(d))]
                    )
                )
            );
    }
    static async #updateRegister(): Promise<void> {
        if (!this.#register)
            throw new IllegalStateError("Cannot update register without it having been loaded first");
        const data = JSON.stringify(Array.from(this.#register));
        return writeFile(editablesPath, data, 'utf-8');
    }

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
        return found
    }

    static async create(db: dbType, desc: { label: string, type: editableType, defVal: any }) {
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

        await this.#updateRegister();
        return validDesc;
    }

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


