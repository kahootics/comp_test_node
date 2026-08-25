import { describe, test, expect, vi } from 'vitest';
import { HeaderEntry } from '../../../../src/scripts/node/csv/headers/header-entry.js';
import { FlatHeader } from '../../../../src/scripts/node/csv/headers/flat-header.js';
import { CsvOptionalSymbols } from '../../../../src/scripts/node/csv/csv-optional-symbols.js';
import { dummy } from '../../../setup.js';

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

describe('FlatHeader', () => {
    test('writes a simple scalar field to the target object', async () => {
        const h = await HeaderEntry.of('name', 0, options) as FlatHeader;
        const target: Record<string, any> = {};
        h.assignValueFromMatchingColumn(target, ['Mario']);
        expect(target).toEqual({ name: 'Mario' });
    });

    test('writes a nested field when the header uses object notation', async () => {
        const h = await HeaderEntry.of('person_name', 0, options) as FlatHeader;
        const target: Record<string, any> = {};
        h.assignValueFromMatchingColumn(target, ['Mario']);
        expect(target).toEqual({ person: { name: 'Mario' } });
    });

    test('merges into an already partially-populated nested object', async () => {
        const target: Record<string, any> = { person: { name: 'Mario' } };
        const h = await HeaderEntry.of('person_id', 1, options) as FlatHeader;
        h.assignValueFromMatchingColumn(target, ['x', '867']);
        expect(target).toEqual({ person: { name: 'Mario', id: 867 } });
    });

    test('returns the parsed value it just assigned', async () => {
        const h = await HeaderEntry.of('value', 0, options) as FlatHeader;
        const returned = h.assignValueFromMatchingColumn({}, ['1']);
        expect(returned).toBe(1);
    });
});