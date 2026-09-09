import type z from "zod";
import type { Brand } from "../../types/general-types.js";
import type { DBInitSchemas } from "./data-base-init.ts";
import type { _buildRecordsStoreSchema, dbStoreIdSchema, dbRecordInvSchema, dbRecordVersionsSchema } from "./data-base.ts";

// TYPES ======================================================================
export type dataLabel = Brand<string, 'label'>;

declare const primitiveSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
]);
export interface DataBaseInit {
    [database: string]: {
        readonly data: {
            [field: string]: z.ZodType;
        };
        readonly derived: {
            [field: string]: typeof primitiveSchema;
        };
    };
}
export type dbInitSchemas = typeof DBInitSchemas;

// TYPES FROM SCHEMAS ======================================================
export type dbType = keyof typeof DBInitSchemas;
export type dbDataSchemas<T extends dbType> = dbInitSchemas[T]['data'];
export type dbDerivedSchemas<T extends dbType> = dbInitSchemas[T]['derived'];
// DB-SPECIFIC SUB-STRUCTURES ==============================================
export type dbRecordsStore<T extends dbType> = z.infer<ReturnType<typeof _buildRecordsStoreSchema<T>>>;
export type dbRecord<T extends dbType> = dbRecordsStore<T>['records'][number];
// DB-SPECIFIC RECORD SHAPE ================================================
export type dbRecordData<T extends dbType> = dbRecord<T>['data'];
export type dbRecordEditables<T extends dbType> = dbRecord<T>['editables'];
// DB-AGNOSTIC TYPES =======================================================
export type dbStoreId = z.infer<typeof dbStoreIdSchema>;
export type dbRecordInv = z.infer<typeof dbRecordInvSchema>;
export type dbRecordVersions = z.infer<typeof dbRecordVersionsSchema>;
export type dbRecordVersion = dbRecordVersions[number];
