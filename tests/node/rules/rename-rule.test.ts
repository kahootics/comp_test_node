// Assumes this file is co-located with rename-rule.ts, and that the empty-name validation
// uses `.some()` instead of `.map()` (see conversation — as written, `.map()` always throws).

import { describe, it, expect } from 'vitest';
import { Asset } from '../../../src/scripts/node/sharp/asset.js';
import { RenameRule } from '../../../src/scripts/node/sharp/rules/rename-rule.js';

describe('RenameRule', () => {
    it('does nothing when given an empty asset list', () => {
        const rule = new RenameRule({ include: /.*/s, sort: 'name', names: ['a', 'b'] });
        expect(() => rule.enforce([])).not.toThrow();
    });

    it('throws ValidationError when a target name is empty after trimming', () => {
        const rule = new RenameRule({ include: /.*/s, sort: 'name', names: ['   '] });
        const asset = new Asset('assets/x.jpg');
        expect(() => rule.enforce([asset])).toThrowWithName('ValidationError');
    });

    it('throws ValidationError when target names are not unique', () => {
        const rule = new RenameRule({ include: /.*/s, sort: 'name', names: ['dup', 'dup'] });
        const asset = new Asset('assets/x.jpg');
        expect(() => rule.enforce([asset])).toThrowWithName('ValidationError');
    });

    it('assigns leftover target names, in sort order, to assets not already correctly named', () => {
        const rule = new RenameRule({ include: /.*/s, sort: 'name', names: ['1', '2', '3'] });
        const b = new Asset('assets/b.jpg');
        const a = new Asset('assets/a.jpg');
        const c = new Asset('assets/c.jpg');

        rule.enforce([b, a, c]);

        expect(a.outName).toBe('1');
        expect(b.outName).toBe('2');
        expect(c.outName).toBe('3');
    });

    it('leaves assets whose current name already matches a target name untouched, and only fills the remaining slots', () => {
        const rule = new RenameRule({ include: /.*/s, sort: 'name', names: ['a', 'x', 'z'] });
        const already = new Asset('assets/a.jpg'); // already named 'a', one of the targets
        const first = new Asset('assets/m.jpg');
        const second = new Asset('assets/n.jpg');

        rule.enforce([already, first, second]);

        expect(already.outName).toBe(already.name); // untouched
        expect(first.outName).toBe('x');
        expect(second.outName).toBe('z');
    });

    it('excludes assets not matching the include pattern from receiving a new name', () => {
        const rule = new RenameRule({ include: /^keep/, sort: 'name', names: ['final'] });
        const excluded = new Asset('assets/skip.jpg');
        const included = new Asset('assets/keepme.jpg');

        rule.enforce([excluded, included]);

        expect(excluded.outName).toBe(excluded.name);
        expect(included.outName).toBe('final');
    });

    it('throws ValidationError when the number of renameable assets does not match the number of available names', () => {
        const rule = new RenameRule({ include: /.*/s, sort: 'name', names: ['1', '2'] });
        const a = new Asset('assets/a.jpg');
        const b = new Asset('assets/b.jpg');
        const c = new Asset('assets/c.jpg');

        expect(() => rule.enforce([a, b, c])).toThrowWithName('ValidationError');
    });
});