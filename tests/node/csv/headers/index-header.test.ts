import { describe, test, expect, vi } from 'vitest';
import { HeaderEntry } from '../../../../src/scripts/node/csv/headers/header-entry.js';
import { IndexHeader } from '../../../../src/scripts/node/csv/headers/index-header.js';
import { NestedHeader } from '../../../../src/scripts/node/csv/headers/nested-header.js';
import { CsvOptionalSymbols } from '../../../../src/scripts/node/csv/csv-optional-symbols.js';
import type { dummy } from '../../../setup.js';

vi.mock('../../../../src/scripts/node/csv/csv-optional-symbols.js', () => ({
    CsvOptionalSymbols: {
        of: vi.fn()
    }
}));
vi.mocked(CsvOptionalSymbols.of).mockReturnValue({
    csvDelimiter: undefined,
    newLineReplacer: undefined,
    arraySeparator: '|',
    arrayIndicator: '[]',
    objectNotation: '_',
    nestedObjArray: '[i]',
    idIndicator: 'ID'
} as CsvOptionalSymbols)
const options = CsvOptionalSymbols.of();

describe('IndexHeader', () => {
    test('reads a valid integer index from its column', async () => {
        const idx = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        expect(idx.readIndex(['1'])).toBe(1);
    });

    test('throws when the index column does not hold a number', async () => {
        const idx = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        expect(() => idx.readIndex(['not-a-number'])).toThrowWithName('IllegalArgumentError');
    });

    test('reads a valid but negative integer index from its column', async () => {
        const idx = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        expect(idx.readIndex(['-1'])).toBe(-1);
    });

    test('builds a partial record from its registered nested children only', async () => {
        const idx = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const nameField = await HeaderEntry.of('children[i]_name', 2, options) as NestedHeader;
        nameField.ancestor = idx;
        idx.addNestedChild(nameField);

        const partial = idx.buildPartialRecord(['0', 'ignored', 'Matteo']);
        expect(partial).toEqual({ name: 'Matteo' });
    });

    test('ensureArray creates and reuses an array at its own path (root index)', async () => {
        const idx = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const target: Record<string, any> = {};
        const arr1 = idx.ensureArray(target);
        const arr2 = idx.ensureArray(target);
        expect(target).toEqual({ children: [] });
        expect(arr1).toBe(arr2); 
    });

    test('ensureArray uses localKeys, so a nested index writes under its own layer, not the root', async () => {
        const parent = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const child = await HeaderEntry.of('children[i]_pets[i]', 1, options) as IndexHeader;
        child.ancestor = parent;
        parent.addIndexChild(child);

        // We are already positioned inside one element of `children`
        const currentLayer: Record<string, any> = {};
        child.ensureArray(currentLayer);
        expect(currentLayer).toEqual({ pets: [] });
    });

    test('tracks index and nested children via add* methods', async () => {
        const idx = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const nested = await HeaderEntry.of('children[i]_name', 1, options) as NestedHeader;
        const subIndex = await HeaderEntry.of('children[i]_pets[i]', 2, options) as IndexHeader;

        idx.addNestedChild(nested);
        idx.addIndexChild(subIndex);

        expect(idx.nestedChildren).toEqual([nested]);
        expect(idx.indexChildren).toEqual([subIndex]);
    });
});