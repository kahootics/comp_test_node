import { ColumnDescriptor } from "./column-descriptor.js";
import type { RestrictedAdmittedType } from "../helpers/admitted-types.js";

export abstract class UnmodifiableColumnDescriptor<T extends RestrictedAdmittedType = RestrictedAdmittedType> extends ColumnDescriptor<T> {

    readonly #path: string[];

    constructor(label: string, path: string[], type: T) {
        super(label, false, type);
        this.#path = path;
    }

    override getValue(obj: object): unknown {
        return this.#path.reduce((acc: any, key) => acc?.[key], obj);
    }
}
