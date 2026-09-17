// @vitest-environment jsdom

import { describe, test, expect } from 'vitest';
import { glob } from 'glob';
import path from "node:path";

// HELPERS =============================================================================
function defineCustomElement(constructor: CustomElementConstructor) {
    const tag = `test-el-${crypto.randomUUID()}`;
    window.customElements.define(tag, constructor);
}

// Modules Import
const mixinModulesPaths = await glob('src/**/*.mixin.ts');
const mixinModules =
    await Promise.all(
        mixinModulesPaths.map(
            modulePath => import(path.resolve(modulePath))));
const entries = Object.entries(mixinModules);

describe("all mixins must conform to the schema extabilished by the template", () => {

    test("at least one *.mixin.ts path exists", () => {
        expect(mixinModulesPaths.length).toBeGreaterThan(0);
    });

    test("at least one module exists", () => {
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.every(entry => entry[0]))
    });

    test("exactly one module per path is exported", () => {
        expect(entries.length).toBe(mixinModulesPaths.length);
    });
});

for (const [path, mod] of entries) {
    describe(`verify compliance of exports from ${path}`, () => {
        const exportEntries = Object.entries(mod as any as Record<string, unknown>);
        const functionExports = exportEntries.filter(([, v]) => typeof v === 'function');
        const symbolExports = exportEntries.filter(([, v]) => typeof v === 'symbol');
        const otherExports = exportEntries.filter(
            ([, v]) => typeof v !== 'function' && typeof v !== 'symbol'
        );

        test('module exports exactly one function (no more)', () => {
            expect(functionExports).toHaveLength(1);
            expect(functionExports[0]).toBeDefined();
        });
        // Extract the mixin function
        const [, mixinFn] = functionExports[0]!;

        test('module exports only a function and symbols', () => {
            expect(otherExports).toHaveLength(0);
        });

        test('the exported function has a `getValidated` method', () => {
            expect(typeof (mixinFn as any).getValidated).toBe('function');
        });

        test('the exported function creates a mixin (extends a base class)', () => {
            let Dummy: any;
            let Result: any;
            let instance: any;
            try {
                Dummy = class Dummy { }
                Result = (mixinFn as any)(Dummy);
                defineCustomElement(Result);
                instance = new Result();
            } catch (e) {
                Dummy = class Dummy extends HTMLElement { }
                Result = (mixinFn as any)(Dummy);
                defineCustomElement(Result);
                instance = new Result();
            }
            expect(typeof Result).toBe('function');
            expect(instance).toBeInstanceOf(Dummy);

        });

        test('the method `getValidated` recognizes a valid instance; throws otherwise', () => {
            class Dummy { }
            const Result = (mixinFn as any)(Dummy);

            defineCustomElement(Result);
            let instance: any;
            try {
                const temp = new Result();
                instance = temp;

            } catch (e) {
                class Dummy extends HTMLElement { }
                const Result = (mixinFn as any)(Dummy);

                defineCustomElement(Result);
                instance = new Result();
            }
            const stranger = new Dummy();

            expect(() => (mixinFn as any).getValidated(instance)).not.toThrow();
            expect(() => (mixinFn as any).getValidated(stranger)).toThrow();
        });
    });
}