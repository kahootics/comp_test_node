import { ZodType } from "zod";
import { ValidationError } from "../../../../errors/common-errors.mjs";
import { DBInitSchemas } from "../data-base-init.js";
import { dbTypeRegEx } from "../data-base.js";
import type { dbType } from "../data-base-types.d.js";
import type { ZodRawShape } from "zod";

/**
 * Checks if an object could be a zod object's shape.
 * 
 * @param value - Object to validate.
 * @returns `true` if the given value is an object holding `ZodType` values.
 */
function _isZodShape(value: unknown): value is ZodRawShape {
    return (
        typeof value === "object" &&
        value !== null &&
        Object.values(value).every(
            (v) => v instanceof ZodType
        )
    );
}


/**
 * Broken-down version of the database identifier regular expression;
 * details the error by throwing a specific `ValidationError`.
 *
 * @param type - The database's identifier to validate.
 * 
 * @throws {ValidationError} If the type given:
 * - is not composed of 4 characters,
 * - has characters which are not all uppercase,
 * - contains special characters (except underscore "_") or numbers,
 * - does not contain zod shapes for the data and derived schemas.
 */
export function _validateDBIdentifier(type: string): asserts type is dbType {
    if (type.length !== 4)
        throw new ValidationError("A database identifier must have 4 characters: " + type);
    if (type.toUpperCase() !== type)
        throw new ValidationError("A database identifier must be composed of only uppercase characters: " + type);
    if (!(dbTypeRegEx.test(type)))
        throw new ValidationError("A database identifier cannot contain special characters or numbers: " + type);
    if (!(
        Object.keys(DBInitSchemas).includes(type) &&
        _isZodShape(DBInitSchemas[type as dbType]['data']) &&
        _isZodShape(DBInitSchemas[type as dbType]['derived'])
    )) throw new ValidationError("A database identifier must have an associated schema for its static data and derived data: " + type);
}
