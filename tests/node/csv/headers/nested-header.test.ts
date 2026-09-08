import { describe, test, expect, vi } from 'vitest';
import { HeaderEntry } from '../../../../src/scripts/node/csv/headers/header-entry.js';
import { IndexHeader } from '../../../../src/scripts/node/csv/headers/index-header.js';
import { NestedHeader } from '../../../../src/scripts/node/csv/headers/nested-header.js';
import { CsvParserOptions } from '../../../../src/scripts/node/csv/csv-parser-options.js';
import type { dummy } from '../../../setup.js';

vi.mock('../../../../src/scripts/node/csv/csv-parser-options.js', () => ({
    CsvParserOptions: {
        of: vi.fn()
    }
}));
vi.mocked(CsvParserOptions.of).mockReturnValue({
    csvDelimiter: undefined,
    newLineReplacer: undefined,
    arraySeparator: '|',
    arrayIndicator: '[]',
    objectNotation: '_',
    nestedObjArray: '[i]',
    idIndicator: 'ID'
} as CsvParserOptions)
const options = CsvParserOptions.of();

describe('NestedHeader', () => {
    test('throws IllegalAccessError when reading ancestor before it is set', async () => {
        const nested = await HeaderEntry.of('children[i]_name', 1, options) as NestedHeader;
        expect(() => nested.ancestor).toThrowWithName('IllegalAccessError');
    });

    test('throws IllegalAccessError when computing localKeys before ancestor is set', async () => {
        const nested = await HeaderEntry.of('children[i]_name', 1, options) as NestedHeader;
        expect(() => nested.localKeys).toThrowWithName('IllegalAccessError');
    });

    test('assigns its value at the local (ancestor-relative) path', async () => {
        const parent = await HeaderEntry.of('children[i]', 0, options) as IndexHeader;
        const nested = await HeaderEntry.of('children[i]_name', 1, options) as NestedHeader;
        nested.ancestor = parent;

        const target: Record<string, any> = {};
        nested.assignLocalMatchingValue(target, ['0', 'Matteo']);
        expect(target).toEqual({ name: 'Matteo' });
    });

    test('supports multi-level local paths under the same ancestor', async () => {
        const parent = await HeaderEntry.of('effects[i]', 0, options) as IndexHeader;
        const nested = await HeaderEntry.of('effects[i]_conditions_logic', 1, options) as NestedHeader;
        // keys: ['effects', 'conditions', 'logic'] -> localKeys after stripping ancestor: ['conditions','logic']
        nested.ancestor = parent;

        const target: Record<string, any> = {};
        nested.assignLocalMatchingValue(target, ['0', 'AND']);
        expect(target).toEqual({ conditions: { logic: 'AND' } });
    });
});