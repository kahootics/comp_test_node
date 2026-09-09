import { describe, test, expect, beforeAll, vi } from 'vitest';
import z from 'zod';
import { formatList, escapeHtml } from '../../../../src/tools/string-parsers.js';
import { reservedKeywords } from '../../../../src/scripts/node/db/data-base.js';
import { _unpackDataSchema } from '../../../../src/scripts/node/db/views/helpers/unpack-data-schema.js';
import { RowsBuilder } from '../../../../src/scripts/node/db/views/rows-builder.js';
import type { dbType } from '../../../../src/scripts/node/db/data-base-types.d.js';
import type { FlatRecord } from '../../../../src/scripts/node/db/records/flat-record.js';
import { EditableFieldDescriptor } from '../../../../src/scripts/node/db/editable-field.js';

vi.mock('../../../../src/tools/console.js', () => ({
    Log: { msg: vi.fn(), file: vi.fn(), wrn: vi.fn() },
}));

vi.mock('../../../../src/tools/string-parsers.js', () => {
    const formatList = (...chops: string[]) => chops.join('||||');
    const escapeHtml = (o: string) => o;
    // Nothing will actually run in a browser; 
    // no need to escape
    return { formatList, escapeHtml }
});

vi.mock('../../../../src/scripts/node/db/data-base.js',
    async (importOriginal) => {
        const actual = await importOriginal() as typeof import('../../../../src/scripts/node/db/data-base.js');
        return {
            ...actual,
            reservedKeywords: {
                type: z.string(),
                versions: z.array(z.string()),
                storeId: z.string(),
                inv: z.string()
            }
        }
    })

// NOTES:
// * These tests run in a node setting, 
//   therefore it is not possible to 
//   validate their behaviour in browser.

vi.mock('node:fs/promises', () => {
    const store = new Map<string, string>();
    return {
        writeFile: async (path: string, data: string) => { store.set(path, data); },
        readFile: async (path: string) => {
            const val = store.get(path);
            if (val === undefined) {
                const err: any = new Error('ENOENT');
                err.code = 'ENOENT';
                throw err;
            }
            return val;
        },
        rename: async (oldPath: string, newPath: string) => {
            const val = store.get(oldPath);
            if (val !== undefined) { store.set(newPath, val); store.delete(oldPath); }
        },
    };
});
vi.mock('../../../src/config/db-config.mjs', () => ({
    default: { editablesPath: 'rows-builder-test-editables.json' },
}));

const TEST_DB = 'ROWT' as dbType;

/**
 * Function to reconstruct `UnmodifiableColumnDescriptor` path (private)
 * using a proxy to register accesses to properties made by `getValue` 
 * and rebuild the path.
 */
function _recordAccessPath(): { proxy: object; getPath: () => string[] } {
    const path: string[] = [];
    function makeProxy(): object {
        return new Proxy({}, {
            get(_target, prop) {
                if (typeof prop === 'string') {
                    path.push(prop);
                    return makeProxy();
                }
                return undefined;
            },
        });
    }
    return { proxy: makeProxy(), getPath: () => path };
}
function _getColumnPath(col: { getValue(obj: object): unknown }): string[] {
    const { proxy, getPath } = _recordAccessPath();
    col.getValue(proxy);
    return getPath();
}

/** Descriptors of "base" (reserved keywords) columns. */
const baseDescriptors = _unpackDataSchema(reservedKeywords);
const basePaths = baseDescriptors.map(_getColumnPath);

/**
 * Builds a FlatRecord and initializes to default any base field
 * not given to the function.
 */
function buildFakeRecord(opts: {
    data: Record<string, unknown>;
    editables: Record<string, unknown>;
    storeId?: string;
    inv?: string;
}): FlatRecord<dbType> {
    const record: any = {};
    basePaths.forEach((path, i) => {
        _setPath(record, path, `BASE(${baseDescriptors[i]!.label})`);
    });
    record.type = TEST_DB;
    record.storeId = opts.storeId ?? 'store-1';
    record.inv = opts.inv ?? 'A1B';
    record.data = opts.data;
    record.editables = opts.editables;
    return record as FlatRecord<dbType>;
}
function _setPath(obj: any, path: string[], value: unknown) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]!;
        if (typeof cur[key] !== 'object' || cur[key] === null) cur[key] = {};
        cur = cur[key];
    }
    cur[path[path.length - 1]!] = value;
}

// SHARED STATE =====================================

let lineField: EditableFieldDescriptor;
let checklistField: EditableFieldDescriptor;

let simpleBuilder: RowsBuilder;
let noEditableBuilder: RowsBuilder;
let buildFormBuilder: RowsBuilder;
let nestedBuilder: RowsBuilder;
let nullableBuilder: RowsBuilder;

beforeAll(async () => {
    lineField = await EditableFieldDescriptor.create(TEST_DB, {
        label: 'note', type: 'line', defVal: '', config: {},
    });
    checklistField = await EditableFieldDescriptor.create(TEST_DB, {
        label: 'tags_ed', type: 'checklist', defVal: [], config: { options: ['x', 'y', 'z'] },
    });

    simpleBuilder = new RowsBuilder(
        TEST_DB,
        { name: z.string(), number: z.number(), list: z.array(z.string()) },
        [lineField, checklistField],
    );

    noEditableBuilder = new RowsBuilder(TEST_DB, { name: z.string() }, []);

    buildFormBuilder = new RowsBuilder(
        TEST_DB,
        { name: z.string() },
        [lineField, checklistField],
        true,
    );

    nestedBuilder = new RowsBuilder(
        TEST_DB,
        { title: z.string(), nestedTags: z.array(z.object({ name: z.string() })) },
        [lineField],
    );

    nullableBuilder = new RowsBuilder(TEST_DB, { tag: z.string().nullable() }, []);
});

describe('RowsBuilder - setup and validation', () => {
    test('simple build for valid schemas', () => {
        expect(simpleBuilder).toBeInstanceOf(RowsBuilder);
    });

    test('throws when an editabile field shares the same label with an immutable field', () => {
        const dataSchema = { note: z.string() };
        expect(() => new RowsBuilder(TEST_DB, dataSchema, [lineField])).toThrowWithName('IllegalArgumentError');
    });

    test('throws when an editabile field shares the same label with a "base" field (uses a reserved keyword)', async () => {
        const baseLabel = baseDescriptors[0]!.label;
        const collision = await EditableFieldDescriptor.create(TEST_DB, {
            label: baseLabel, type: 'line', defVal: '', config: {},
        });
        expect(() => new RowsBuilder(TEST_DB, {}, [collision])).toThrowWithName('IllegalArgumentError');
    });

    test('throws when an immutable field has two arrays of objects at the same flattened level (layer)', () => {
        const dataSchema = {
            l1: z.array(z.object({ id: z.string() })),
            l2: z.array(z.object({ id: z.string() })),
        };
        expect(() => new RowsBuilder(TEST_DB, dataSchema, [])).toThrowWithName('IllegalArgumentError');
    });
});

describe('RowsBuilder - getHeaderRow', () => {
    test('holds all the labels of the schema received and the base ones', () => {
        const header = simpleBuilder.getHeaderRow();
        for (const label of baseDescriptors.map(c => c.label)) {
            expect(header).toContain(label);
        }
        expect(header).toContain('name');
        expect(header).toContain('list[]');
        expect(header).toContain('note');
        expect(header).toContain('tags_ed');
    });

    test('the columns always follow the same order: base | unmodifiable | editables', () => {
        const header = simpleBuilder.getHeaderRow();
        const idxBase = header.indexOf(baseDescriptors[0]!.label);
        const idxStatica = header.indexOf('name');
        const idxEditabile = header.indexOf('note');
        expect(idxBase).toBeLessThan(idxStatica);
        expect(idxStatica).toBeLessThan(idxEditabile);
    });

    test('repetead calls return the same result (cached)', () => {
        expect(simpleBuilder.getHeaderRow()).toEqual(simpleBuilder.getHeaderRow());
    });
});

describe('RowsBuilder - makeRows: validation', () => {
    test('throws IllegalAccessError if the record belongs to a different database than the one specified', () => {
        const record = { type: 'WRNG', storeId: 's', inv: 'i', data: {}, editables: {} } as unknown as FlatRecord<dbType>;
        expect(() => [...noEditableBuilder.makeRows(record)]).toThrowWithName('IllegalAccessError');
    });
});

describe('RowsBuilder - makeRows: no-nesting case', () => {
    test('yields one line and no more', () => {
        const record = buildFakeRecord({
            data: { name: 'Mario', number: 42, list: ['a', 'b'] },
            editables: { note: 'a note', tags_ed: ['x', 'z'] },
        });
        const rows = [...simpleBuilder.makeRows(record)];
        expect(rows).toHaveLength(1);
    });

    test('the line has data-* attributes holding the identifiers of the record', () => {
        const record = buildFakeRecord({
            data: { name: 'Mario', number: 42, list: [] },
            editables: { note: '', tags_ed: [] },
            storeId: 'blob-42',
            inv: 'XYZ',
        });
        const [row] = [...simpleBuilder.makeRows(record)];
        expect(row).toContain(`data-db-type="${TEST_DB}"`);
        expect(row).toContain('data-store-id="blob-42"');
        expect(row).toContain('data-record-inv="XYZ"');
    });

    test('unmodifiable primitive data show up in the row', () => {
        const record = buildFakeRecord({
            data: { name: 'Mario', number: 42, list: [] },
            editables: { note: '', tags_ed: [] },
        });
        const [row] = [...simpleBuilder.makeRows(record)];
        expect(row).toContain('Mario');
        expect(row).toContain('42');
    });

    test('an array of primitives is flattened', () => {
        const valori = ['a', 'b', 'c'];
        const record = buildFakeRecord({
            data: { name: 'X', number: 1, list: valori },
            editables: { note: '', tags_ed: [] },
        });
        const [row] = [...simpleBuilder.makeRows(record)];
        expect(row).toContain(formatList(valori.map(String)));
    });

    test('a "null" value is rendered as an empty string ("")', () => {
        const record = buildFakeRecord({ data: { tag: null }, editables: {} });
        const [row] = [...nullableBuilder.makeRows(record)];
        expect(row).not.toMatch(/\bnull\b/);
        expect(row).toMatch(/\b\b/);
    });

    test('with buildForm set to false, an editable field is rendered following the same rules as other primitive data', () => {
        const record = buildFakeRecord({
            data: { name: 'X', number: 1, list: [] },
            editables: { note: 'text', tags_ed: ['x', 'y'] },
        });
        const [row] = [...simpleBuilder.makeRows(record)];
        expect(row).toContain(formatList(['x', 'y']));
        expect(row).not.toContain('<false-select');
        expect(row).not.toContain('<input');
    });
});

describe('RowsBuilder - makeRows: buildForm=true', () => {
    // NOTE: Testing here is only about the builder ouputting
    // inputs; single inputs are tested in the editables descriptors test file
    test('an editable "line" is rendered as a text input with the value of the record for thet field', () => {
        const record = buildFakeRecord({
            data: { name: 'X' },
            editables: { note: 'val-note', tags_ed: [] },
        });
        const [row] = [...buildFormBuilder.makeRows(record)];
        expect(row).toContain('type="text"');
        expect(row).toContain('name="note"');
        expect(row).toContain('val-note');
    });

    test('an editable "checklist" is rendered with a false-select', () => {
        const record = buildFakeRecord({
            data: { name: 'X' },
            editables: { note: '', tags_ed: ['y'] },
        });
        const [row] = [...buildFormBuilder.makeRows(record)];
        expect(row).toContain('<false-select');
        expect(row).toContain('name="tags_ed"');
    });
});

describe('RowsBuilder - makeRows: array of objects resolution', () => {

    test('yields a row for each primitive value of the object in the nested array', () => {
        const record = buildFakeRecord({
            data: {
                title: 'Greek Lttrs', nestedTags: [
                    { name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }
                ]
            },
            editables: { note: 'this is a test' },
        });
        const rows = [...nestedBuilder.makeRows(record)];

        expect(rows).toHaveLength(3);
        expect(rows[0]).toContain('Alpha');
        expect(rows[1]).toContain('Beta');
        expect(rows[2]).toContain('Gamma');

    });

    test('only the first row contains the base and editable fields '
        + 'with rowspan matching the overall rows number',
        () => {
            const record = buildFakeRecord({
                storeId: 'A4C',
                data: {
                    title: 'Greek Lttrs', nestedTags: [
                        { name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }
                    ]
                },
                editables: { note: 'this is a test' },
            });
            const rows = [...nestedBuilder.makeRows(record)];


            expect(rows[0]).toContain('Greek Lttrs');
            expect(rows[0]).toContain('A4C'); // base field
            expect(rows[0]).toContain('this is a test');
            expect(rows[0]).toContain('rowspan="3"');

            expect(rows[1]).toContain('Greek Lttrs');
            expect(rows[1]).not.toContain('A4C'); // base field
            expect(rows[1]).not.toContain('this is a test');
            expect(rows[1]).not.toContain('rowspan="3"');

            expect(rows[2]).toContain('Greek Lttrs');
            expect(rows[2]).not.toContain('A4C'); // base field
            expect(rows[2]).not.toContain('this is a test');
            expect(rows[2]).not.toContain('rowspan="3"');

        }
    );

    test('only the first row has the identifying attributes of the record', () => {
        const record = buildFakeRecord({
            data: {
                title: 'Greek Lttrs', nestedTags: [
                    { name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }
                ]
            },
            editables: { note: 'this is a test' },
        });
        const rows = [...nestedBuilder.makeRows(record)];

        expect(rows[0]).toContain(`data-db-type="${TEST_DB}"`);
        expect(rows[1]).not.toContain('data-db-type=');
        expect(rows[2]).not.toContain('data-db-type=');

    }
    );

    test('an empty array of objects returns a placeholder line, without throwing', () => {
        const record = buildFakeRecord({
            data: { title: 'Solo', nestedTags: [] },
            editables: { note: 'Present' },
        });
        const rows = [...nestedBuilder.makeRows(record)];
        expect(rows).toHaveLength(1);
        expect(rows[0]).toContain('Solo');
        expect(rows[0]).toContain('Present');
    });

    test('an array of objects with only one object with only one primitive value produces one line', () => {
        const record = buildFakeRecord({
            data: { title: 'Solo', nestedTags: [{ name: 'Justme' }] },
            editables: { note: 'X' },
        });
        const rows = [...nestedBuilder.makeRows(record)];
        expect(rows).toHaveLength(1);
        expect(rows[0]).toContain('Justme');
    });
});