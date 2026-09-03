import { describe, test, expect, vi, beforeEach } from 'vitest';
import path from 'node:path/posix';
import { Asset } from '../../../../src/scripts/node/sharp/asset.js';
import type { dummy } from '../../../setup.js'
import { SrcsetRule } from '../../../../src/scripts/node/sharp/rules/srcset-rule.js';
import { stableHash } from '../../../../src/scripts/node/writers/hash.js';

vi.mock('node:fs', () => {
    const mkdirSync = vi.fn();
    return { default: { mkdirSync }, mkdirSync };
});


vi.mock('../../../../src/tools/console.js', () => ({
    Log: { msg: vi.fn(), file: vi.fn() },
}));

vi.mock('../../../../src/scripts/node/writers/hash.js', () => ({
    createHashFromBuffer: vi.fn(() => 'srcsethash1'),
    stableHash: vi.fn(() => 'srcsethash1'),
}));

vi.mock('../../../../src/scripts/shared/assets-export-classes.js', () => ({
    AssetOutput: class {
        constructor(public name: string, public src: string, public width: number, public height: number) { }
    },
    SrcsetOutput: {
        from: vi.fn((subRes: any) => {
            const entries: Array<{ width: number; path: string }> = [];
            return {
                width: subRes.width,
                entries,
                add(width: number, p: string) { entries.push({ width, path: p }); },
            };
        }),
    },
}));

const { sharpMetadata, sharpToFile, sharpResize, sharpToBuffer, sharpFactory } = vi.hoisted(() => {
    const sharpMetadata = vi.fn(async () => ({ width: 800, height: 400 }));
    const sharpToFile = vi.fn(async () => ({ size: 10 }));
    const sharpToBuffer = vi.fn(async () => Buffer.from('data'));
    const sharpResize = vi.fn();
    const sharpFactory = vi.fn((srcPath: string) => {
        const instance: any = {
            metadata: sharpMetadata,
            toFile: sharpToFile,
            toFormat: () => instance,
            clone: () => instance,
            toBuffer: sharpToBuffer,
            resize: (opts: any) => { sharpResize(srcPath, opts); return instance; },
        };
        return instance;
    });
    return { sharpMetadata, sharpToFile, sharpResize, sharpToBuffer, sharpFactory };
});
vi.mock('sharp', () => ({ default: sharpFactory }));

beforeEach(() => {
    vi.clearAllMocks();
    sharpMetadata.mockResolvedValue({ width: 800, height: 400 });
    sharpToFile.mockResolvedValue({ size: 10 });
    sharpToBuffer.mockResolvedValue(Buffer.from('data'));
});

describe('SrcsetRule', () => {
    test('throws ValidationError when the largest requested width is bigger than the source width', async () => {
        const rule = new SrcsetRule({ hash: false, widths: [801], behavior: 'throw' }); // equal to source width
        const asset = new Asset('assets/hero.jpg');

        await expect(rule.enforce(asset, '/exports' as any)).rejects.toThrowWithName('ValidationError');
    });

    test('does not throw when the largest requested width is strictly smaller than the source width', async () => {
        const rule = new SrcsetRule({ hash: false, widths: [799], behavior: 'throw' });
        const asset = new Asset('assets/hero.jpg');

        await expect(rule.enforce(asset, '/exports' as any)).resolves.not.toThrow();
    });

    test('produces one resized output per configured width, derived from the copied/reformatted base asset, not the original source', async () => {
        const rule = new SrcsetRule({ hash: false, widths: [400, 200], behavior: 'throw' });
        const asset = new Asset('assets/hero.jpg');

        const result: any = await rule.enforce(asset, '/exports' as any);

        expect(sharpResize).toHaveBeenCalledTimes(2);
        for (const [srcPathArg] of sharpResize.mock.calls) {
            // super.enforce() already copied the file to /exports and saved edits onto the
            // asset before this loop runs, so each variant must resize from that destination.
            expect(srcPathArg).toBe(path.join('/exports', 'hero.jpg'));
        }
        expect(result.entries).toHaveLength(2);
        expect(result.entries.map((e: any) => e.width).sort((a: number, b: number) => a - b)).toEqual([200, 400]);
    });

    test('encodes the width (and, when enabled, a content hash) into the written output path via out params', async () => {
        const rule = new SrcsetRule({ hash: true, widths: [400], behavior: 'throw' });
        const asset = new Asset('assets/hero.jpg');

        await rule.enforce(asset, '/exports' as any);

        // call 0 = the base copy from CopyRule.enforce, call 1 = this width variant
        //@ts-ignore
        const writtenPath = sharpToFile.mock.calls.at(-1)![0] as unknown as string;
        expect(writtenPath).toContain('w=400px');
        expect(writtenPath).toContain('hash=srcsethash1');
    });

    test('does not encode a hash param when hashing is disabled', async () => {
        const rule = new SrcsetRule({ hash: false, widths: [400], behavior: 'throw' });
        const asset = new Asset('assets/hero.jpg');

        await rule.enforce(asset, '/exports' as any);

        //@ts-ignore
        const writtenPath = sharpToFile.mock.calls.at(-1)![0] as unknown as string;
        expect(writtenPath).toContain('w=400px');
        expect(writtenPath).not.toContain('hash=');
    });
});