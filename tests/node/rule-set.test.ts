import { describe, test, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { Asset } from '../../src/scripts/node/sharp/asset.js';
import { RuleSet } from '../../src/scripts/node/sharp/rule-set.js';
import { AssetsHashRecords } from '../../src/scripts/node/sharp/assets-hash-records.js';
import { rulesetSchema, allRuleClassesMap } from '../../src/scripts/node/sharp/rule-registry.js';
import { dummy } from '../setup.js';
import { createHashFromFile } from '../../src/scripts/node/writers/hash.js';
import { asDir, asHash } from '../utils.js';
import { _stabilizePath } from '../../src/tools/companion-util.js';


vi.mock('node:fs', () => {
    const existsSync = vi.fn();
    const readFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const unlinkSync = vi.fn();
    return {
        default: { existsSync, readFileSync, mkdirSync, unlinkSync },
        existsSync, readFileSync, mkdirSync, unlinkSync,
    };
});

const { sharpToFile, sharpFactory } = vi.hoisted(() => {
    const sharpToFile = vi.fn(async () => ({ size: 123 }));
    const sharpFactory = vi.fn(() => ({ toFile: sharpToFile }));
    return { sharpToFile, sharpFactory };
});
vi.mock('sharp', () => ({ default: sharpFactory }));

vi.mock('../../src/scripts/node/sharp/assets-hash-records.js', () => ({
    AssetsHashRecords: {
        getHashRecord: vi.fn(() => []),
        setHashRecord: vi.fn(),
        write: vi.fn(),
    },
}));

vi.mock('../../src/scripts/node/writers/hash.js', () => ({
    createHashFromBuffer: vi.fn((buf: any) => 'rsh-' + String(buf).length),
    createHashFromFile: vi.fn((p: string) => `filehash:${p}`),
}));


vi.mock('../../../tools/console.js', () => ({
    Log: { msg: vi.fn(), file: vi.fn() },
}));


vi.mock('../../src/scripts/node/sharp/rule-registry.js', async () => {
    const { AssetRule, BatchRule, ExportRule } = await vi.importActual<typeof import('../../src/scripts/node/sharp/rule.js')>('../../src/scripts/node/sharp/rule.js');
    const { z } = await vi.importActual<typeof import('zod')>('zod');

    const anySchema = z.object({}).loose();

    class TestAssetRule extends AssetRule<any> {
        static readonly ownName = 'TestAssetRule';
        static readonly schema = anySchema;
        static readonly priority = 3;
        static readonly enforceCalls: Array<{ asset: any; sharpAsset: any }> = [];
        enforce(asset: any, sharpAsset: any) {
            TestAssetRule.enforceCalls.push({ asset, sharpAsset });
            // Simulate a real editing rule: renames the asset in place.
            asset.outName = asset.name + '-edited';
            return sharpAsset;
        }
    }

    class TestBatchRule extends BatchRule<any> {
        static readonly ownName = 'TestBatchRule';
        static readonly schema = anySchema;
        static readonly priority = 5;
        static readonly enforceCalls: any[][] = [];
        enforce(assetsList: any[]) {
            TestBatchRule.enforceCalls.push(assetsList);
        }
    }

    class TestExportRule extends ExportRule<any> {
        static readonly ownName = 'TestExportRule';
        static readonly schema = anySchema;
        static readonly priority = 5;
        static readonly enforceCalls: Array<{ asset: any; dest: any }> = [];
        enforce(asset: any, dest: any) {
            TestExportRule.enforceCalls.push({ asset, dest });
            return { name: asset.name, src: dest, width: 10, height: 10 };
        }
    }

    class SecondExportRule extends ExportRule<any> {
        static readonly ownName = 'SecondExportRule';
        static readonly schema = anySchema;
        static readonly priority = 5;
        enforce(asset: any, dest: any) {
            return { name: asset.name, src: dest, width: 1, height: 1 };
        }
    }

    const rulesetSchema: Record<string, any> = {
        TestAssetRule: TestAssetRule.schema.optional(),
        TestBatchRule: TestBatchRule.schema.optional(),
        TestExportRule: TestExportRule.schema.optional(),
        SecondExportRule: SecondExportRule.schema.optional(),
    };
    const allRuleClassesMap = new Map<string, any>([
        ['TestAssetRule', TestAssetRule],
        ['TestBatchRule', TestBatchRule],
        ['TestExportRule', TestExportRule],
        ['SecondExportRule', SecondExportRule],
    ]);

    return {
        rulesetSchema,
        allRuleClassesMap,
    };
});
var __fixtures: any = {};
allRuleClassesMap.forEach(rule => __fixtures[rule.ownName] = rule);

// RuleSet caches instances by directory + filename in a static, module-lifetime cache.
// Each test uses its own virtual directory to stay isolated from that cache.
let dirCounter = 0;
const uniqueDir = () => asDir(`virtual/dir-${dirCounter++}`);

function setupRulesetFile(dir: string, ruleEntries: Record<string, object>) {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(ruleEntries));
}

function makeAsset(dir: string, filename: string) {
    return new Asset(path.join(dir, filename));
}

beforeEach(() => {
    vi.clearAllMocks();
    __fixtures.TestAssetRule.enforceCalls.length = 0;
    __fixtures.TestBatchRule.enforceCalls.length = 0;
    __fixtures.TestExportRule.enforceCalls.length = 0;
    vi.mocked(AssetsHashRecords.getHashRecord as any).mockReturnValue([]);
});


describe('RuleSet.build - construction', () => {
    test('throws NullPointerError when the ruleset file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(() => RuleSet.build(uniqueDir(), 'rules')).toThrowWithName('FileNotFoundError');
    });

    test('categorizes parsed entries into asset rules, batch rules, and an export rule without throwing', () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {}, TestBatchRule: {}, TestExportRule: {} });
        expect(() => RuleSet.build(dir, 'rules')).not.toThrow();
    });

    test('throws when the ruleset declares more than one export rule', () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestExportRule: {}, SecondExportRule: {} });
        expect(() => RuleSet.build(dir, 'rules')).toThrow(/only have one export rule/);
    });

    test('produces the same hash regardless of key order in the ruleset JSON', () => {
        const dirA = uniqueDir();
        setupRulesetFile(dirA, { TestAssetRule: {}, TestBatchRule: {} });
        const a = RuleSet.build(dirA, 'rules');

        const dirB = uniqueDir();
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('{"TestBatchRule":{},"TestAssetRule":{}}');
        const b = RuleSet.build(dirB, 'rules');

        expect(a.hash).toBe(b.hash);
    });

    test('caches instances by directory + ruleset file name, without re-reading the file', () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, {});
        const first = RuleSet.build(dir, 'rules');
        const readCallsBefore = vi.mocked(fs.readFileSync).mock.calls.length;

        const second = RuleSet.build(dir, 'rules');

        expect(second).toBe(first);
        expect(vi.mocked(fs.readFileSync).mock.calls.length).toBe(readCallsBefore);
    });

    test('produces independent instances for different directories', () => {
        const dirA = uniqueDir();
        setupRulesetFile(dirA, {});
        const a = RuleSet.build(dirA, 'rules');

        const dirB = uniqueDir();
        setupRulesetFile(dirB, {});
        const b = RuleSet.build(dirB, 'rules');

        expect(a).not.toBe(b);
    });
});


describe('RuleSet.enforce', () => {
    test('enforces batch rules then asset rules on non-conforming assets, and writes them to disk', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {}, TestBatchRule: {} });
        const ruleset = RuleSet.build(dir, 'rules');

        const asset1 = makeAsset(dir, 'a.jpg');
        const asset2 = makeAsset(dir, 'b.jpg');
        const saveSpy1 = vi.spyOn(asset1, 'saveEdits');
        const saveSpy2 = vi.spyOn(asset2, 'saveEdits');

        await ruleset.enforce([asset1, asset2]);

        expect(__fixtures.TestBatchRule.enforceCalls).toHaveLength(1);
        expect(__fixtures.TestBatchRule.enforceCalls[0]).toEqual([asset1, asset2]);
        expect(__fixtures.TestAssetRule.enforceCalls).toHaveLength(2);
        expect(sharpToFile).toHaveBeenCalledTimes(2);
        expect(saveSpy1).toHaveBeenCalledOnce();
        expect(saveSpy2).toHaveBeenCalledOnce();
    });

    test('skips assets whose current file hash is already recorded as conforming', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {} });

        const asset1 = makeAsset(dir, 'already-done.jpg');
        const asset2 = makeAsset(dir, 'needs-work.jpg');
        vi.mocked(AssetsHashRecords.getHashRecord).mockReturnValue([asHash(`filehash:${asset1.path}`)]);

        const ruleset = RuleSet.build(dir, 'rules');
        await ruleset.enforce([asset1, asset2]);

        expect(__fixtures.TestAssetRule.enforceCalls).toHaveLength(1);
        expect(__fixtures.TestAssetRule.enforceCalls[0]!.asset).toBe(asset2);
    });

    test('does nothing when every asset already conforms', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {}, TestBatchRule: {} });
        const asset = makeAsset(dir, 'done.jpg');
        vi.mocked(AssetsHashRecords.getHashRecord).mockReturnValue([asHash(`filehash:${asset.path}`)]);
        const ruleset = RuleSet.build(dir, 'rules');
        await ruleset.enforce([asset]);

        expect(__fixtures.TestBatchRule.enforceCalls).toHaveLength(0);
        expect(__fixtures.TestAssetRule.enforceCalls).toHaveLength(0);
        expect(sharpToFile).not.toHaveBeenCalled();
    });

    test('rejects when a non-conforming asset does not belong to the ruleset directory', async () => {
        const dir = uniqueDir();
        const otherDir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {} });
        const ruleset = RuleSet.build(dir, 'rules');

        const wrongAsset = makeAsset(otherDir, 'oops.jpg');
        await expect(ruleset.enforce([wrongAsset])).rejects.toThrow();
    });

    test('deletes the previous file when an asset is renamed within the same directory', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {} }); // fixture rule renames the asset in place
        const ruleset = RuleSet.build(dir, 'rules');
        const asset = makeAsset(dir, 'original.jpg');

        await ruleset.enforce([asset]);

        expect(fs.unlinkSync).toHaveBeenCalledWith(_stabilizePath(path.join(dir, 'original.jpg')));
    });

    test('updates the hash record after enforcing, and only persists it to disk when writeHashes is true', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {} });
        const ruleset = RuleSet.build(dir, 'rules');

        await ruleset.enforce([makeAsset(dir, 'a.jpg')]);
        expect(AssetsHashRecords.setHashRecord).toHaveBeenCalledWith(dir, ruleset.hash, expect.any(Array));
        expect(AssetsHashRecords.write).not.toHaveBeenCalled();

        await ruleset.enforce([makeAsset(dir, 'b.jpg')], true);
        expect(AssetsHashRecords.write).toHaveBeenCalledOnce();
    });
});


describe('RuleSet.export', () => {
    test('rejects when the ruleset has no export rule', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestAssetRule: {} });
        const ruleset = RuleSet.build(dir, 'rules');

        await expect(ruleset.export(makeAsset(dir, 'a.jpg'), asDir('/exports')))
            .rejects.toThrow(/No export rule/);
    });

    test('exports via a clone with edits discarded, leaving the original asset untouched', async () => {
        const dir = uniqueDir();
        setupRulesetFile(dir, { TestExportRule: {} });
        const ruleset = RuleSet.build(dir, 'rules');

        const asset = makeAsset(dir, 'a.jpg');
        asset.outName = (asset.name + '-pending') as any; // pending edit that export must ignore

        const result = await ruleset.export(asset, asDir('/exports'));

        expect(asset.outName).toBe(asset.name + '-pending'); // original untouched
        expect(__fixtures.TestExportRule.enforceCalls).toHaveLength(1);

        const passedAsset = __fixtures.TestExportRule.enforceCalls[0]!.asset;
        expect(passedAsset).not.toBe(asset); // a clone, not the same instance
        expect(passedAsset.outName).toBe(asset.name); // edits discarded on the clone

        expect(result).toEqual({ name: asset.name, src: '/exports', width: 10, height: 10 });
    });
});