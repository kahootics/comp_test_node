import { describe, test, expect, vi } from 'vitest';
import { FormatRule } from '../../../../src/scripts/node/sharp/rules/format-rule.js';
import { Asset } from '../../../../src/scripts/node/sharp/asset.js';

describe('FormatRule', () => {
    test('returns the sharp instance unchanged when the asset already has the target format', () => {
        const rule = new FormatRule({ format: 'jpeg' });
        const asset = new Asset('assets/hero.jpeg');
        const sharpAsset = { toFormat: vi.fn() } as any;

        const result = rule.enforce(asset, sharpAsset);

        expect(result).toBe(sharpAsset);
        expect(sharpAsset.toFormat).not.toHaveBeenCalled();
        expect(asset.outExt).toBe(asset.ext);
    });

    test('converts format and updates outExt when the asset has a different format', () => {
        const rule = new FormatRule({ format: 'webp', formatOptions: { quality: 80 } });
        const asset = new Asset('assets/hero.jpg');
        const converted = { marker: 'converted' };
        const sharpAsset = { toFormat: vi.fn(() => converted) } as any;

        const result = rule.enforce(asset, sharpAsset);

        expect(sharpAsset.toFormat).toHaveBeenCalledWith('webp', { quality: 80 });
        expect(asset.outExt).toBe('webp');
        expect(result).toBe(converted);
    });

    test('passes undefined formatOptions through when none are configured', () => {
        const rule = new FormatRule({ format: 'png' });
        const asset = new Asset('assets/hero.jpg');
        const sharpAsset = { toFormat: vi.fn(() => sharpAsset) } as any;

        rule.enforce(asset, sharpAsset);

        expect(sharpAsset.toFormat).toHaveBeenCalledWith('png', undefined);
    });

    test('repeat first test validating input with static schema', () => {
        const test = { format: 'webp', formatOptions: { quality: 80 } }
        const testJson = JSON.stringify(test);

        const rule = new FormatRule(FormatRule.schema.parse(JSON.parse(testJson)));
        const asset = new Asset('assets/hero.jpg');
        const converted = { marker: 'converted' };
        const sharpAsset = { toFormat: vi.fn(() => converted) } as any;

        const result = rule.enforce(asset, sharpAsset);

        expect(sharpAsset.toFormat).toHaveBeenCalledWith('webp', { quality: 80 });
        expect(asset.outExt).toBe('webp');
        expect(result).toBe(converted);
    })
});