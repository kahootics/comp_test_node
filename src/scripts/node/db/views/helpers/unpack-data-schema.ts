import z from "zod";
import { IllegalArgumentError } from "../../../../../errors/common-errors.mjs";
import type { UnmodifiableColumnDescriptor } from "../columns/unmodifiable-column-descriptor.js";
import { PrimitiveUColumnDescriptor } from "../columns/primitive-u-column-descriptor.js";
import { NestableUColumnDescriptor } from "../columns/nestable-u-column-descriptor.js";
import { _unwrap, Admitted } from "./admitted-types.js";
import { _getAdmittedType } from "./admitted-types.js";

function _assertAtMostOneExpandable(columns: UnmodifiableColumnDescriptor[]) {
    const expandable = columns.filter(c => c.type === Admitted.ARRAY_OBJECT);
    if (expandable.length > 1) {
        throw new IllegalArgumentError(
            `Cannot resolve multiple nested arrays at the same level: ` +
            `${expandable.map(c => c.label).join(', ')}. Cannot resolve to row.`
        );
    }
}

export function _unpackDataSchema(obj: { [key: string]: z.ZodType; }, prefix?: string, path?: string[]) {
    path ??= [];
    const result: UnmodifiableColumnDescriptor[] = [];

    for (const [key, schema] of Object.entries(obj)) {

        const type = _getAdmittedType(schema);
        const thisPath = [...path, key];
        const label = prefix ? (prefix + '_' + key) : key;

        switch (type) {
            case Admitted.OBJECT: {
                const unwrapped = _unwrap(schema);
                // Objects are recursively unwrapped
                if (unwrapped instanceof z.ZodObject) {
                    result.push(..._unpackDataSchema(unwrapped.shape, label, thisPath));
                    break;
                }
                throw new IllegalArgumentError(`Expected 'object' type of schema, but it was not an instance of ZodObject for '${label}'`);
            }
            case Admitted.PRIMITIVE: {
                // Primitives and array of primitives are displayable values
                result.push(new PrimitiveUColumnDescriptor(label, thisPath, type));
                break;
            }
            case Admitted.ARRAY_PRIMITIVE: {
                // Primitives and array of primitives are displayable values
                result.push(new PrimitiveUColumnDescriptor(label + '[]', thisPath, type));
                break;
            }
            case Admitted.ARRAY_OBJECT: {
                const unwrapped = _unwrap(schema);
                // An array containing objects must unwrap the shape of its elements
                if (unwrapped instanceof z.ZodArray) {
                    const childrensSchema = unwrapped.element;
                    if (!(childrensSchema instanceof z.ZodObject))
                        throw new Error(); // expected objects nested into array

                    const childrensShape = childrensSchema.shape;
                    result.push(
                        new NestableUColumnDescriptor(
                            label + '[i]', thisPath, type, 
                            _unpackDataSchema(childrensShape)
                        )
                    );
                    break;
                }
                throw new Error();
            }
        }
    }
    _assertAtMostOneExpandable(result)
    return result;
}


