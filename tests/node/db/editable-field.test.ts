import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { dbType } from '../../../src/scripts/node/db/data-base.js';
import type { dummy } from "../../setup.js";

const SRC_EDITABLE_FIELD = '../../../src/scripts/node/db/editable-field.js';
const SRC_DB_CONFIG = '../../../src/config/db-config.mjs';
const SRC_CONSOLE_TOOL = '../../../src/tools/console.js';

const toDbType = (n: string) => n as dbType;

/** Store in-memory condiviso dal mock di fs, resettabile per test. */
let fsStore: Map<string, string>;
const wrn = vi.fn();
/**
 * Refreshes the tested module at each call
 * and allows to decide whether to keep 
 * the persistence created with the previous iteration.
 *
 * @param preserveStore - If `true`, the register
 * stored in the "disk" is not cleared and will keep
 * its contents.
 */
async function freshModule(preserveStore = false) {
    vi.resetModules();
    if (!preserveStore) fsStore = new Map();

    vi.doMock('node:fs/promises', () => ({
        writeFile: async (path: string, data: string) => {
            fsStore.set(path, data);
        },
        readFile: async (path: string) => {
            const val = fsStore.get(path);
            if (val === undefined) {
                const err: any = new Error(`ENOENT: no such file, ${path}`);
                err.code = 'ENOENT';
                throw err;
            }
            return val;
        },
        rename: async (oldPath: string, newPath: string) => {
            const val = fsStore.get(oldPath);
            if (val !== undefined) {
                fsStore.set(newPath, val);
                fsStore.delete(oldPath);
            }
        },
    }));

    vi.doMock(SRC_DB_CONFIG, () => ({
        default: { editablesPath: 'test-editables.json' },
    }));

    vi.doMock(SRC_CONSOLE_TOOL, () => ({
        Log: { wrn, err: vi.fn(), inf: vi.fn() },
    }));

    const mod = await import(SRC_EDITABLE_FIELD);
    return mod.EditableFieldDescriptor as typeof import('../../../src/scripts/node/db/editable-field.js').EditableFieldDescriptor;
}

beforeEach(() => {
    vi.doUnmock('node:fs/promises');
    vi.doUnmock(SRC_DB_CONFIG);
    vi.doUnmock(SRC_CONSOLE_TOOL);
});

describe('EditableFieldDescriptor - bootstrap', () => {
    test('if no register file exists, a new register is initialized; also initialized the array', async () => {
        const EFD = await freshModule();
        const result = await EFD.getAllOrInit(toDbType('TEST'));
        expect(result).toEqual([]);
        expect(wrn).toHaveBeenCalled()
    });

    test('if a register with the corresponding array exists, it is parsed and returned', async () => {
        const EFD1 = await freshModule();
        await EFD1.create(toDbType('TEST'), {
            label: 'Note',
            type: 'line',
            defVal: 'yoo',
            config: {},
        });

        // Reload without purging register
        const EFD2 = await freshModule(/* preserveStore */ true);
        const all = await EFD2.getAll(toDbType('TEST'));
        expect(all).toHaveLength(1);
        expect(all[0]!.label).toBe('Note');
        expect(all[0]!.type).toBe('line');
        expect(all[0]!.defaultVal).toBe('yoo');
        expect(all[0]!.deprecated).toBe(false);
    });
});

describe('EditableFieldDescriptor - create', () => {
    test('creates a new descriptor and allows to access it by indicating its label and db', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'note',
            type: 'paragraph',
            defVal: '',
            config: {},
        });

        expect(desc.label).toBe('note');
        expect(desc.type).toBe('paragraph');
        expect(desc.deprecated).toBe(false);

        const found = await EFD.getByLabel(toDbType('TEST'), 'note');
        expect(found).toBe(desc); 
    });

    test('within the same db\'s array, attempts to create a field with the same label as an existing one throws', async () => {
        const EFD = await freshModule();
        await EFD.create(toDbType('TEST'), {
            label: 'dup', type: 'line', defVal: 'a', config: {},
        });

        await expect(
            EFD.create(toDbType('TEST'), { label: 'dup', type: 'check', defVal: false, config: {} })
        ).rejects.toThrow(/Cannot have two editable fields/i);
    });

    test('the same label is allowed on different dbs', async () => {
        const EFD = await freshModule();
        await EFD.create(toDbType('TES1'), { label: 'x', type: 'line', defVal: 'a', config: {} });
        await expect(
            EFD.create(toDbType('TES2'), { label: 'x', type: 'line', defVal: 'b', config: {} })
        ).resolves.toBeDefined();
    });

    test("fields of type 'list' or 'checklist' require a non-empty array of options", async () => {
        const EFD = await freshModule();
        await expect(
            EFD.create(toDbType('TEST'), { label: 'l', type: 'list', defVal: '', config: { options: [] } })
        ).rejects.toThrow();
    });

    test("rejects fields of type 'value' or 'int' that have a config with min > max", async () => {
        const EFD = await freshModule();
        await expect(
            EFD.create(toDbType('TEST'), {
                label: 'v', type: 'value', defVal: 5, config: { min: 10, max: 1 },
            })
        ).rejects.toThrow(/Cannot have minimum value greater than the maximum/);
    });

    test("rejects out of set range defVal for fields of type 'value' or 'int'", async () => {
        const EFD = await freshModule();
        await expect(
            EFD.create(toDbType('TEST'), {
                label: 'v', type: 'int', defVal: 999, config: { min: 0, max: 10 },
            })
        ).rejects.toThrow();
    });

    test("rejects a non-boolean defVal for field of type 'check'", async () => {
        const EFD = await freshModule();
        await expect(
            EFD.create(toDbType('TEST'), {
                label: 'c', type: 'check', defVal: 'yes', config: {},
            })
        ).rejects.toThrow();
    });

    test('once created the field, updates the physical register (on disk) and the data can be read again', async () => {
        const EFD = await freshModule();
        await EFD.create(toDbType('TEST'), { label: 'p', type: 'line', defVal: 'x', config: {} });
        expect(fsStore.has('test-editables.json')).toBe(true);
        const contentOfRegister = JSON.parse(fsStore.get('test-editables.json')!);
        expect(contentOfRegister).toEqual([
            ['TEST', [{ label: 'p', type: 'line', defVal: 'x', config: {} }]],
        ]);
    });
});

describe('EditableFieldDescriptor - static getters', () => {
    test('getAll (no init) throws NotFoundError when a db has no array in the register', async () => {
        const EFD = await freshModule();
        await expect(EFD.getAll(toDbType('NOPE'))).rejects.toThrowWithName('NotFoundError');
    });

    test('getAllOrInit for a new db registers a new array for it and returns it', async () => {
        const EFD = await freshModule();
        const first = await EFD.getAllOrInit(toDbType('NEWW'));
        expect(first).toEqual([]);
        // GetAll does not throw
        await expect(EFD.getAll(toDbType('NEWW'))).resolves.toEqual([]);
    });

    test('getByLabel throws NotFoundError if the label does not exist for the db', async () => {
        const EFD = await freshModule();
        await EFD.create(toDbType('TEST'), { label: 'a', type: 'line', defVal: '', config: {} });
        await expect(EFD.getByLabel(toDbType('TEST'), 'not-existing')).rejects.toThrowWithName('NotFoundError');
    });
});

describe('EditableFieldDescriptor - getDefaultObject cached factory', () => {
    test('on request, builds an object of editable fields belonging to a db with default values', async () => {
        const EFD = await freshModule();
        await EFD.create(toDbType('TEST'), { label: 'a', type: 'line', defVal: 'x', config: {} });
        await EFD.create(toDbType('TEST'), { label: 'b', type: 'check', defVal: true, config: {} });

        const defaults = await EFD.getDefaultObject(toDbType('TEST'));
        expect(defaults).toEqual({ a: 'x', b: true });
    });

    test('rejects unregistered db with NotFoundError', async () => {
        const EFD = await freshModule();
        await expect(EFD.getDefaultObject(toDbType('BOH_'))).rejects.toThrowWithName('NotFoundError');
    });

    test('getDefaultObject caches default objects per db and returns the same object at each request from the same db',
        async () => {
            const EFD = await freshModule();
            await EFD.create(toDbType('TEST'), { label: 'a', type: 'line', defVal: 'x', config: {} });

            const d1 = await EFD.getDefaultObject(toDbType('TEST'));
            const d2 = await EFD.getDefaultObject(toDbType('TEST'));
            expect(d1).toBe(d2); 
}
);

    test('getDefaultObject cache is invalidated after a new field is initialized',
        async () => {
            const EFD = await freshModule();
            await EFD.create(toDbType('TEST'), { label: 'a', type: 'line', defVal: 'x', config: {} });
            const d1 = await EFD.getDefaultObject(toDbType('TEST'));

            await EFD.create(toDbType('TEST'), { label: 'b', type: 'check', defVal: false, config: {} });
            const d2 = await EFD.getDefaultObject(toDbType('TEST'));
            expect(d2).not.toBe(d1);
            expect(d2).toEqual({ a: 'x', b: false });
        }
    );

    test('getDefaultObject returns a clone of the default object when requested',
        async () => {
            const EFD = await freshModule();
            await EFD.create(toDbType('TEST'), { label: 'a', type: 'line', defVal: 'x', config: {} });

            const d1 = await EFD.getDefaultObject(toDbType('TEST'), /* clone */true);
            const d2 = await EFD.getDefaultObject(toDbType('TEST'),/* clone */true);
            expect(d1).not.toBe(d2); 
        }
    );
});

describe('EditableFieldDescriptor - deprecate & delete (static methods)', () => {
    test('deprecate marks a field with a boolean flag; it persists on disk', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), { label: 'd', type: 'line', defVal: '', config: {} });
        expect(desc.deprecated).toBe(false);

        await EFD.deprecate(toDbType('TEST'), desc);
        expect(desc.deprecated).toBe(true);

        const register = JSON.parse(fsStore.get('test-editables.json')!);
        expect(register[0][1][0].deprecated).toBe(true);
    });

    test('rejects deprecate with IllegalAccessError if the descriptor does not belong to the database specified', async () => {
        const EFD = await freshModule();
        const descA = await EFD.create(toDbType('TES1'), { label: 'a', type: 'line', defVal: '', config: {} });
        await EFD.getAllOrInit(toDbType('TES2'));

        await expect(EFD.deprecate(toDbType('TES2'), descA)).rejects.toThrow();
    });

    test('delete removes the field from the register permanently (on disk)', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), { label: 'e', type: 'line', defVal: '', config: {} });
        await EFD.delete(toDbType('TEST'), desc);

        const all = await EFD.getAll(toDbType('TEST'));
        expect(all).toHaveLength(0);
    });

    test('rejects delete with IllegalAccessError if the descriptor does not belong to the database specified', async () => {
        const EFD = await freshModule();
        const descA = await EFD.create(toDbType('TES1'), { label: 'a', type: 'line', defVal: '', config: {} });
        await EFD.getAllOrInit(toDbType('TES2'));

        await expect(EFD.delete(toDbType('TES2'), descA)).rejects.toThrow();
    });
});

describe('EditableFieldDescriptor - writing concurrency', () => {
    test('calling two create() with the same db at the same time does not result in race condition', async () => {
        const EFD = await freshModule();

        await Promise.all([
            EFD.create(toDbType('TEST'), { label: 'x', type: 'line', defVal: '1', config: {} }),
            EFD.create(toDbType('TEST'), { label: 'y', type: 'line', defVal: '2', config: {} }),
        ]);

        const all = await EFD.getAll(toDbType('TEST'));
        expect(all.map(d => d.label).sort()).toEqual(['x', 'y']);

        const register = JSON.parse(fsStore.get('test-editables.json')!);
        const labels = register[0][1].map((d: any) => d.label).sort();
        expect(labels).toEqual(['x', 'y']);
    });

    test('calling two create() with different db at the same time does not result in race condition or data pollution', async () => {
        const EFD = await freshModule();

        await Promise.all([
            EFD.create(toDbType('TESA'), { label: 'a', type: 'line', defVal: '', config: {} }),
            EFD.create(toDbType('TESB'), { label: 'b', type: 'line', defVal: '', config: {} }),
        ]);

        expect((await EFD.getAll(toDbType('TESA'))).map(d => d.label)).toEqual(['a']);
        expect((await EFD.getAll(toDbType('TESB'))).map(d => d.label)).toEqual(['b']);
    });
});

describe('EditableFieldDescriptor - typed schemas (for values)', () => {
    // Per type:

    test('checklist: accepts non-duplicate values selections among the options of the checklist', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'cl', type: 'checklist', defVal: ['a', 'b'],
            config: { options: ['a', 'b', 'c'] },
        });
        expect(desc.schema.safeParse(['a', 'c']).success).toBe(true);
    });

    test('checklist: rejects duplicate selections', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'cl', type: 'checklist', defVal: [],
            config: { options: ['a', 'b'] },
        });
        expect(desc.schema.safeParse(['a', 'a']).success).toBe(false);
    });

    test('checklist: rejects selections that include values not present among the options of the checklist', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'cl', type: 'checklist', defVal: [],
            config: { options: ['a', 'b'] },
        });
        expect(desc.schema.safeParse(['z']).success).toBe(false);
    });

    test('list: accepts only one value among its options', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'l', type: 'list', defVal: 'a',
            config: { options: ['a', 'b'] },
        });
        expect(desc.schema.safeParse('a').success).toBe(true);
        expect(desc.schema.safeParse('z').success).toBe(false);
        expect(desc.schema.safeParse(['a']).success).toBe(false);
    });

    test('url: only accepts absolute url paths with https', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), { label: 'u', type: 'url', defVal: 'https://example.com', config: {} });
        expect(desc.schema.safeParse('https://example.com/page').success).toBe(true);
        expect(desc.schema.safeParse('http://example.com').success).toBe(false);
        expect(desc.schema.safeParse('not-an-url').success).toBe(false);
    });

    test('value/int: reject values out of the bounds set in their config', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'v', type: 'int', defVal: 5, config: { min: 0, max: 10 },
        });
        expect(desc.schema.safeParse(0).success).toBe(true);
        expect(desc.schema.safeParse(10).success).toBe(true);
        expect(desc.schema.safeParse(11).success).toBe(false);
        expect(desc.schema.safeParse(-1).success).toBe(false);
        expect(desc.schema.safeParse(5.5).success).toBe(false); 
    });

    test('check: only accepts boolean values', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), { label: 'c', type: 'check', defVal: false, config: {} });
        expect(desc.schema.safeParse(true).success).toBe(true);
        expect(desc.schema.safeParse('true').success).toBe(false);
    });
});

describe('EditableFieldDescriptor - buildInput', () => {
    test('line produce un input testuale con il valore iniziale', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), { label: 'nome', type: 'line', defVal: '', config: {} });
        const html = desc.buildInput('ciao');

        expect(html).toContain('type="text"');
        expect(html).toContain('name="nome"');
        expect(html).toContain('value="ciao"');
    });

    test('check produce una checkbox con "checked" solo se true', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), { label: 'attivo', type: 'check', defVal: false, config: {} });
        expect(desc.buildInput(true)).toContain('checked');
        expect(desc.buildInput(false)).not.toContain('checked');
    });

    test('list produce un select con l\'opzione corretta marcata "selected"', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'cat', type: 'list', defVal: 'a', config: { options: ['a', 'b'] },
        });
        const html = desc.buildInput('b');
        expect(html).toContain('<select');
        // 'b' selezionata, 'a' no
        expect(html).toMatch(/value="b"\s+selected/);
        expect(html).not.toMatch(/value="a"\s+selected/);
    });

    test('checklist produce un false-select con gli option corretti', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'tags', type: 'checklist', defVal: [], config: { options: ['x', 'y'] },
        });
        const html = desc.buildInput(['y']);
        expect(html).toContain('<false-select');
        expect(html).toMatch(/value="y"\s+selected/);
        expect(html).not.toMatch(/value="x"\s+selected/);
    });

    test('escapa correttamente le opzioni con caratteri HTML speciali', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'l', type: 'list', defVal: 'a<b', config: { options: ['a<b', 'c&d'] },
        });
        const html = desc.buildInput('a<b');
        expect(html).not.toContain('<b"'); // il '<' letterale non deve comparire crudo nel value
        expect(html).toContain('a&lt;b');
    });
});

describe('EditableFieldDescriptor - toJSON', () => {
    test('serializes fields label/type/defVal/config, deprecated is omitted if absent', async () => {
        const EFD = await freshModule();
        const desc = await EFD.create(toDbType('TEST'), {
            label: 'x', type: 'int', defVal: 3, config: { min: 0, max: 10 },
        });
        const json = JSON.parse(JSON.stringify(desc));
        expect(json).toEqual({ label: 'x', type: 'int', defVal: 3, config: { min: 0, max: 10 } });
        expect(json).not.toHaveProperty('deprecated');
    });
});