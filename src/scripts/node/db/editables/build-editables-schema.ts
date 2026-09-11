import type { dataLabel } from "../data-base-types.js";
import type { EditableFieldDescriptor, editableSchema } from "./editable-field.js";


/**
 * Build the object that associates the labels of each
 * editable field descriptors of the database to their
 * schema (to enforce on the values).
 *
 * @param editables - Editable field descriptors of the database.
 * @returns the zod schema each record in the database must enforce on their editable fields.
 */
export function _buildEditablesSchema(editables: Iterable<EditableFieldDescriptor>) {
    const result: { [label: dataLabel]: editableSchema; } = {};
    for (const editable of editables) {
        result[editable.label] = editable.schema;
    }
    return result;
}
