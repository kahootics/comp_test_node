import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import { Admitted, _getAdmittedType, _unwrap, _compressPrimitives, } from '../../../../../src/scripts/node/db/views/helpers/admitted-types.js'

describe('Admitted', () => {
    test('has 4 symbol constants, each unique', () => {
        const values = Object.values(Admitted);
        expect(values).toHaveLength(4);
        values.forEach((v) => expect(typeof v).toBe('symbol'));

        const unique = new Set(values);
        expect(unique.size).toBe(4);
    });
});

describe('_unwrap', () => {
    test('returns the schema untouched if it does not implement an unwrap method', () => {
        const schema1 = z.string();
        expect(_unwrap(schema1)).toBe(schema1);
        const schema2 = z.object({ a: z.string() });
        expect(_unwrap(schema2)).toBe(schema2);
    });

    test('an array schema is always left untouched (excluded manually)', () => {
        // NOTE: ZodArray implements unwrap, 
        // so it is excluded from unwrapping
        const schema = z.array(z.string());
        expect(_unwrap(schema)).toBe(schema);
    });

    test('removes .optional() wrapping', () => {
        const inner = z.string();
        expect(_unwrap(inner.optional())).toBe(inner);
    });

    test('removes .nullable() wrapping', () => {
        const inner = z.number();
        expect(_unwrap(inner.nullable())).toBe(inner);
    });

    test('removes .default() wrapping', () => {
        const inner = z.string();
        expect(_unwrap(inner.default('x'))).toBe(inner);
    });

    test('recursively unwraps nested schemas', () => {
        const inner = z.number();
        const wrapped = inner.optional().nullable().default(1);
        expect(_unwrap(wrapped)).toBe(inner);
    });

});

describe('_compressPrimitives', () => {

    test.each([
        ['string', z.string()],
        ['number', z.number()],
        ['boolean', z.boolean()],
        ['int', z.int32()],
        ['enum', z.enum(['a', 'b'])],
    ] as const)('type %s is compressed into Admitted.PRIMITIVE', (_label, schema) => {
        expect(_compressPrimitives(schema)).toBe(Admitted.PRIMITIVE);
    });

    test.each([
        ['object', z.object({ a: z.string() })],
        ['array', z.array(z.string())]
    ] as const)('returns the original def.type for non-primitive schemas (%s)', (_label,schema) => {
        expect(_compressPrimitives(schema)).toBe(_label);
    });

    test('returns the original def.type for not supported schemas (bigint)', () => {
        expect(_compressPrimitives(z.bigint())).toBe('bigint');
    });

    test('unwraps the schema before assessing type', () => {
        const schema = z.string().optional().nullable();
        expect(_compressPrimitives(schema)).toBe(Admitted.PRIMITIVE);
        expect(_compressPrimitives(z.enum(['x', 'y']).nullable())).toBe(Admitted.PRIMITIVE);
    });

});

describe('_getAdmittedType', () => {

    describe('finds primitives:', () => {
        test.each([
            ['string', z.string()],
            ['number', z.number()],
            ['boolean', z.boolean()],
            ['int', z.int32()],
            ['enum', z.enum(['a', 'b'])],
            ['string nullable', z.string().nullable()],
            ['string optional', z.string().optional()],
        ])('returns Admitted.PRIMITIVE for a "%s" type schema', (_label, schema) => {
            expect(_getAdmittedType(schema)).toBe(Admitted.PRIMITIVE);
        });

        test('unwraps optional/nullable/default before classifying', () => {
            const schema = z.string().optional().nullable().default('x');
            expect(_getAdmittedType(schema)).toBe(Admitted.PRIMITIVE);
        });
    });


    describe('finds object:', () => {
        test('returns Admitted.OBJECT for an object schema', () => {
            const schema = z.object({ a: z.string(), b: z.number() });
            expect(_getAdmittedType(schema)).toBe(Admitted.OBJECT);
        });

        test('returns Admitted.OBJECT even if the object is wrapped', () => {
            const schema = z.object({ a: z.string() });
            const schemaO = schema.optional();
            const schemaN = schema.nullable();
            expect(_getAdmittedType(schemaO)).toBe(Admitted.OBJECT);
            expect(_getAdmittedType(schemaN)).toBe(Admitted.OBJECT);
        });

        test('returns Admitted.OBJECT even if the object is empty', () => {
            expect(_getAdmittedType(z.object({}))).toBe(Admitted.OBJECT);
        });

        test('does not return Admitted.OBJECT if the object is an array', () => {
            expect(_getAdmittedType(z.array(z.string()))).not.toBe(Admitted.OBJECT);
        });
    });

    describe('finds array:', () => {
        test('returns Admitted.ARRAY_PRIMITIVE for an array of strings', () => {
            expect(_getAdmittedType(z.array(z.string()))).toBe(Admitted.ARRAY_PRIMITIVE);
        });

        test('returns Admitted.ARRAY_PRIMITIVE for an array of number', () => {
            expect(_getAdmittedType(z.array(z.number()))).toBe(Admitted.ARRAY_PRIMITIVE);
        });

        test('returns Admitted.ARRAY_PRIMITIVE for an array of enum', () => {
            expect(_getAdmittedType(z.array(z.enum(['a', 'b'])))).toBe(Admitted.ARRAY_PRIMITIVE);
        });

        test('returns Admitted.ARRAY_PRIMITIVE even if the array is wrapped (optional)', () => {
            const schema = z.array(z.string()).optional().nullable();
            expect(_getAdmittedType(schema)).toBe(Admitted.ARRAY_PRIMITIVE);
        });

        test('returns Admitted.ARRAY_PRIMITIVE even if the element of the array is wrapped', () => {
            const schema = z.array(z.string().optional());
            expect(_getAdmittedType(schema)).toBe(Admitted.ARRAY_PRIMITIVE);
        });

        test('returns Admitted.ARRAY_OBJECT for an array of objects schema', () => {
            const schema = z.array(z.object({ a: z.string() }));
            expect(_getAdmittedType(schema)).toBe(Admitted.ARRAY_OBJECT);
        });

        test('returns Admitted.ARRAY_OBJECT even if the object is wrapped', () => {
            const schema = z.array(z.object({ a: z.string() }).optional());
            expect(_getAdmittedType(schema)).toBe(Admitted.ARRAY_OBJECT);
        });

        test('throws IllegalArgumentError for an array of arrays', () => {
            const schema = z.array(z.array(z.string()));
            expect(() => _getAdmittedType(schema)).toThrowWithName('IllegalArgumentError');
            expect(() => _getAdmittedType(schema)).toThrow(/neither a primitive nor an object/);
        });

        test('throws IllegalArgumentError if the element\'s type is not supported', () => {
            const schema = z.array(z.bigint());
            expect(() => _getAdmittedType(schema)).toThrowWithName('IllegalArgumentError');
        });

    });

    describe('finds unsupported type:', () => {
        test.each([
            ['bigint', z.bigint()],
            ['date', z.date()],
            ['map', z.map(z.string(), z.string())],
            ['tuple', z.tuple([z.string(), z.number()])],
            ['union', z.union([z.string(), z.number()])],
            ['record', z.record(z.string(), z.string())]
        ])('throws IllegalArgumentError for a schema of type "%s"', (_label, schema) => {
            expect(() => _getAdmittedType(schema as unknown as z.ZodType)).toThrowWithName('IllegalArgumentError');
        });

        test('the error message logs the unsupported def.type', () => {
            expect(() => _getAdmittedType(z.bigint())).toThrow(/This type of schema is not supported: bigint/);
        });
    });

});







