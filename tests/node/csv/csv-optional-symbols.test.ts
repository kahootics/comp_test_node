import { describe, test, expect } from 'vitest';
import { CsvOptionalSymbols } from '../../../src/scripts/node/csv/csv-optional-symbols.js';
import { dummy } from '../../setup.js';

describe('CsvOptionalSymbols', () => {
    test('applies default symbols when nothing is provided', () => {
        const options = CsvOptionalSymbols.of();
        expect(options.arraySeparator).toBe('|');
        expect(options.arrayIndicator).toBe('[]');
        expect(options.objectNotation).toBe('_');
        expect(options.nestedObjArray).toBe('[i]');
        expect(options.idIndicator).toBe('ID');
        expect(options.newLineReplacer).toBeUndefined();
    });

    test('overrides only the provided symbols, keeping the rest default', () => {
        const options = CsvOptionalSymbols.of({ arraySeparator: ';' });
        expect(options.arraySeparator).toBe(';');
        expect(options.objectNotation).toBe('_');
    });

    test('throws when provided symbols have duplicates among themselves or the default ones', () => {
        expect(() => CsvOptionalSymbols.of({ arraySeparator: '_' })).toThrowWithName('DuplicateKeyError');
        expect(() => CsvOptionalSymbols.of({ arraySeparator: ';', csvDelimiter: ';' })).toThrowWithName('DuplicateKeyError');
    });

    test('carries a custom newLineReplacer through', () => {
        const options = CsvOptionalSymbols.of({ newLineReplacer: '[n]' });
        expect(options.newLineReplacer).toBe('[n]');
    });

    test('cannot be constructed directly, only via the static factory', () => {
        // @ts-expect-error - intentionally bypassing the type system to hit the runtime guard
        expect(() => new CsvOptionalSymbols(Symbol('fake-token'))).toThrowWithName('PrivateConstructorError');
    });
});