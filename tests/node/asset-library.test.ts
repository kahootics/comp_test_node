import { describe, test, expect, beforeEach, vi } from 'vitest';
import { asDir } from '../utils.js';
import { AssetsDirectory } from '../../src/scripts/node/sharp/assets-directory.js';
import { AssetsLibrary } from '../../src/scripts/node/sharp/assets-library.js';

vi.mock('../../src/scripts/node/sharp/assets-directory.js', () => ({
    AssetsDirectory: { buildAll: vi.fn() },
}));


function makeFakeDirectory(dirPath: string, assetNames: string[]) {
    return {
        path: asDir(dirPath),
        getAllNames: vi.fn(() => assetNames),
        has: vi.fn((asset: any) =>
            assetNames.includes(typeof asset === 'string' ? asset : asset.name)
        ),
        get: vi.fn((name: string) => (assetNames.includes(name) ? ({ name } as any) : undefined)),
        enforceLocalRuleset: vi.fn(async () => assetNames.map(name => ({ name }))),
        exportAssetTo: vi.fn(async (name: string, _rulesetFileName: string, dest: string) => ({
            name, src: dest, width: 1, height: 1,
        })),
        exportAssetsListTo: vi.fn(async (names: string[], _rulesetFileName: string, dest: string) =>
            names.map(name => ({ name, src: dest, width: 1, height: 1 }))
        ),
        exportDirectoryTo: vi.fn(async (_rulesetFileName: string, dest: string) =>
            assetNames.map(name => ({ name, src: dest, width: 1, height: 1 }))
        ),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    AssetsLibrary.destroy();
});

describe('AssetsLibrary - singleton lifecycle', () => {
    test('rejects with SingletonNotInitializedError when used before build()', () => {
        expect(() => AssetsLibrary.has('anything')).toThrowWithName('SingletonNotInitializedError');
    });

    test('build() succeeds and returns the class itself for chaining', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);

        const result = await AssetsLibrary.build('root', ['jpg'] as any);

        expect(result).toBe(AssetsLibrary);
        expect(AssetsLibrary.has('a')).toBe(true);
    });

    test('rejects with SingletonDuplicateError when build() is called a second time without destroy()', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        await expect(AssetsLibrary.build('root', ['jpg'] as any))
            .rejects.toThrowWithName('SingletonDuplicateError');
    });

    test('destroy() returns true when an instance existed, and resets the singleton', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        expect(AssetsLibrary.destroy()).toBe(true);
        expect(() => AssetsLibrary.has('a')).toThrowWithName('SingletonNotInitializedError');
    });

    test('destroy() returns false when there is nothing to destroy', () => {
        expect(AssetsLibrary.destroy()).toBe(false);
    });

    test('build() can be called again after destroy() previous build', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        expect(AssetsLibrary.destroy()).toBe(true);
        expect(() => AssetsLibrary.has('a')).toThrowWithName('SingletonNotInitializedError');

        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);

        const result = await AssetsLibrary.build('root', ['jpg'] as any);

        expect(result).toBe(AssetsLibrary);
        expect(AssetsLibrary.has('a')).toBe(true);
    });

    test('rejects with ValidationError when two directories report the same asset name', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([
            makeFakeDirectory('assets/hero', ['shared']),
            makeFakeDirectory('assets/icons', ['shared']),
        ] as any);

        await expect(AssetsLibrary.build('root', ['jpg'] as any))
            .rejects.toThrowWithName('ValidationError');
    });
});

describe('AssetsLibrary - public accessors', () => {
    beforeEach(async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([
            makeFakeDirectory('assets/hero', ['a', 'b']),
            makeFakeDirectory('assets/icons', ['c']),
        ] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);
    });

    test('has() finds an asset by name regardless of which directory holds it', () => {
        expect(AssetsLibrary.has('a')).toBe(true);
        expect(AssetsLibrary.has('c')).toBe(true);
        expect(AssetsLibrary.has('missing')).toBe(false);
    });

    test('get() returns the asset from whichever directory holds it', () => {
        expect(AssetsLibrary.get('c')).toEqual({ name: 'c' });
        expect(AssetsLibrary.get('missing')).toBeUndefined();
    });

    test('findDir() returns the path of the directory holding the asset', () => {
        expect(AssetsLibrary.findDir('a')).toBe('assets/hero');
        expect(AssetsLibrary.findDir('c')).toBe('assets/icons');
        expect(AssetsLibrary.findDir('missing')).toBeUndefined();
    });
});

describe('AssetsLibrary - enforceLocalRulesAt / enforceLocalRulesLibraryAt', () => {
    test('delegates to the correct directory', async () => {
        const heroDir = makeFakeDirectory('assets/hero', ['a']);
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([heroDir] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        await AssetsLibrary.enforceLocalRulesAt('rules', asDir('assets/hero'));

        expect(heroDir.enforceLocalRuleset).toHaveBeenCalledWith('rules');
    });

    test('rejects when the given directory is not part of the library', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        await expect(AssetsLibrary.enforceLocalRulesAt('rules', asDir('assets/nope')))
            .rejects.toThrowWithName('NotFoundError');
    });

    test('enforces the ruleset on every directory in the library and flattens the results', async () => {
        const heroDir = makeFakeDirectory('assets/hero', ['a', 'b']);
        const iconsDir = makeFakeDirectory('assets/icons', ['c']);
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([heroDir, iconsDir] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        const result = await AssetsLibrary.enforceLocalRulesLibraryAt('rules');

        expect(heroDir.enforceLocalRuleset).toHaveBeenCalledWith('rules');
        expect(iconsDir.enforceLocalRuleset).toHaveBeenCalledWith('rules');
        expect(result).toHaveLength(3);
    });
});

describe('AssetsLibrary - exportAssetTo', () => {
    test('rejects with NotFoundError for an unknown asset', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        await expect(AssetsLibrary.exportAssetTo('missing', 'rules', asDir('/out')))
            .rejects.toThrowWithName('NotFoundError');
    });

    test('delegates to the owning directory', async () => {
        const heroDir = makeFakeDirectory('assets/hero', ['a']);
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([heroDir] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        const result = await AssetsLibrary.exportAssetTo('a', 'rules', asDir('/out'));

        expect(heroDir.exportAssetTo).toHaveBeenCalledWith('a', 'rules', '/out');
        expect(result).toEqual({ name: 'a', src: '/out', width: 1, height: 1 });
    });
});

describe('AssetsLibrary - exportDirectoryTo', () => {
    test('rejects when the directory is not part of the library', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        await expect(AssetsLibrary.exportDirectoryTo(asDir('assets/nope'), 'rules', asDir('/out')))
            .rejects.toThrowWithName('NotFoundError');
    });

    test('delegates to the matching directory', async () => {
        const heroDir = makeFakeDirectory('assets/hero', ['a', 'b']);
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([heroDir] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        const result = await AssetsLibrary.exportDirectoryTo(asDir('assets/hero'), 'rules', asDir('/out'));

        expect(heroDir.exportDirectoryTo).toHaveBeenCalledWith('rules', '/out');
        expect(result).toHaveLength(2);
    });
});

describe('AssetsLibrary - exportAssetsListTo', () => {
    test('rejects with NotFoundError when any requested name does not exist anywhere in the library', async () => {
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([makeFakeDirectory('assets/hero', ['a'])] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        await expect(AssetsLibrary.exportAssetsListTo(['a', 'missing'], 'rules', asDir('/out')))
            .rejects.toThrowWithName('NotFoundError');
    });

    test('groups requested names by their owning directory and forwards only the relevant subset to each', async () => {
        const heroDir = makeFakeDirectory('assets/hero', ['a', 'b']);
        const iconsDir = makeFakeDirectory('assets/icons', ['c']);
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([heroDir, iconsDir] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        const result = await AssetsLibrary.exportAssetsListTo(['a', 'c'], 'rules', asDir('/out'));

        expect(heroDir.exportAssetsListTo).toHaveBeenCalledWith(['a'], 'rules', '/out');
        expect(iconsDir.exportAssetsListTo).toHaveBeenCalledWith(['c'], 'rules', '/out');
        expect(result.get(asDir('assets/hero'))).toEqual([{ name: 'a', src: '/out', width: 1, height: 1 }]);
        expect(result.get(asDir('assets/icons'))).toEqual([{ name: 'c', src: '/out', width: 1, height: 1 }]);
    });
});

describe('AssetsLibrary - exportLibraryTo', () => {
    test('exports every directory and aggregates the results by directory path', async () => {
        const heroDir = makeFakeDirectory('assets/hero', ['a', 'b']);
        const iconsDir = makeFakeDirectory('assets/icons', ['c']);
        vi.mocked(AssetsDirectory.buildAll).mockResolvedValue([heroDir, iconsDir] as any);
        await AssetsLibrary.build('root', ['jpg'] as any);

        const result = await AssetsLibrary.exportLibraryTo('rules', asDir('/out'));

        expect(heroDir.exportDirectoryTo).toHaveBeenCalledWith('rules', '/out');
        expect(iconsDir.exportDirectoryTo).toHaveBeenCalledWith('rules', '/out');
        expect(result.get(asDir('assets/hero'))).toHaveLength(2);
        expect(result.get(asDir('assets/icons'))).toHaveLength(1);
    });
});