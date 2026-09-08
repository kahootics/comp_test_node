import { describe, test, expect } from 'vitest';
import z from 'zod';
import { Admitted } from '../../../../../src/scripts/node/db/views/helpers/admitted-types.js';
import { PrimitiveUColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/primitive-u-column-descriptor.js';
import { NestableUColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/nestable-u-column-descriptor.js';
import { _unpackDataSchema } from '../../../../../src/scripts/node/db/views/helpers/unpack-data-schema.js';
import { dummy } from '../../../../setup.js';

const IllegalArgumentError = 'IllegalArgumentError';

// NOTE: Most test require to validate an object 
// as instance of a specific ColumnDescriptor subclass, 
// hence they are not mocked!

describe('_unpackDataSchema - base cases', () => {
    test('an empty shape unpacks to an empty array', () => {
        expect(_unpackDataSchema({})).toEqual([]);
    });

    test('a primitive field generates a PrimitiveUColumnDescriptor instance', () => {
        const [col] = _unpackDataSchema({ name: z.string() });
        expect(col).toBeInstanceOf(PrimitiveUColumnDescriptor);
        expect(col!.label).toBe('name');
        expect(col!.path).toEqual(['name']);
        expect(col!.type).toBe(Admitted.PRIMITIVE);
    });

    test('multiple primitive fields preserve their order of declaration in the object when unpacked', () => {
        const cols = _unpackDataSchema({ a: z.string(), b: z.number(), c: z.boolean() });
        expect(cols.map(c => c.label)).toEqual(['a', 'b', 'c']);
    });

    test('a nullable/optional field is unwrapped and its content is evaluated', () => {
        const cols = _unpackDataSchema({ nota: z.string().nullable() });
        expect(cols[0]!.type).toBe(Admitted.PRIMITIVE);
    });

    test('an array of primitives generates a descriptor with a label terminating with "[]"', () => {
        const [col] = _unpackDataSchema({ tag: z.array(z.string()) });
        expect(col).toBeInstanceOf(PrimitiveUColumnDescriptor);
        expect(col!.label).toBe('tag[]');
        expect(col!.path).toEqual(['tag']);
        expect(col!.type).toBe(Admitted.ARRAY_PRIMITIVE);
    });
});

describe('_unpackDataSchema - nesting objects (flattening)', () => {
    test('a field nested in an object is flattened to its primitive value with a label '
        + 'representing its position in the object separating each key with "_"',
        () => {
            const cols = _unpackDataSchema({ address: z.object({ city: z.string() }) });
            expect(cols).toHaveLength(1);
            expect(cols[0]!.label).toBe('address_city');
            expect(cols[0]!.path).toEqual(['address', 'city']);
        });

    test('an object with more fields produces a column descriptor for each of its fields (at the end of nesting)', () => {
        const cols = _unpackDataSchema({
            address: z.object({ city: z.string(), cap: z.string() }),
        });
        expect(cols.map(c => c.label)).toEqual(['address_city', 'address_cap']);
        expect(cols.map(c => c.path)).toEqual([
            ['address', 'city'],
            ['address', 'cap'],
        ]);
    });

    test('multi-level nesting is tracked by both the label and the path properties of the descriptor', () => {
        const cols = _unpackDataSchema({
            a: z.object({ b: z.object({ c: z.string() }) }),
        });
        expect(cols[0]!.label).toBe('a_b_c');
        expect(cols[0]!.path).toEqual(['a', 'b', 'c']);
    });

    test('non-nested fields and nested fields belonging to the same layer of flattening mantain their order of declaration', () => {
        const cols = _unpackDataSchema({
            name: z.string(),
            address: z.object({ city: z.string() }),
            active: z.boolean(),
        });
        expect(cols.map(c => c.label)).toEqual(['name', 'address_city', 'active']);
    });

    test('an empty object produces no descriptors (even when nested)', () => {
        // Only primitive values produce descriptors
        const cols = _unpackDataSchema({ empty: z.object({}) });
        expect(cols).toEqual([]);
    });
});

describe('_unpackDataSchema - arrays of onjects (multi-layer nesting)', () => {
    test('an array of objects produces a NestableUColumnDescriptor whose label always ends with "[i]"', () => {
        const [col] = _unpackDataSchema({
            tags: z.array(z.object({ name: z.string() })),
        });
        expect(col).toBeInstanceOf(NestableUColumnDescriptor);
        expect(col!.label).toBe('tags[i]');
        expect(col!.path).toEqual(['tags']);
    });

    test('the children of the nestable descriptor are the result of unpacking the shape of the array\'s element', () => {
        const [col] = _unpackDataSchema({
            tags: z.array(z.object({ name: z.string(), value: z.number() })),
        }) as [NestableUColumnDescriptor];
        expect(col.children.map(c => c.label)).toEqual(['tags[i]_name', 'tags[i]_value']);
        expect(col.children.every(c => c instanceof PrimitiveUColumnDescriptor)).toBe(true);
    });

    test('children of nestables are unpacked with their label continuing their parent\'s '
        + 'as if they were nested objects (the nesting suffix "[i]" distinguishes them)',
        () => {
            const [col] = _unpackDataSchema({
                tags: z.array(z.object({ name: z.string() })),
            }) as [NestableUColumnDescriptor];
            expect(col.children[0]!.label).toBe('tags[i]_name');
        }
    );

    test('children of nestables are unpacked with their path NOT continuing their parent\'s; '
        + ' their path is always local to the root of the shape of the element object',
        () => {
            const [col] = _unpackDataSchema({
                tags: z.array(z.object({ name: z.string() })),
            }) as [NestableUColumnDescriptor];
            expect(col.children[0]!.path).toEqual(['name']);
        }
    );

    test('a nestable nested within an object carries its label and path as expected by the other column descriptors', () => {
        const [col] = _unpackDataSchema({
            group: z.object({ tags: z.array(z.object({ name: z.string() })) }),
        }) as [NestableUColumnDescriptor];
        expect(col.label).toBe('group_tags[i]');
        expect(col.path).toEqual(['group', 'tags']);
    });

    test('an array of objects nested in the element of another array of objects is recursively unpacked', () => {
        const [col] = _unpackDataSchema({
            groups: z.array(z.object({
                name: z.string(),
                members: z.array(z.object({ id: z.string() })),
            })),
        }) as [NestableUColumnDescriptor];

        expect(col.label).toBe('groups[i]');
        const [childName, childMembr] = col.children;
        expect(childName!.label).toBe('groups[i]_name');
        expect(childMembr).toBeInstanceOf(NestableUColumnDescriptor);
        expect(childMembr!.label).toBe('groups[i]_members[i]');
        expect((childMembr as NestableUColumnDescriptor).children[0]!.label).toBe('groups[i]_members[i]_id');
    });

    test('an array of empty  object produces a childless nestable', () => {
        const [col] = _unpackDataSchema({
            vuoti: z.array(z.object({})),
        }) as [NestableUColumnDescriptor];
        expect(col.children).toEqual([]);
    });
});

describe('_unpackDataSchema - verify limit "max 1 nestable per layer"', () => {
    test('two arrays of objects at the same nesting level throw IllegalArgumentError', () => {
        expect(() =>
            _unpackDataSchema({
                list1: z.array(z.object({ id: z.string() })),
                list2: z.array(z.object({ id: z.string() })),
            })
        ).toThrowWithName(IllegalArgumentError);
    });

    test('two arrays of objects NOT at the same nesting level, but within the same flattened layer, throw IllegalArgumentError', () => {
        expect(() =>
            _unpackDataSchema({
                a: z.object({ list1: z.array(z.object({ id: z.string() })) }),
                b: z.object({ list2: z.array(z.object({ id: z.string() })) }),
            })
        ).toThrowWithName(IllegalArgumentError);
    });

    test('two arrays of objects one nested within the other\'s element do NOT throw, but generate another layer', () => {
        expect(() =>
            _unpackDataSchema({
                groups: z.array(z.object({
                    membri: z.array(z.object({ id: z.string() })),
                })),
            })
        ).not.toThrow();
    });

    test('the error message lists the conflicting fields by label', () => {
        expect(() =>
            _unpackDataSchema({
                list1: z.array(z.object({ id: z.string() })),
                list2: z.array(z.object({ id: z.string() })),
            })
        ).toThrow(/list1\[i\].*list2\[i\]|list2\[i\].*list1\[i\]/);
    });

    test('an array of objects does not conflict with primitive fields', () => {
        expect(() =>
            _unpackDataSchema({
                name: z.string(),
                tags: z.array(z.object({ id: z.string() })),
                active: z.boolean(),
            })
        ).not.toThrow();
    });
});

describe('_unpackDataSchema - zod', () => {
    // NOTE: due to internal implementation, a zod schema whose
    // def.type is 'array' will always be an instance of ZodArray
    // (likewise 'object'); this test mocks away this behaviour

    test('an array\'s element which is ARRAY_OBJECT (def.type === \'object\') is NOT an instance of ZodObject, throws', () => {
        const fakeEl = {
            def: { type: 'object' },
        } as unknown as z.ZodType;

        const falseArray = Object.assign(
            Object.create(z.ZodArray.prototype),
            { element: fakeEl, def: { type: 'array' } }
        ) as unknown as z.ZodType;

        expect(() => _unpackDataSchema({ field: falseArray })).toThrowWithName('IllegalStateError');
    });
});