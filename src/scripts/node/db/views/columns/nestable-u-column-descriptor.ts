import { IllegalArgumentError } from "../../../../../errors/common-errors.mjs";
import { UnmodifiableColumnDescriptor } from "./unmodifiable-column-descriptor.js";
import type { Admitted } from "../helpers/admitted-types.js";

export class NestableUColumnDescriptor extends UnmodifiableColumnDescriptor<typeof Admitted.ARRAY_OBJECT> {


    readonly #children: UnmodifiableColumnDescriptor[];

    constructor(label: string, path: string[], type: typeof Admitted.ARRAY_OBJECT, children?: UnmodifiableColumnDescriptor[]) {
        if (!children)
            throw new IllegalArgumentError(`A column representing the index of an array of objects must have children, but ${label} does not`);
        super(label, path, type);
        this.#children = children;
    }

    get children() { return this.#children; }
}
