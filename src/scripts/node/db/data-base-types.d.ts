import type z from "zod";
import type { Brand } from "../../types/general-types.js";
import type { DBInitSchemas } from "./data-base-init.ts";
import type { dbStoreIdSchema, dbRecordInvSchema, dbRecordVersionsSchema } from "./base-field.ts";
import type { _buildRecordsStoreSchema } from "./helpers/build-records-store-schema.ts";
import type { ZodObject } from "zod";

// TYPES ======================================================================
export type dataLabel = Brand<string, 'label'>;

export interface DataBaseInit {
    [database: string]: {
        readonly data: {
            [field: string]: z.ZodType;
        };
        readonly derived: {
            [field: string]: z.ZodString | z.ZodNumber | z.ZodBoolean |
            z.ZodArray<z.ZodString | z.ZodNumber> |
            z.ZodObject<Readonly<{ [key: string]: z.ZodString | z.ZodNumber | z.ZodBoolean }>>;
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
export type dbRecordDerived<T extends dbType> = dbRecord<T>['derived'];
export type dbRecordEditables<T extends dbType> = dbRecord<T>['editables'];
// DB-AGNOSTIC TYPES =======================================================
export type dbStoreId = z.infer<typeof dbStoreIdSchema>;
export type dbRecordInv = z.infer<typeof dbRecordInvSchema>;
export type dbRecordVersions = z.infer<typeof dbRecordVersionsSchema>;
export type dbRecordVersion = dbRecordVersions[number];
