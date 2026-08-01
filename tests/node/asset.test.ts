import { describe, expect, test } from 'vitest';
import { Asset } from '../../src/scripts/node/sharp/asset.js';
import { IllegalArgumentError } from '../../src/errors/common-errors.mjs';
import path from 'path';
import { asName, asDir, asExt } from '../utils.js';


describe('Asset - constructor & initial state', () => {
    test('parses a plain path with no query string', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(asset.path).toBe('src/assets/hero.jpg');
        expect(asset.dir).toBe('src/assets');
        expect(asset.name).toBe('hero');
        expect(asset.ext).toBe('jpg');
    });

    test('parses a single query parameter after $', () => {
        const asset = new Asset('src/assets/hero$wargh=14.jpg');
        expect(asset.name).toBe('hero');
        expect(asset.getParam('wargh')).toBe('14');
    });

    test('parses multiple query parameters, preserving definition order', () => {
        const asset = new Asset('src/assets/hero$a=1&b=2&c=3.jpg');
        expect(asset.getParam('a')).toBe('1');
        expect(asset.getParam('b')).toBe('2');
        expect(asset.getParam('c')).toBe('3');
    });

    test('treats a trailing $ with nothing after it as having no params', () => {
        const asset = new Asset('src/assets/hero$.jpg');
        expect(asset.name).toBe('hero');
        expect(asset.hasParam('w')).toBe(false);
    });

    test('treats a $ followed only by whitespace as having no params', () => {
        const asset = new Asset('src/assets/hero$   .jpg');
        expect(asset.name).toBe('hero');
        expect(asset.hasParam('w')).toBe(false);
    });

    test('throws when the path contains more than one $', () => {
        expect(() => new Asset('src/assets/hero$w=1$h=2.jpg')).toThrow(IllegalArgumentError);
    });

    test('throws when a query entry is malformed (missing =)', () => {
        expect(() => new Asset('src/assets/hero$notapair.jpg')).toThrow(IllegalArgumentError);
    });

    test('initializes out* state as a copy of the initial state', () => {
        const asset = new Asset('src/assets/hero$w=1.jpg');
        expect(asset.outName).toBe(asset.name);
        expect(asset.outDir).toBe(asset.dir);
        expect(asset.outExt).toBe(asset.ext);
        expect(asset.outPath).toBe(asset.path);
        expect(asset.getOutParam('w')).toBe(asset.getParam('w'));
    });

    test('getParam/hasParam only ever reflect the original (constructor-time) parameters', () => {
        const asset = new Asset('src/assets/hero$w=1.jpg');
        asset.setOutParam('w', '999');
        asset.setOutParam('h', '2');
        expect(asset.getParam('w')).toBe('1');
        expect(asset.hasParam('h')).toBe(false);
    });

});

describe('Asset - outName setter', () => {
    test('accepts a valid multi-character name', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outName = asName('hero-cropped');
        expect(asset.outName).toBe('hero-cropped');
    });

    test('rejects names with illegal characters', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => (asset.outName = asName('hero!'))).toThrow(IllegalArgumentError);
        expect(() => (asset.outName = asName('hero name'))).toThrow(IllegalArgumentError);
    });

    test('assigning the same value again does not throw and leaves the value unchanged', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => (asset.outName = asName('hero'))).not.toThrow();
        expect(asset.outName).toBe('hero');
    });

    test('does not affect outDir, outExt, or out query params', () => {
        const asset = new Asset('src/assets/hero$w=1.jpg');
        asset.outName = asName('renamed');
        expect(asset.outDir).toBe(asset.dir);
        expect(asset.outExt).toBe(asset.ext);
        expect(asset.getOutParam('w')).toBe('1');
    });
});

describe('Asset - outDir setter', () => {
    test('accepts a relative multi-segment path', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outDir = asDir('src/assets/processed');
        expect(asset.outDir).toBe('src/assets/processed');
    });

    test('collapses redundant path separators', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outDir = asDir('src/assets//processed');
        expect(asset.outDir).toBe('src/assets/processed');
    });

    test('resolves "." segments', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outDir = asDir('src/assets/./processed');
        expect(asset.outDir).toBe('src/assets/processed');
    });

    test('rejects an empty directory (normalizes to "." which contains a disallowed character)', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => (asset.outDir = asDir(''))).toThrow(IllegalArgumentError);
    });

    test('rejects a path with an extension-like final segment', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => (asset.outDir = asDir('src/assets/hero.png'))).toThrow(IllegalArgumentError);
    });

    test('rejects invalid characters', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => (asset.outDir = asDir('src/assets/pro cessed'))).toThrow(IllegalArgumentError);
    });
});

describe('Asset - outExt setter', () => {
    test('updates the extension', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outExt = asExt('png');
        expect(asset.outExt).toBe('png');
    });

    test('assigning the same value again does not throw', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => (asset.outExt = asExt('jpg'))).not.toThrow();
        expect(asset.outExt).toBe('jpg');
    });
});

describe('Asset - outPath getter', () => {
    test('equals the original path when no edits have been made', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(asset.outPath).toBe('src/assets/hero.jpg');
    });

    test('reflects a changed outName', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outName = asName('hero-cropped');
        expect(asset.outPath).toBe('src/assets/hero-cropped.jpg');
    });

    test('reflects a changed outDir', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outDir = asDir('src/assets/processed');
        expect(asset.outPath).toBe('src/assets/processed/hero.jpg');
    });

    test('reflects a changed outExt', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outExt = asExt('png');
        expect(asset.outPath).toBe('src/assets/hero.png');
    });

    test('includes a query string suffix when out params are present', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.setOutParam('format', 'web');
        expect(asset.outPath).toBe('src/assets/hero$format=web.jpg');
    });

    test('joins multiple out params with &, preserving insertion order', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.setOutParam('w', 'small');
        asset.setOutParam('h', 'tall');
        expect(asset.outPath).toBe('src/assets/hero$w=small&h=tall.jpg');
    });

    test('omits the $ suffix entirely when there are no out params', () => {
        const asset = new Asset('src/assets/plain.jpg');
        asset.outName = asName('renamed');
        expect(asset.outPath).toBe('src/assets/renamed.jpg');
        expect(asset.outPath).not.toContain('$');
    });
});

describe('Asset - setOutParam / getOutParam / hasOutParam', () => {
    test('sets and retrieves a new parameter', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.setOutParam('format', 'web');
        expect(asset.getOutParam('format')).toBe('web');
        expect(asset.hasOutParam('format')).toBe(true);
    });

    test('overwrites an existing out parameter', () => {
        const asset = new Asset('src/assets/hero$w=1.jpg');
        expect(asset.getOutParam('w')).toBe('1');
        asset.setOutParam('w', '2');
        expect(asset.getOutParam('w')).toBe('2');
    });

    test('rejects an invalid key', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => asset.setOutParam('bad key', 'value')).toThrow(IllegalArgumentError);
    });

    test('rejects an invalid value', () => {
        const asset = new Asset('src/assets/hero.jpg');
        expect(() => asset.setOutParam('key', 'bad value')).toThrow(IllegalArgumentError);
    });
});

describe('Asset - saveEdits', () => {
    test('promotes pending out-state to become the current state', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outName = asName('hero-final');
        asset.outDir = asDir('src/assets/processed');
        asset.outExt = asExt('png');

        const expectedPath = asset.outPath;
        asset.saveEdits();

        expect(asset.name).toBe('hero-final');
        expect(asset.dir).toBe('src/assets/processed');
        expect(asset.ext).toBe('png');
        expect(asset.path).toBe(expectedPath);
    });

    test('promotes pending out-params to become the current params', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.setOutParam('w', 'small');
        asset.saveEdits();

        expect(asset.getParam('w')).toBe('small');
    });
});

describe('Asset - discardEdits', () => {
    test('resets outName/outDir/outExt back to the original values', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outName = asName('changed');
        asset.outDir = asDir('src/assets/other');
        asset.outExt = asExt('png');

        asset.discardEdits();

        expect(asset.outName).toBe(asset.name);
        expect(asset.outDir).toBe(asset.dir);
        expect(asset.outExt).toBe(asset.ext);
    });

    test('resets out params back to the original params, discarding any setOutParam calls', () => {
        const asset = new Asset('src/assets/hero$w=1.jpg');
        asset.setOutParam('w', '999');
        asset.setOutParam('h', '2');

        asset.discardEdits();

        expect(asset.getOutParam('w')).toBe('1');
        expect(asset.hasOutParam('h')).toBe(false);
    });

    test('does not affect an already-saved current state', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outName = asName('permanent');
        asset.saveEdits();

        asset.outName = asName('temporary');
        asset.discardEdits();

        expect(asset.name).toBe('permanent');
        expect(asset.outName).toBe('permanent');
    });
});

describe('Asset - clone', () => {
    test('produces an independent instance for the same original path', () => {
        const asset = new Asset('src/assets/hero.jpg');
        const clone = asset.clone();

        expect(clone.path).toBe(asset.path);
        expect(clone.name).toBe(asset.name);
        expect(clone).not.toBe(asset);
    });

    test('mutating the clone does not affect the original', () => {
        const asset = new Asset('src/assets/hero.jpg');
        const clone = asset.clone();

        clone.outName = asName('clone-only');

        expect(asset.outName).toBe('hero');
        expect(clone.outName).toBe('clone-only');
    });

    test('mutating the original after cloning does not affect the clone', () => {
        const asset = new Asset('src/assets/hero.jpg');
        const clone = asset.clone();

        asset.outName = asName('original-only');

        expect(clone.outName).toBe('hero');
    });

    test('copies pending (unsaved) out-edits from the source', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.outName = asName('pending-name');
        asset.outDir = asDir('src/assets/pending');
        asset.outExt = asExt('png');

        const clone = asset.clone();

        expect(clone.outName).toBe('pending-name');
        expect(clone.outDir).toBe('src/assets/pending');
        expect(clone.outExt).toBe('png');
    });

    test('copies pending (unsaved) out-params from the source', () => {
        const asset = new Asset('src/assets/hero.jpg');
        asset.setOutParam('w', 'small');

        const clone = asset.clone();

        expect(clone.getOutParam('w')).toBe('small');
    });
});

describe('Asset - equals', () => {
    test('two freshly constructed assets from the same path are equal', () => {
        const a = new Asset('src/assets/hero.jpg');
        const b = new Asset('src/assets/hero.jpg');
        expect(a.equals(b)).toBe(true);
    });

    test('two assets are not equal once one has a diverging pending edit', () => {
        const a = new Asset('src/assets/hero.jpg');
        const b = new Asset('src/assets/hero.jpg');
        b.outName = asName('renamed');
        expect(a.equals(b)).toBe(false);
    });

    test('two assets from different original paths are not equal', () => {
        const a = new Asset('src/assets/hero.jpg');
        const b = new Asset('src/assets/other.jpg');
        expect(a.equals(b)).toBe(false);
    });
});