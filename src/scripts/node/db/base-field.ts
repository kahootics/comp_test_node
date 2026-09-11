import z from "zod";
import { DBInitSchemas } from "./data-base-init.js";
import type { dbType } from "./data-base-types.d.js";

// DATABASE TYPE =================================================================

/** Regular expression a databsse identifier must match. */
export const dbTypeRegEx = /^(?:[A-Z_]{4})$/;

/** Zod schema enforcing the database identifier shape. */
export const dbTypeSchema = z.string().regex(dbTypeRegEx) /* .brand('database') */.refine(
    (type) => Object.keys(DBInitSchemas).includes(type)
).transform(type => type as dbType);

const dbStoreIdRegEx = /^(?:[A-Z0-9]{5,6})$/;

export const dbStoreIdSchema = z.string().regex(dbStoreIdRegEx).brand('storeId');

export const dbRecordInvSchema = z.string().regex(/^(?:[A-Z0-9]{3})$/).brand('inv');

export const dbRecordVersionsSchema = z.array(z.string().nonempty()).nonempty();

export const reservedKeywords = Object.freeze({
    type: dbTypeSchema,
    versions: dbRecordVersionsSchema,
    storeId: dbStoreIdSchema,
    inv: dbRecordInvSchema
});

export function _isReservedKeyword(key: string) {
    return key === 'id' || Object.keys(reservedKeywords).includes(key);
}
