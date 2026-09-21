import type { EditablesFor } from "../../data/db/editables-types.js";
import type { dbRecordData, dbRecordDerived, dbRecordInv, dbRecordVersions, dbStoreId, dbType } from "../node/db/data-base-types.js";

type dbEditableFields<T extends dbType> = EditablesFor[T];

export type record<T extends dbType> =
    dbRecordData<T> &
    dbRecordDerived<T> &
    dbEditableFields<T> & {
    id: dbStoreId,
    type: T,
    versions: dbRecordVersions,
    inv: dbRecordInv
}
