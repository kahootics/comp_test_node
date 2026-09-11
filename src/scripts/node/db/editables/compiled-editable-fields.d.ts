import type { EditablesFor } from "../../../../data/db/editables-types.js";
import type { dbType } from "../data-base-types.js";


export type dbEditableFields<T extends dbType> = EditablesFor[T];
