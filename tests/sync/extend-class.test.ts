// Assumes this file is co-located with rule-constructor.ts and rule.ts (same relative import paths).

import { describe, test, expect } from 'vitest';
import { extendsClass } from '../../src/tools/encapsulation.js';


class Grandparent { }
class Parent extends Grandparent { }
class Child extends Parent { }
class Unrelated { }

describe('extendsClass', () => {
    test('returns true for a direct subclass', () => {
        expect(extendsClass(Parent, Grandparent)).toBe(true);
    });

    test('returns true for a multi-level (transitive) subclass', () => {
        expect(extendsClass(Child, Grandparent)).toBe(true);
    });

    test('returns false for an unrelated class', () => {
        expect(extendsClass(Unrelated, Grandparent)).toBe(false);
    });

    test('returns false when comparing a class to itself (checks strict ancestry, not identity)', () => {
        expect(extendsClass(Grandparent, Grandparent)).toBe(false);
    });

});

