import { describe, test, expect } from 'vitest';
import { CsvParserOptions } from '../../../src/scripts/node/csv/csv-parser-options.js';
import type { dummy } from '../../setup.js';

describe('CsvParserOptions', () => {
    test('applies default symbols when nothing is provided', () => {
        const options = CsvParserOptions.of();
        expect(options.arraySeparator).toBe('|');
        expect(options.arrayIndicator).toBe('[]');
        expect(options.objectNotation).toBe('_');
        expect(options.nestedObjArray).toBe('[i]');
        expect(options.idIndicator).toBe('ID');
        expect(options.newLineReplacer).toBeUndefined();
    });

    test('overrides only the provided symbols, keeping the rest default', () => {
        const options = CsvParserOptions.of({ arraySeparator: ';' });
        expect(options.arraySeparator).toBe(';');
        expect(options.objectNotation).toBe('_');
    });

    test('throws when provided symbols have duplicates among themselves or the default ones', () => {
        expect(() => CsvParserOptions.of({ arraySeparator: '_' })).toThrowWithName('DuplicateKeyError');
        expect(() => CsvParserOptions.of({ arraySeparator: ';', csvDelimiter: ';' })).toThrowWithName('DuplicateKeyError');
    });

    test('carries a custom newLineReplacer through', () => {
        const options = CsvParserOptions.of({ newLineReplacer: '[n]' });
        expect(options.newLineReplacer).toBe('[n]');
    });

    test('cannot be constructed directly, only via the static factory', () => {
        // @ts-expect-error - intentionally bypassing the type system to hit the runtime guard
        expect(() => new CsvParserOptions(Symbol('fake-token'))).toThrowWithName('PrivateConstructorError');
    });
});