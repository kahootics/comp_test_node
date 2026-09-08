import z from "zod";
import { IllegalArgumentError, IllegalStateError } from "../../../../../errors/common-errors.mjs";
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

/**
 * Recursively unpacks the shape of a zod schema to a flat array 
 * of column descriptors (@see {@link UnmodifiableColumnDescriptor})
 * to use as headers for tabular view of the data parsed by said schema.
 * 
 * @remarks
 * **Flattening rules by type of value in the shape**:
 * - a `primitive` or `array of primitives` field (here `primitives` refers to
 * a subset of primitive types as documented by {@link _getAdmittedType})  
 * is used to build the associated column descriptor;
 * - an `object` is recursively resolved into a set of column descriptors,
 * one for each primitive value or array (*case above or below*) found at the end of
 * the recursion's branchings paths; each descriptor holds memory of its 
 * position in a `path` property, while a label represents such path
 * as a string. 
 * - an `array of objects` is an array schema wrapping a z.object() schema:
 * the column descriptor for such an array is related to the index of
 * an object in the array while the object is unwrapped and resolved
 * separatedly as the case above and the descriptors generated are stored 
 * into a `children` property of the array's descriptor;
 * the paths of the children are resolved locally to the array, 
 * the labels are absolute (the `index` field is marked with '[i]').
 * 
 * @restrictions
 * Only one array of objects is allowed for each set of column descriptors;
 * this includes arrays on different branches of an object that are
 * flattened to the same level.
 *
 * @param obj - A shape of a zod schema (an object whose values are zod schemas).
 * @returns a flat array of column descriptors given in the same order as the fields are found in the object.
 *
 * @throws {IllegalArgumentError}:
 * - if a schema is found to have a type that is not admitted (@see {@link _getAdmittedType}), or
 * - if two or more fields are arrays of objects and are resoolved to the same level of flattening.
 */
export function _unpackDataSchema(obj: { [key: string]: z.ZodType; }) {
    return _unpackDataSchemaInner(obj);
}

/**
 * @see {@link _unpackDataSchema} for full documentation.
 * This function serves the purpose of hiding the `prefix` and `path` arguments
 * from the outer function user.
 * 
 * @param [prefix] - Prefix to the label (used internally to cumulate 
 * labels from recursion, but can be used to give a prefix to *each* label).
 * @param [path] - Path of object keys to follow in order to read the current value.
 */
function _unpackDataSchemaInner(obj: { [key: string]: z.ZodType; }, prefix?: string, path?: string[]) {
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
                    result.push(..._unpackDataSchemaInner(unwrapped.shape, label, thisPath));
                    break;
                }
                throw new IllegalStateError(`At ${label} the schema defined is of type 'object' but is not an instance of 'ZodObject'`);
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
                        throw new IllegalStateError(`Nested in array ${label
                    }, the element\'s schema defined is of type 'object' but is not an instance of 'ZodObject'`);

                    const childrensShape = childrensSchema.shape;
                    const dLabel = label + '[i]';
                    result.push(
                        new NestableUColumnDescriptor(
                            dLabel, thisPath, type, 
                            _unpackDataSchemaInner(childrensShape, dLabel)
                        )
                    );
                    break;
                }
                throw new IllegalStateError(`At ${label} the schema defined is of type 'array' but is not an instance of 'ZodArray'`);
            }
        }
    }
    _assertAtMostOneExpandable(result)
    return result;
}


