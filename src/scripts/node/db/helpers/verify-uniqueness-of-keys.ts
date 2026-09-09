import { DuplicateKeyError } from "../../../../errors/common-errors.mjs";
import { duplicatesOfStringList, formatList } from "../../../../tools/string-parsers.js";
import { reservedKeywords, _isReservedKeyword } from "../data-base.js";
import type { dbType } from "../data-base-types.d.js";

/**
 * Validates the uniqueness of a database records keys from the three constituents schemas.
 * 
 * @remarks
 * Checks whether every key from the database schemas (immutable, derived and editable)
 * is unique (used exactly once across all three schemas) and if it is not a
 * reserved keyword; throws if a duplicate or illicit usage of reserved key is found.
 * 
 * @param type - Database identifier.
 * @param immutableFieldsKeys - An iterable of the keys for the immutable fields of the database's records.
 * @param derivedFieldsKeys - An iterable of the keys for the derived fields of the database's records.
 * @param editableFieldsKeys - An iterable of the keys for the editable fields of the database's records.
 * 
 * @throws {DuplicateKeyError} - If either a reserved keyword is used for a field or if a key is used for more than one field.
 * @throws {AggregateError<DuplicateKeyError>} - If the above occurence verifies more than once.
 */
export function _verifyUniquenessOfKeys(
    type: dbType,
    immutableFieldsKeys: Iterable<string>,
    derivedFieldsKeys: Iterable<string>,
    editableFieldsKeys: Iterable<string>) {
    const immutableFields = new Set(immutableFieldsKeys);
    const derivedFields = new Set(derivedFieldsKeys);
    const editableFields = new Set(editableFieldsKeys);

    const duplicateKeys = duplicatesOfStringList([
        ...Object.keys(reservedKeywords),
        ...immutableFields,
        ...derivedFields,
        ...editableFields
    ]);

    if (duplicateKeys.size === 0) return;

    // There are duplicates:
    const dupErrors = Array.from(duplicateKeys).map(duplicate => {

        const culprits: string[] = [];
        if (immutableFields.has(duplicate)) culprits.push('unmodifiable fields');
        if (derivedFields.has(duplicate)) culprits.push('derived fields');
        if (editableFields.has(duplicate)) culprits.push('editable fields');

        // There should be at least one
        if (_isReservedKeyword(duplicate))
            return new DuplicateKeyError(`Cannot use a reserved keyword "${duplicate}" as label in ${formatList(culprits)} of db ${type}`);

        // Two then
        return new DuplicateKeyError(
            `Duplicate key "${duplicate}" in db ${type} used as label in ${formatList(culprits)}`
        );
    });

    throw dupErrors.length === 1
        ? dupErrors[0]!
        : new AggregateError(dupErrors);

}
