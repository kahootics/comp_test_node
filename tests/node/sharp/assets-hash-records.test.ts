import { describe, expect, beforeEach, vi, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AssetsHashRecords } from '../../../src/scripts/node/sharp/assets-hash-records.js';
import { hashString } from '../../../src/scripts/types/general-types.js';
import appConfig from '../../../src/config/ui-config.mjs';
import { asDir, asHash } from '../../utils.js';

vi.mock('node:fs', () => {
    const existsSync = vi.fn();
    const readFileSync = vi.fn();
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    return {
        default: { existsSync, readFileSync, writeFileSync, mkdirSync },
        existsSync, readFileSync, writeFileSync, mkdirSync,
    };
});

const LIB_PATH = path.resolve(appConfig.paths.assetsHashLibrary);

/** Sets up fs mocks as if the library file already exists with the given entries. */
function mockLibrary(entries: [string, Record<string, string[]>][]) {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entries));
}

beforeEach(() => {
    // The singleton persists across calls until terminated; reset it (and the fs mocks)
    // before every test so each test starts from a clean, predictable state.
    AssetsHashRecords.terminate();
    vi.clearAllMocks();
});

describe('AssetsHashRecords - initialization', () => {
    test('creates the library file with an empty array when it does not exist yet', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        AssetsHashRecords.getHashRecord(asDir('assets/hero'), asHash('a1b2c3d4'));

        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(LIB_PATH), { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalledWith(LIB_PATH, '[]');
    });

    test('reads existing records from disk', () => {
        mockLibrary([['assets/hero', { a1b2c3d4: ['e5f6a7b8'] }]]);

        const result = AssetsHashRecords.getHashRecord(asDir('assets/hero'), asHash('a1b2c3d4'));

        expect(result).toEqual(['e5f6a7b8']);
    });

    test('throws when the on-disk data does not match the expected schema', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify([['assets/hero', { a1b2c3d4: ['not-a-valid-hash'] }]])
        );

        expect(() =>
            AssetsHashRecords.getHashRecord(asDir('assets/hero'), asHash('a1b2c3d4'))
        ).toThrow();
    });

    test('does not re-read from disk on subsequent calls before terminate', () => {
        mockLibrary([]);

        AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'));
        AssetsHashRecords.getHashRecord(asDir('dir2'), asHash('e5f6a7b8'));

        expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });
});

describe('AssetsHashRecords - getHashRecord', () => {
    test('returns an empty array for a directory that has never been recorded', () => {
        mockLibrary([]);
        expect(AssetsHashRecords.getHashRecord(asDir('unseen'), asHash('a1b2c3d4'))).toEqual([]);
    });

    test('returns an empty array for a known directory but an unseen ruleset hash', () => {
        mockLibrary([['dir', { a1b2c3d4: ['a1f2c3d4'] }]]);
        expect(AssetsHashRecords.getHashRecord(asDir('dir'), asHash('e5f6a7b8'))).toEqual([]);
    });

    test('returns a copy of the stored array, not a live reference', () => {
        mockLibrary([['dir', { a1b2c3d4: ['e5f6a7b8'] }]]);

        const result = AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'));
        result.push('ffffffff' as hashString);

        const second = AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'));
        expect(second).toEqual(['e5f6a7b8']);
    });

    test('NOTE: querying a never-set directory/hash pair creates a persisted empty placeholder entry', () => {
        mockLibrary([]);

        AssetsHashRecords.getHashRecord(asDir('never/set'), asHash('a1b2c3d4'));
        AssetsHashRecords.write();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            LIB_PATH,
            JSON.stringify([['never/set', { a1b2c3d4: [] }]])
        );
    });
});

describe('AssetsHashRecords - setHashRecord', () => {
    test('creates a new directory entry when none exists yet', () => {
        mockLibrary([]);

        AssetsHashRecords.setHashRecord(asDir('dir'), asHash('a1b2c3d4'), ['e5f6a7b8' as hashString]);

        expect(AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'))).toEqual(['e5f6a7b8']);
    });

    test('overwrites only the targeted ruleset hash, leaving other ruleset hashes for the same directory untouched', () => {
        mockLibrary([['dir', { a1b2c3d4: ['old2c3d4'], e5f6a7b8: ['keptc3d4'] }]]);

        AssetsHashRecords.setHashRecord(asDir('dir'), asHash('a1b2c3d4'), ['new2c3d4' as hashString]);

        expect(AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'))).toEqual(['new2c3d4']);
        expect(AssetsHashRecords.getHashRecord(asDir('dir'), asHash('e5f6a7b8'))).toEqual(['keptc3d4']);
    });

    test('is chainable, returning the class itself', () => {
        mockLibrary([]);
        const result = AssetsHashRecords.setHashRecord(asDir('dir'), asHash('a1b2c3d4'), []);
        expect(result).toBe(AssetsHashRecords);
    });
});

describe('AssetsHashRecords - write', () => {
    test('persists the current in-memory state as an array of [directory, record] tuples', () => {
        mockLibrary([]);
        AssetsHashRecords.setHashRecord(asDir('dir'), asHash('a1b2c3d4'), ['e5f6a7b8' as hashString]);

        AssetsHashRecords.write();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            LIB_PATH,
            JSON.stringify([['dir', { a1b2c3d4: ['e5f6a7b8'] }]])
        );
    });
});

describe('AssetsHashRecords - terminate', () => {
    test('causes the next static call to re-read from disk', () => {
        mockLibrary([]);
        AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'));
        expect(fs.readFileSync).toHaveBeenCalledTimes(1);

        AssetsHashRecords.terminate();
        AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'));
        expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });

    test('discards unwritten changes made before it was called', () => {
        mockLibrary([]);
        AssetsHashRecords.setHashRecord(asDir('dir'), asHash('a1b2c3d4'), ['unwritten' as hashString]);

        AssetsHashRecords.terminate();
        mockLibrary([]); // disk still reflects the original, empty library — write() was never called

        expect(AssetsHashRecords.getHashRecord(asDir('dir'), asHash('a1b2c3d4'))).toEqual([]);
    });
});