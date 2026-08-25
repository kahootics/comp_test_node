import { ValidationError } from '../../../../errors/common-errors.mjs';

export function assertInteger(index: number) {
    if (!Number.isInteger(index))
        throw new ValidationError(`An index value must be an integer, but ${index} is not`);
    return index;
}
