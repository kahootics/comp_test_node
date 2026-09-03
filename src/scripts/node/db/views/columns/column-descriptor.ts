import type { dataLabel } from "../../data-base.js";
import type { RestrictedAdmittedType } from "../helpers/admitted-types.js";

export abstract class ColumnDescriptor<T extends RestrictedAdmittedType = RestrictedAdmittedType> {
    readonly #label: dataLabel;
    readonly #editable: boolean;
    readonly #type: T;

    public get label() { return this.#label; }
    public get editable() { return this.#editable; }
    public get type() { return this.#type; };

    protected constructor(label: string, editable: boolean, type: T) {
        this.#label = label as dataLabel;
        this.#editable = editable;
        this.#type = type;
    }

    abstract getValue(obj: object): unknown;

}