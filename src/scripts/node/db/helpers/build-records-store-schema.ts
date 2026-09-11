import z from "zod";
import type { dbType, dataLabel, dbDataSchemas, dbDerivedSchemas } from "../data-base-types.js";
import { dbStoreIdSchema, dbRecordInvSchema, dbRecordVersionsSchema } from "../base-field.js";
import type { editableSchema } from "../editables/editable-field.js";

/**
 * @param type - Database identifier; each store will be required to know the database it belongs to.
 * @param dataSchema - Zod schema to enforce on each record's immutable fields.
 * @param editablesSchemas - Zod schema to enforce on each record's editable fields.
 * @returns a zod schema to enforce on each store within the specified database.
 */
export function _buildRecordsStoreSchema<T extends dbType>(
    type: T,
    dataSchema: dbDataSchemas<T>,
    derivedSchema: dbDerivedSchemas<T>,
    editablesSchemas: { [key: dataLabel]: editableSchema; }
) {
    return z.object({
        // 4 characters to identify the database the record belongs to (case-sensitive!)
        type: z.literal(type),
        // A unique identifier among records in the same db 
        id: dbStoreIdSchema,

        // Array of records under the same ID; they differ in version and are therefore separated for contextual use
        records: z.array(z.object({
            // 3 characters to distinguish among records
            inv: dbRecordInvSchema,
            // A list of versions the data in this record is compatible for
            versions: dbRecordVersionsSchema,
            // bundle-dependent data
            data: z.object(/* Static Non-modifiable data goes in here */ dataSchema),

            derived: z.object(derivedSchema).partial().optional(),
            // bundle-dependent editable data
            editables: z.object(/* Editable data goes in here */ editablesSchemas)
        }))
    });
}
