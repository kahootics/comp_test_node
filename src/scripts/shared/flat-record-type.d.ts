import type { dbRecordData, dbRecordDerived, dbRecordInv, dbRecordVersions, dbStoreId, dbType } from "../node/db/data-base-types.js";
import type { dbEditableFields } from "../node/db/editables/compiled-editable-fields.js";


export type record<T extends dbType> =
    dbRecordData<T> &
    dbRecordDerived<T> &
    dbEditableFields<T> & {
    id: dbStoreId,
    type: T,
    versions: dbRecordVersions,
    inv: dbRecordInv
}