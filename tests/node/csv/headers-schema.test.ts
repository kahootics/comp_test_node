import { describe, test, expect } from 'vitest';
import { HeadersSchema } from '../../../src/scripts/node/csv/headers-schema.js';
import { dummy } from '../../setup.js';
import { CsvOptionalSymbols } from '../../../src/scripts/node/csv/csv-optional-symbols.js';

const defaultOptions = CsvOptionalSymbols.of({
    arrayIndicator: '[]',
    objectNotation: '_',
    nestedObjArray: '[i]',
    arraySeparator: '|'
});

async function makeSchema(headers: string[]) {
    return HeadersSchema.from(headers, defaultOptions);
}

function parseAll(schema: HeadersSchema, rows: string[][]) {
    const results: Record<string, any>[] = [];
    for (const row of rows) {
        const r = schema.parse(row);
        if (r) results.push(r);
    }
    const last = schema.flush();
    if (last) results.push(last);
    return results;
}

describe('HeadersSchema - no nesting', () => {
    test('parses simple rows with no nesting markers', async () => {
        const schema = await makeSchema(['name', 'age']);
        const results = parseAll(schema, [
            ['Marcuccio', '30'],
            ['Ginuzzo', '25'],
        ]);
        expect(results).toEqual([
            { name: 'Marcuccio', age: 30 },
            { name: 'Ginuzzo', age: 25 },
        ]);
    });

    test('rejects a row whose length does not match the header count', async () => {
        const schema = await makeSchema(['name', 'age']);
        expect(() => schema.parse(['Antonellino'])).toThrowWithName('ValidationError');
    });

    test('rejects a duplicate identical row', async () => {
        const schema = await makeSchema(['name', 'age']);
        schema.parse(['Gerardo', '30']);
        expect(() => schema.parse(['Gerardo', '30'])).toThrowWithName('ValidationError');
    });
});

describe('HeadersSchema - with nesting (2 layers)', () => {
    const headers = [
    /* flat */  'type', 'formID', 'editorID', 'name', 'keywords[]', 'value', 'weight', 'ingredientValue',
/* 1st layer */ 'effects[i]', 'effects[i]_formID', 'effects[i]_magnitude', 'effects[i]_area', 'effects[i]_duration',
/* 2nd layer */ 'effects[i]_conditions[i]', 'effects[i]_conditions[i]_logic', 'effects[i]_conditions[i]_name',
    ];

    const rows = [
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '0', '0003EAEB', '3', '0', '60', '0', 'AND', 'example01'],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '0', '0003EAEB', '3', '0', '60', '1', 'AND', 'example02'],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '1', '00073F23', '2', '0', '10', '', '', ''],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '2', '00090041', '3', '0', '0', '', '', ''],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '3', '0003EB1E', '2', '0', '60', '', '', ''],
    ];

    const expected = [{
        type: 'INGR',
        formID: '000134AA',
        editorID: 'Thistle01',
        name: 'Thistle Branch',
        keywords: ['VendorItemIngredient'],
        value: 1,
        weight: 0.1,
        ingredientValue: 23,
        effects: [
            {
                formID: '0003EAEB', magnitude: 3, area: 0, duration: 60,
                conditions: [
                    { logic: 'AND', name: 'example01' },
                    { logic: 'AND', name: 'example02' },
                ],
            },
            { formID: '00073F23', magnitude: 2, area: 0, duration: 10, conditions: [] },
            { formID: '00090041', magnitude: 3, area: 0, duration: 0, conditions: [] },
            { formID: '0003EB1E', magnitude: 2, area: 0, duration: 60, conditions: [] },
        ],
    }];

    test('reconstructs the full nested object across all rows for a single record', async () => {
        const schema = await makeSchema(headers);
        const results = parseAll(schema, rows);
        expect(results).toEqual(expected);
    });

    test('yields nothing until a new flat identifier or flush() closes the group', async () => {
        const schema = await makeSchema(headers);
        for (const row of rows.slice(0, -1)) {
            expect(schema.parse(row)).toBeUndefined();
        }
        expect(schema.parse(rows[rows.length - 1]!)).toBeUndefined();
        expect(schema.flush()).toEqual(expected[0]);
    });

    test('flushes and starts a new record once the flat snapshot changes', async () => {
        const schema = await makeSchema(headers);
        for (const row of rows) schema.parse(row);

        const nextRecordFirstRow = [
            'INGR', '0002F44C', 'Nightshade', 'Nightshade', 'VendorItemIngredient', '8', '0.1', '53',
            '0', '0003EB42', '2', '0', '1', '', '', '',
        ];
        const finished = schema.parse(nextRecordFirstRow);
        expect(finished).toEqual(expected[0]);
    });

    test('rejects skipping an array index (gap between consecutive elements)', async () => {
        const schema = await makeSchema(headers);
        const badRow = [
            'INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23',
            '2', '00090041', '3', '0', '0', '', '', '', // effects index jumps straight to 2
        ];
        expect(() => schema.parse(badRow)).toThrowWithName('ValidationError');

        const rows1 = [
            ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '0', '0003EAEB', '3', '0', '60', '0', 'AND', 'example01'],
            ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '0', '0003EAEB', '3', '0', '60', '1', 'AND', 'example02'],
            ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '1', '00073F23', '2', '0', '10', '', '', ''],
            ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23', '3', '0003EB1E', '2', '0', '60', '', '', ''],
        ];
        expect(() => parseAll(schema, rows1)).toThrowWithName('ValidationError');
    });

    test('rejects two rows of the same nested index that disagree on a shared field', async () => {
        const schema = await makeSchema(headers);
        schema.parse(rows[0]!); // effects[0].formID = '0003EAEB'
        const conflicting = [
            'INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23',
            '0', 'DIFFERENT_ID', '3', '0', '60', '1', 'AND', 'example02',
        ];
        expect(() => schema.parse(conflicting)).toThrowWithName('ValidationError');
    });

    test('allows a partial with missing fields as long as it does not contradict the first one', async () => {
        const schema = await makeSchema(headers);
        schema.parse(rows[0]!); // sets effects[0] fully, plus conditions[0]
        const secondRowSameIndex = [
            'INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'VendorItemIngredient', '1', '0.1', '23',
            '0', '', '', '', '', '1', 'AND', 'example02', // effects[i] fields blank, only conditions[1] added
        ];
        expect(() => schema.parse(secondRowSameIndex)).not.toThrow();
    });

    test('reconstructs the full nested objects across all rows for two records', async () => {
        const rows1 = [
            ...rows,
            ['INGR', '0001B3BD', 'Snowberry', 'Snowberries', 'VendorItemFood|GiftFlower', '4', '0.1', '38', '0', '0003EAEA', '3', '0', '60', '', '', ''],
            ['INGR', '0001B3BD', 'Snowberry', 'Snowberries', 'VendorItemFood|GiftFlower', '4', '0.1', '38', '1', '0003EB29', '1', '0', '30', '0', 'AND', 'example01'],
            ['INGR', '0001B3BD', 'Snowberry', 'Snowberries', 'VendorItemFood|GiftFlower', '4', '0.1', '38', '2', '0003EAEB', '3', '0', '60', '', '', ''],
            ['INGR', '0001B3BD', 'Snowberry', 'Snowberries', 'VendorItemFood|GiftFlower', '4', '0.1', '38', '3', '0003EAEC', '3', '0', '60', '', '', '']
        ];

        const expected1 = [
            expected[0],
            {
                type: 'INGR',
                formID: '0001B3BD',
                editorID: 'Snowberry',
                name: 'Snowberries',
                keywords: ['VendorItemFood', 'GiftFlower'],
                value: 4,
                weight: 0.1,
                ingredientValue: 38,
                effects: [
                    { formID: '0003EAEA', magnitude: 3, area: 0, duration: 60, conditions: [] },
                    {
                        formID: '0003EB29', magnitude: 1, area: 0, duration: 30,
                        conditions: [
                            { logic: 'AND', name: 'example01' }
                        ]
                    },
                    { formID: '0003EAEB', magnitude: 3, area: 0, duration: 60, conditions: [] },
                    { formID: '0003EAEC', magnitude: 3, area: 0, duration: 60, conditions: [] },
                ],
            }
        ];

        const schema = await makeSchema(headers);
        const results = parseAll(schema, rows1);
        expect(results).toEqual(expected1);
    });

});

describe('HeadersSchema - with parallel nesting (1 layer each)', () => {
    const headers = [
    /* flat */  'type', 'formID', 'editorID', 'name',
/* A1 layer */  'effects[i]', 'effects[i]_formID', 'effects[i]_magnitude', 'effects[i]_area', 'effects[i]_duration',
/* B1 layer */  'conditions[i]', 'conditions[i]_logic', 'conditions[i]_name',
    ];

    const rows = [
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '0', '0003EAEB', '3', '0', '60', '', '', ''],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '1', '00073F23', '2', '0', '10', '', '', ''],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '2', '00090041', '3', '0', '0', '', '', ''],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '3', '0003EB1E', '2', '0', '60', '', '', ''],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '', '', '', '', '', '0', 'AND', 'example01'],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '', '', '', '', '', '1', 'OR', 'example02'],
    ];

    const expected = [{
        type: 'INGR',
        formID: '000134AA',
        editorID: 'Thistle01',
        name: 'Thistle Branch',
        effects: [
            { formID: '0003EAEB', magnitude: 3, area: 0, duration: 60, },
            { formID: '00073F23', magnitude: 2, area: 0, duration: 10 },
            { formID: '00090041', magnitude: 3, area: 0, duration: 0 },
            { formID: '0003EB1E', magnitude: 2, area: 0, duration: 60 },
        ],
        conditions: [
            { logic: 'AND', name: 'example01' },
            { logic: 'OR', name: 'example02' },
        ],
    }];

    test('reconstructs the full nested object across all rows for a single record', async () => {
        const schema = await makeSchema(headers);
        const results = parseAll(schema, rows);
        expect(results).toEqual(expected);
    });

    const expected1 = structuredClone(expected);
    expected1[0].conditions.push({ logic: 'OR', name: 'example03' })

    test('allows negative values for the index that is not being tracked', async () => {
        const schema = await makeSchema(headers);
        const results = parseAll(schema, [...rows,
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '-1', '', '', '', '', '2', 'OR', 'example03'],
        ]);
        expect(results).toEqual(expected1);
    });

    test('allows any value for the fields within the index that is not being tracked', async () => {
        const schema = await makeSchema(headers);
        const results = parseAll(schema, [...rows,
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', 'null', 'anything', 'can', 'be', 'here', '2', 'OR', 'example03'],
        ]);
        expect(results).toEqual(expected1);
    });
});

describe('HeadersSchema - with multiple records', () => {
    const headers = [
    /* flat */  'type', 'formID', 'editorID', 'name',
    /* layer */ 'effects[i]', 'effects[i]_formID', 'effects[i]_magnitude', 'effects[i]_area', 'effects[i]_duration',
    ];

    const rows = [
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '0', '0003EAEB', '3', '0', '60'],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '1', '00073F23', '2', '0', '10'],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '2', '00090041', '3', '0', '0'],
        ['INGR', '000134AA', 'Thistle01', 'Thistle Branch', '3', '0003EB1E', '2', '0', '60'],
        ['INGR', '000134AB', 'Thistle02', 'Thistle Branch', '0', '0003EAEB', '3', '0', '60'],
        ['INGR', '000134AB', 'Thistle02', 'Thistle Branch', '1', '00073F23', '2', '0', '10'],
        ['INGR', '000134AB', 'Thistle02', 'Thistle Branch', '2', '00090041', '3', '0', '0'],
    ];

    const expected = [{
        type: 'INGR',
        formID: '000134AA',
        editorID: 'Thistle01',
        name: 'Thistle Branch',
        effects: [
            { formID: '0003EAEB', magnitude: 3, area: 0, duration: 60, },
            { formID: '00073F23', magnitude: 2, area: 0, duration: 10 },
            { formID: '00090041', magnitude: 3, area: 0, duration: 0 },
            { formID: '0003EB1E', magnitude: 2, area: 0, duration: 60 },
        ]
    }, {
        type: 'INGR',
        formID: '000134AB',
        editorID: 'Thistle02',
        name: 'Thistle Branch',
        effects: [
            { formID: '0003EAEB', magnitude: 3, area: 0, duration: 60, },
            { formID: '00073F23', magnitude: 2, area: 0, duration: 10 },
            { formID: '00090041', magnitude: 3, area: 0, duration: 0 },
        ]
    }];

    test('reconstructs the full nested objects across all rows', async () => {
        const schema = await makeSchema(headers);
        const results = parseAll(schema, rows);
        expect(results).toEqual(expected);
    });

    test('throws if a record\'s identifier repeats after it has been fully parsed', async () => {
        const schema = await makeSchema(headers);
        expect(() => parseAll(schema, [...rows, rows[0]])).toThrowWithName('ValidationError');
    });
});