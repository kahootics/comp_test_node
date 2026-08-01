import { describe, test, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import { glob } from 'glob';
import { Asset } from '../../src/scripts/node/sharp/asset.js';
import { AssetsHashRecords } from '../../src/scripts/node/sharp/assets-hash-records.js';
import { AssetsDirectory } from '../../src/scripts/node/sharp/assets-directory.js';
import { RuleSet } from '../../src/scripts/node/sharp/rule-set.js';
import { asDir } from '../utils';

vi.mock('node:fs', () => {
    const existsSync = vi.fn();
    return { default: { existsSync }, existsSync };
});

vi.mock('glob', () => ({ glob: vi.fn() }));

vi.mock('../../src/scripts/node/sharp/rule-set.js', () => ({
    RuleSet: { build: vi.fn() },
}));

vi.mock('../../src/scripts/node/sharp/assets-hash-records.js', () => ({
    AssetsHashRecords: { write: vi.fn() },
}));

function makeFakeRuleset() {
    return {
        enforce: vi.fn(async () => { }),
        export: vi.fn(async (asset: Asset, dest: string) => ({
            name: asset.name, src: dest, width: 1, height: 1,
        })),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
});

describe('AssetsDirectory.build', () => {
    test('builds a directory from the assets discovered at the given path', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg', 'assets/logo.png']);

        const dir = await AssetsDirectory.build('assets', ['jpg', 'png'] as any);

        expect(dir.getAllNames().sort()).toEqual(['hero', 'logo']);
    });

    test('rejects with IllegalArgumentError when the given path looks like a file (has an extension)', async () => {
        await expect(AssetsDirectory.build('assets/hero.jpg', ['jpg'] as any)).rejects.toThrowWithName('IllegalArgumentError');
    });

    test('rejects with IllegalArgumentError when the directory does not exist', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(glob).mockResolvedValue([]);

        await expect(AssetsDirectory.build('assets', ['jpg'] as any))
            .rejects.toThrowWithName('IllegalArgumentError');
    });

    test('rejects with ValidationError when two discovered assets share the same name', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg', 'assets/hero.png']);

        await expect(AssetsDirectory.build('assets', ['jpg', 'png'] as any))
            .rejects.toThrowWithName('ValidationError');
    });
});

describe('AssetsDirectory.buildAll', () => {
    test('groups discovered assets into one AssetsDirectory per directory', async () => {
        vi.mocked(glob).mockResolvedValue([
            'assets/hero/a.jpg',
            'assets/hero/b.jpg',
            'assets/icons/c.png',
        ]);

        const dirs = await AssetsDirectory.buildAll('assets', ['jpg', 'png'] as any);

        expect(dirs).toHaveLength(2);
        const byPath = new Map(dirs.map(d => [d.path, d]));
        expect(byPath.get(asDir('assets/hero'))?.getAllNames().sort()).toEqual(['a', 'b']);
        expect(byPath.get(asDir('assets/icons'))?.getAllNames()).toEqual(['c']);
    });
});

describe('AssetsDirectory - has / get / getAllNames', () => {
    test('has(name) finds an asset by its original name', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        expect(dir.has('hero')).toBe(true);
        expect(dir.has('missing')).toBe(false);
    });

    test('has(asset) matches only an Asset with the same path AND the same pending out-state', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        const freshCopy = new Asset('assets/hero.jpg');
        expect(dir.has(freshCopy)).toBe(true);

        const editedCopy = new Asset('assets/hero.jpg');
        editedCopy.outName = 'hero-edited' as any;
        expect(dir.has(editedCopy)).toBe(false);
    });

    test('get(name) returns the matching asset, or undefined', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        expect(dir.get('hero')).toBeInstanceOf(Asset);
        expect(dir.get('missing')).toBeUndefined();
    });

    test('getAllNames() lists every asset by its original name', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/a.jpg', 'assets/b.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        expect(dir.getAllNames().sort()).toEqual(['a', 'b']);
    });
});

describe('AssetsDirectory.enforceLocalRuleset', () => {
    test('builds the ruleset for its own directory, enforces it on all assets, and persists the hash records', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/a.jpg', 'assets/b.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        const fakeRuleset = makeFakeRuleset();
        vi.mocked(RuleSet.build).mockReturnValue(fakeRuleset as any);

        const result = await dir.enforceLocalRuleset('rules');

        expect(RuleSet.build).toHaveBeenCalledWith(dir.path, 'rules');
        expect(fakeRuleset.enforce).toHaveBeenCalledTimes(1);
        //@ts-ignore
        expect(fakeRuleset.enforce.mock.calls[0]![0]).toHaveLength(2);
        expect(AssetsHashRecords.write).toHaveBeenCalledOnce();
        expect(result).toHaveLength(2);
    });
});

describe('AssetsDirectory.exportAssetTo', () => {
    test('rejects with NotFoundError when the asset name does not exist', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        await expect(dir.exportAssetTo('missing', 'rules', asDir('/out')))
            .rejects.toThrowWithName('NotFoundError');
    });

    test('delegates to the ruleset export for the matching asset', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/hero.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        const fakeRuleset = makeFakeRuleset();
        vi.mocked(RuleSet.build).mockReturnValue(fakeRuleset as any);

        const result = await dir.exportAssetTo('hero', 'rules', asDir('/out'));

        expect(fakeRuleset.export).toHaveBeenCalledWith(expect.any(Asset), '/out');
        expect(result).toEqual({ name: 'hero', src: '/out', width: 1, height: 1 });
    });
});

describe('AssetsDirectory.exportAssetsListTo', () => {
    test('rejects with NotFoundError when any requested name is missing', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/a.jpg', 'assets/b.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        await expect(dir.exportAssetsListTo(['a', 'missing'], 'rules', asDir('/out')))
            .rejects.toThrowWithName('NotFoundError');
    });

    test('exports every matching asset in the list', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/a.jpg', 'assets/b.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        const fakeRuleset = makeFakeRuleset();
        vi.mocked(RuleSet.build).mockReturnValue(fakeRuleset as any);

        const result = await dir.exportAssetsListTo(['a', 'b'], 'rules', asDir('/out'));

        expect(fakeRuleset.export).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(2);
    });
});

describe('AssetsDirectory.exportDirectoryTo', () => {
    test('exports every asset in the directory', async () => {
        vi.mocked(glob).mockResolvedValue(['assets/a.jpg', 'assets/b.jpg', 'assets/c.jpg']);
        const dir = await AssetsDirectory.build('assets', ['jpg'] as any);

        const fakeRuleset = makeFakeRuleset();
        vi.mocked(RuleSet.build).mockReturnValue(fakeRuleset as any);

        const result = await dir.exportDirectoryTo('rules', asDir('/out'));

        expect(fakeRuleset.export).toHaveBeenCalledTimes(3);
        expect(result).toHaveLength(3);
    });
});