import { describe, test, expect } from 'vitest';
import { AssetRule, BatchRule, ExportRule, Rule } from '../../../src/scripts/node/sharp/rule.js';


class TestRule extends Rule<any> {
    override enforce() { return undefined; }
}
class TestAssetRule extends AssetRule<any> {
    override enforce(_asset: any, sharpAsset: any) { return sharpAsset; }
}
class TestBatchRule extends BatchRule<any> {
    override enforce(_assetsList: any[]) { /* no-op */ }
}
class TestExportRule extends ExportRule<any> {
    override async enforce(_asset: any, _dest: any) {
        return { name: 'x' as any, src: 'x', width: 1, height: 1 };
    }
}

describe('Rule - hash', () => {
    test('produces the same hash regardless of top-level key insertion order', () => {
        const a = new TestRule({ use: 'flat', enabled: true });
        const b = new TestRule({ enabled: true, use: 'flat' });
        expect(a.hash).toBe(b.hash);
    });

    test('produces different hashes for different flat, top-level data', () => {
        const a = new TestRule({ use: 'flat' });
        const b = new TestRule({ use: 'percentage' });
        expect(a.hash).not.toBe(b.hash);
    });

    test('is deterministic for identical data', () => {
        const a = new TestRule({ use: 'flat', value: 1 });
        const b = new TestRule({ use: 'flat', value: 1 });
        expect(a.hash).toBe(b.hash);
    });

    test('produces different hashes for different nested-object content', () => {
        const a = new TestRule({ extract: { top: 0, left: 0, width: 1, height: 1 } });
        const b = new TestRule({ extract: { top: 0.5, left: 0.5, width: 0.2, height: 0.2 } });
        expect(a.hash).not.toBe(b.hash);
    });

    test('produces the same hash regardless of nested-object key order', () => {
        const a = new TestRule({ extract: { top: 0, left: 0, width: 1, height: 1 } });
        const b = new TestRule({ extract: { height: 1, width: 1, left: 0, top: 0 } });
        expect(a.hash).toBe(b.hash);
    });

    test('produces the same hash regardless of key order at any depth, including inside arrays of objects', () => {
        const a = new TestRule({ list: [{ x: 1, y: 2 }, { b: 1, a: 2 }] });
        const b = new TestRule({ list: [{ y: 2, x: 1 }, { a: 2, b: 1 }] });
        expect(a.hash).toBe(b.hash);

        const c = new TestRule({ list: [{ y: [3, 4], x: 1 }, { a: 2, b: 1 }] });
        const d = new TestRule({ list: [{ x: 1, y: [3, 4] }, { b: 1, a: 2 }] });
        expect(c.hash).toBe(d.hash);

        const e = new TestRule({ list: [{ y: [3, 4], x: 1 }, { a: 2, b: 1 }] });
        const f = new TestRule({ list: [{ x: 1, y: [4, 3] }, { b: 1, a: 2 }] });
        expect(e.hash).not.toBe(f.hash);
    });
});

describe('Rule subclasses - category identity via instanceof', () => {
    test('distinguishes AssetRule, BatchRule and ExportRule instances', () => {
        const assetRule = new TestAssetRule({});
        const batchRule = new TestBatchRule({});
        const exportRule = new TestExportRule({});

        expect(assetRule).toBeInstanceOf(AssetRule);
        expect(assetRule).toBeInstanceOf(Rule);
        expect(assetRule).not.toBeInstanceOf(BatchRule);
        expect(assetRule).not.toBeInstanceOf(ExportRule);

        expect(batchRule).toBeInstanceOf(BatchRule);
        expect(batchRule).toBeInstanceOf(Rule);
        expect(batchRule).not.toBeInstanceOf(AssetRule);
        expect(batchRule).not.toBeInstanceOf(ExportRule);

        expect(exportRule).toBeInstanceOf(ExportRule);
        expect(exportRule).toBeInstanceOf(Rule);
        expect(exportRule).not.toBeInstanceOf(AssetRule);
        expect(exportRule).not.toBeInstanceOf(BatchRule);
    });
});