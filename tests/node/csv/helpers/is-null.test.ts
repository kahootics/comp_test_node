
import { describe, test, expect } from 'vitest';
import {isNull} from '../../../../src/scripts/node/csv/helpers/is-null.js';

describe('isNull', () => {

    test('returns true if it finds null case-insensitive', () => {
        expect(isNull('null')).toBe(true);
        expect(isNull('Null')).toBe(true);
        expect(isNull('nULl')).toBe(true);
    });

    test('returns true if it finds null when separated by symbols or spaces from other strings', () => {
        expect(isNull('   null   ')).toBe(true);
        expect(isNull('  [null]  ')).toBe(true);
        expect(isNull('string [null: is null value]')).toBe(true);
        expect(isNull('NULL - Null Reference [00000000]')).toBe(true);
    });

    test('returns true if it finds blank/empty string', () => {
        expect(isNull('')).toBe(true);
        expect(isNull('            ')).toBe(true);
        expect(isNull('      y             ')).toBe(false);
    });

    test('returns false for strings containing falsy or nullish values', () => {
        expect(isNull('none')).toBe(false);
        expect(isNull('0')).toBe(false);
        expect(isNull('undefined')).toBe(false);
        expect(isNull('false')).toBe(false);
        expect(isNull('"')).toBe(false);
    });

    test('returns false when null is attached to non-symbol strings', () => {
        expect(isNull('annullamento')).toBe(false);
        expect(isNull('nullString')).toBe(false);
        expect(isNull('null string')).toBe(true);
    });
});