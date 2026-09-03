import { describe, test, expect } from 'vitest';
import { HeaderEntry } from '../../../../src/scripts/node/csv/headers/header-entry.js';
import { FlatHeader } from '../../../../src/scripts/node/csv/headers/flat-header.js';
import { IndexHeader } from '../../../../src/scripts/node/csv/headers/index-header.js';
import { NestedHeader } from '../../../../src/scripts/node/csv/headers/nested-header.js';
import { CsvOptionalSymbols } from '../../../../src/scripts/node/csv/csv-optional-symbols.js';
import type { dummy } from '../../../setup.js';

const options = CsvOptionalSymbols.of({
    arrayIndicator: '[]',
    objectNotation: '_',
    nestedObjArray: '[i]',
    arraySeparator: '|'
});

describe('HeaderEntry.of (type dispatch)', () => {
    test('builds a FlatHeader for a plain label', async () => {
        const h = await HeaderEntry.of('name', 0, options);
        expect(h).toBeInstanceOf(FlatHeader);
        expect(h.flat).toBe('name');
        expect(h.keys).toEqual(['name']);
        expect(h.valueType).toBe('flat');
    });

    test('detects the array indicator suffix on a flat header', async () => {
        const h = await HeaderEntry.of('keywords[]', 0, options);
        expect(h).toBeInstanceOf(FlatHeader);
        expect(h.flat).toBe('keywords');
        expect(h.valueType).toBe('array');
    });

    test('builds an IndexHeader when the label ends with the nesting marker', async () => {
        const h = await HeaderEntry.of('children[i]', 2, options);
        expect(h).toBeInstanceOf(IndexHeader);
        expect(h.flat).toBe('children');
        expect(h.keys).toEqual(['children']);
    });

    test('builds a NestedHeader for a field inside a nested index', async () => {
        const h = await HeaderEntry.of('children[i]_name', 3, options);
        expect(h).toBeInstanceOf(NestedHeader);
        expect(h.flat).toBe('children_name');
        expect(h.keys).toEqual(['children', 'name']);
    });

    test('unpacks multi-level object notation into multiple keys', async () => {
        const h = await HeaderEntry.of('effects[i]_conditions[i]_name', 5, options);
        expect(h.keys).toEqual(['effects', 'conditions', 'name']);
    });

    test('throws when there is no key before the object notation separator', async () => {
        await expect(HeaderEntry.of('_name', 0, options)).rejects.toThrowWithName('IllegalArgumentError');
    });

    test('throws IllegalArgumentError for a non-safe-integer column index', async () => {
        await expect(HeaderEntry.of('name', 1.5, options)).rejects.toThrowWithName('IllegalArgumentError');
    });
});

describe('HeaderEntry column access', () => {
    test('reads the value at its own column index', async () => {
        const h = await HeaderEntry.of('name', 1, options);
        expect(h.getMatchingColumnValue(['x', 'Mario', 'z'])).toBe('Mario');
    });

    test('throws NotFoundError when the row is shorter than expected', async () => {
        const h = await HeaderEntry.of('name', 5, options);
        expect(() => h.getMatchingColumnValue(['only', 'two'])).toThrowWithName('NotFoundError');
    });
});