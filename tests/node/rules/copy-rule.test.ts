// Assumes this file is co-located with copy-rule.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Asset } from '../../../src/scripts/node/sharp/asset.js';
import { destPathCorrected } from '../../../src/scripts/node/writers/copy-file-to.js';
import { CopyRule } from '../../../src/scripts/node/sharp/rules/copy-rule.js';

vi.mock('node:fs', () => {
    const mkdirSync = vi.fn();
    return { default: { mkdirSync }, mkdirSync };
});

vi.mock('../../../src/scripts/node/writers/copy-file-to.js', () => ({
    destPathCorrected: vi.fn((assetPath: string, dest: string) => path.join(dest, path.basename(assetPath))),
}));

vi.mock('../../../src/scripts/node/writers/hash.js', () => ({
    createHashFromBuffer: vi.fn(() => 'copyhash1'),
}));

vi.mock('../../../src/scripts/shared/assets-export-classes.js', () => ({
    AssetOutput: class {
        constructor(public name: string, public src: string, public width: number, public height: number) { }
    },
}));

const { sharpMetadata, sharpToFile, sharpToFormat, sharpToBuffer, sharpFactory } = vi.hoisted(() => {
    const sharpMetadata = vi.fn(async () => ({ width: 200, height: 100 }));
    const sharpToFile = vi.fn(async () => ({ size: 10 }));
    const sharpToBuffer = vi.fn(async () => Buffer.from('data'));
    const sharpToFormat = vi.fn();
    const sharpFactory = vi.fn((srcPath: string) => {
        const instance: any = {
            metadata: sharpMetadata,
            toFile: sharpToFile,
            toFormat: (fmt: any, opts: any) => { sharpToFormat(srcPath, fmt, opts); return instance; },
            clone: () => instance,
            toBuffer: sharpToBuffer,
        };
        return instance;
    });
    return { sharpMetadata, sharpToFile, sharpToFormat, sharpToBuffer, sharpFactory };
});
vi.mock('sharp', () => ({ default: sharpFactory }));

beforeEach(() => {
    vi.clearAllMocks();
    sharpMetadata.mockResolvedValue({ width: 200, height: 100 });
    sharpToFile.mockResolvedValue({ size: 10 });
    sharpToBuffer.mockResolvedValue(Buffer.from('data'));
});

describe('CopyRule', () => {
    it('copies the asset to the destination, preserving format when none is configured', async () => {
        const rule = new CopyRule({ hash: false });
        const asset = new Asset('assets/hero.jpg');

        const result = await rule.enforce(asset, 'exports' as any);

        expect(destPathCorrected).toHaveBeenCalledWith('assets/hero.jpg', '/exports');
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/exports'), { recursive: true });
        expect(sharpToFormat).not.toHaveBeenCalled();
        expect(result).toEqual({ name: 'hero', src: path.join('/exports', 'hero.jpg'), width: 200, height: 100 });
    });

    it('converts to the configured format, updates outExt, and reflects it in the final path/output', async () => {
        const rule = new CopyRule({ hash: false, format: 'webp', formatOptions: { quality: 70 } });
        const asset = new Asset('assets/hero.jpg');

        await rule.enforce(asset, '/exports' as any);

        expect(sharpToFormat).toHaveBeenCalledWith('assets/hero.jpg', 'webp', { quality: 70 });
        expect(asset.ext).toBe('webp'); // saved after enforce
        expect(asset.path).toBe(path.join('/exports', 'hero.webp'));
    });

    it('sets a "copy" out param with a content hash when hash is enabled', async () => {
        const rule = new CopyRule({ hash: true });
        const asset = new Asset('assets/hero.jpg');

        await rule.enforce(asset, '/exports' as any);

        expect(asset.getParam('copy')).toBe('copyhash1'); // promoted by saveEdits()
    });

    it('does not set a hash out param when hash is disabled', async () => {
        const rule = new CopyRule({ hash: false });
        const asset = new Asset('assets/hero.jpg');

        await rule.enforce(asset, '/exports' as any);

        expect(asset.hasParam('copy')).toBe(false);
    });

    it('creates the destination directory before writing', async () => {
        const rule = new CopyRule({ hash: false });
        const asset = new Asset('assets/hero.jpg');

        await rule.enforce(asset, '/exports/nested' as any);

        expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/exports/nested'), { recursive: true });
    });

    it('saves the edits onto the asset after writing (path/dir/ext reflect the copy destination)', async () => {
        const rule = new CopyRule({ hash: false });
        const asset = new Asset('assets/hero.jpg');
        const originalPath = asset.path;

        await rule.enforce(asset, '/exports' as any);

        expect(asset.path).not.toBe(originalPath);
        expect(asset.dir).toBe('/exports');
    });
});