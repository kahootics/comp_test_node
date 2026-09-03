import { IllegalArgumentError } from "../../../../../errors/common-errors.mjs";
import z from "zod";
import type { Brand } from "../../../../types/general-types.js";

export const Admitted = {
    PRIMITIVE: Symbol('primitive') as Brand<symbol, 'primitive'>,
    ARRAY_PRIMITIVE: Symbol('array-primitive') as Brand<symbol, 'array-primitive'>,
    ARRAY_OBJECT: Symbol('array-object') as Brand<symbol, 'array-object'>,
    OBJECT: Symbol('object') as Brand<symbol, 'object'>
} as const;

type _A = typeof Admitted;
export type AdmittedType = _A[keyof _A];
export type RestrictedAdmittedType = Exclude<AdmittedType, typeof Admitted.OBJECT>;
export type PrimitivesAdmittedType = Exclude<RestrictedAdmittedType, typeof Admitted.ARRAY_OBJECT>


export function _getAdmittedType(schema: z.ZodType): AdmittedType {
    const unwrapped = _unwrap(schema);
    const type = _compressPrimitives(unwrapped);

    switch (type) {
        case Admitted.PRIMITIVE:
            return type;

        case 'array': {
            if (!(unwrapped instanceof z.ZodArray && unwrapped.element instanceof z.ZodType))
                throw new IllegalArgumentError(`A schema with def.type 'array' is not an instance of ZodArray: ${JSON.stringify(unwrapped.def)}`);

            const inner = _unwrap(unwrapped.element);
            if (_compressPrimitives(inner) === Admitted.PRIMITIVE) return Admitted.ARRAY_PRIMITIVE;
            if (inner.def.type === 'object') return Admitted.ARRAY_OBJECT;

            throw new IllegalArgumentError(`Type of schema is neither a primitive nor an object: def.type = ${inner.def.type}`);
        }

        case 'object': return Admitted.OBJECT;

        default: throw new IllegalArgumentError(`This type of schema is not supported: ${String(type)}`);
    }
}
export function _unwrap(schema: z.ZodType): z.ZodType {
    if ('unwrap' in schema && typeof (schema as any).unwrap === 'function') {
        return _unwrap((schema as any).unwrap());
    }
    return schema;
}
export function _compressPrimitives(schema: z.ZodType) {
    const unwrapped = _unwrap(schema);
    const type = unwrapped.def.type;
    switch (type) {
        case "string": case "number": case "boolean": case "int": case 'enum':
            return Admitted.PRIMITIVE;
        default:
            return type;
    }
}

