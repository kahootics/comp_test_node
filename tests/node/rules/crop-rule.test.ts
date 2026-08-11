import { describe, test, expect, vi } from 'vitest';
import { CropRule, Use } from '../../../src/scripts/node/sharp/rules/crop-rule.js';
import { Asset } from '../../../src/scripts/node/sharp/asset.js';

function fakeSharp(metadata: { width: number; height: number }) {
    const extracted = { marker: 'extracted' };
    const self: any = {
        clone: vi.fn(() => self),
        metadata: vi.fn(async () => metadata),
        extract: vi.fn((_opts: any) => extracted),
    };
    return self;
}

describe('CropRule', () => {
    test('extracts using flat pixel coordinates and marks the asset as cropped', async () => {
        const rule = new CropRule({ use: Use.FLAT, extract: { top: 10, left: 5, width: 100, height: 50 } });
        const asset = new Asset('assets/hero.jpg');
        const sharpAsset = fakeSharp({ width: 800, height: 600 });

        const result = await rule.enforce(asset, sharpAsset);

        expect(sharpAsset.extract).toHaveBeenCalledWith({ top: 10, left: 5, width: 100, height: 50 });
        expect(asset.getOutParam('crop')).toBe(rule.hash);
        expect(result).toEqual({ marker: 'extracted' });
    });

    test('computes pixel coordinates from percentages and floors them', async () => {
        const rule = new CropRule({ use: Use.PERCENTAGE, extract: { top: 0.1, left: 0.2, width: 0.5, height: 0.5 } });
        const asset = new Asset('assets/hero.jpg');
        const sharpAsset = fakeSharp({ width: 801, height: 601 }); // odd numbers to exercise flooring

        await rule.enforce(asset, sharpAsset);

        expect(sharpAsset.extract).toHaveBeenCalledWith({
            top: Math.floor(601 * 0.1),
            left: Math.floor(801 * 0.2),
            width: Math.floor(801 * 0.5),
            height: Math.floor(601 * 0.5),
        });
    });

    test('is a no-op when the asset was already cropped according to this exact rule', async () => {
        const rule = new CropRule({ use: Use.FLAT, extract: { top: 0, left: 0, width: 10, height: 10 } });
        const asset = new Asset('assets/hero.jpg');
        // Simulate a file that was already processed: the crop marker lives in the *current*
        // (not pending) query params, which is only reachable via setOutParam + saveEdits.
        asset.setOutParam('crop', rule.hash);
        asset.saveEdits();
        const sharpAsset = fakeSharp({ width: 100, height: 100 });

        const result = await rule.enforce(asset, sharpAsset);

        expect(sharpAsset.extract).not.toHaveBeenCalled();
        expect(result).toBe(sharpAsset);
    });

    test('throws when the asset was already cropped according to a different rule', async () => {
        const rule = new CropRule({ use: Use.FLAT, extract: { top: 0, left: 0, width: 10, height: 10 } });
        const asset = new Asset('assets/hero.jpg');
        asset.setOutParam('crop', 'aaaaaaaa');
        asset.saveEdits();
        const sharpAsset = fakeSharp({ width: 100, height: 100 });

        await expect(rule.enforce(asset, sharpAsset)).rejects.toThrow();
        expect(sharpAsset.extract).not.toHaveBeenCalled();
    });
});