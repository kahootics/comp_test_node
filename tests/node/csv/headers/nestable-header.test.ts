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

// NestableHeader is abstract: exercised through its concrete subclasses.
describe('NestableHeader (ancestor contract)', () => {
    test('allows the ancestor to be set exactly once', async () => {
        const parent = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const child = await HeaderEntry.of('children[i]_name', 1, options) as NestedHeader;
        expect(() => { child.ancestor = parent; }).not.toThrow();
    });

    test('throws when trying to set the ancestor a second time', async () => {
        const parentA = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const parentB = await HeaderEntry.of('pets[i]', 1, options) as IndexHeader;
        const child = await HeaderEntry.of('children[i]_name', 2, options) as NestedHeader;
        child.ancestor = parentA;
        expect(() => { child.ancestor = parentB; }).toThrowWithName('IllegalArgumentError');
    });

    test('computes localKeys by stripping the ancestor prefix', async () => {
        const parent = await HeaderEntry.of('children[i]', 0, options) as IndexHeader; // keys ['children']
        const child = await HeaderEntry.of('children[i]_name', 1, options) as NestedHeader; // keys ['children','name']
        child.ancestor = parent;
        expect(child.localKeys).toEqual(['name']);
    });

    test('a root index header (no ancestor) has localKeys equal to keys', async () => {
        const root = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        expect(root.localKeys).toEqual(root.keys);
    });
});