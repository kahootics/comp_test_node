// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { ContextStack } from '../../src/scripts/browser/utilities/context-stack.js';

const ORDER_VAR = '--stacking-order';
const testStack = new ContextStack(ORDER_VAR);

afterEach(() => { testStack.clear(); document.body.innerHTML = ''; });

const make = (tag: string = 'div') => { const el = document.createElement(tag); document.body.append(el); return el; };
const order = (el: HTMLElement) => el.style.getPropertyValue(ORDER_VAR);

describe('order', () => {
    test('gives each stacking element its place, the oldest being 1', () => {
        const [a, b, c] = [make(), make(), make()] as [HTMLElement, HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b); testStack.push(c);
        expect([order(a), order(b), order(c)]).toEqual(['1', '2', '3']);
    });

    test('the last one opened is always the highest, even after a lower one was closed (where a counter of open ones ties)', () => {
        const [a, b, c] = [make(), make(), make()] as [HTMLElement, HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b);
        testStack.remove(a);                       // one open (b): a counter of open ones would now give 2 to the next
        testStack.push(c);
        expect(Number(order(c))).toBeGreaterThan(Number(order(b)));
        expect([order(b), order(c)]).toEqual(['1', '2']);
    });

    test('closing one in the middle keeps the order of the others', () => {
        const [a, b, c] = [make(), make(), make()] as [HTMLElement, HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b); testStack.push(c);
        testStack.remove(b);
        expect([order(a), order(c)]).toEqual(['1', '2']);
        expect(order(b)).toBe('');
    });

    test('opening one that is already open moves it to the top, without repeating it', () => {
        const [a, b] = [make(), make()] as [HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b); testStack.push(a);
        expect(testStack.size).toBe(2);
        expect([order(b), order(a)]).toEqual(['1', '2']);
    });

    test('removing one that is not there changes nothing', () => {
        const [a, b] = [make(), make()] as [HTMLElement, HTMLElement];
        testStack.push(a);
        testStack.remove(b);
        expect(testStack.size).toBe(1);
        expect(order(a)).toBe('1');
    });

    test('starts over once everything is closed: the order does not grow forever', () => {
        const a = make();
        for (let i = 0; i < 100; i++) { testStack.push(a); testStack.remove(a); }
        testStack.push(a);
        expect(order(a)).toBe('1');
    });
});

describe('top and what is above', () => {
    test('knows the one opened last, and only that one is the top', () => {
        const [a, b] = [make(), make()] as [HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b);
        expect(testStack.top).toBe(b);
        expect(testStack.isTop(b)).toBe(true);
        expect(testStack.isTop(a)).toBe(false);
    });

    test('with none open there is no top', () => {
        expect(testStack.top).toBeUndefined();
        expect(testStack.isTop(make())).toBe(false);
    });

    test('after the top closes, the one below is the top', () => {
        const [a, b] = [make(), make()] as [HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b);
        testStack.remove(b);
        expect(testStack.top).toBe(a);
    });

    test('lists the stacking elements opened after a given one, from the top', () => {
        const [a, b, c] = [make(), make(), make()] as [HTMLElement, HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b); testStack.push(c);
        expect(testStack.above(a)).toEqual([c, b]);
        expect(testStack.above(c)).toEqual([]);
        expect(testStack.above(make())).toEqual([]);
    });
});

describe('shared by every class', () => {
    test('stacking elements of different custom element classes share one stack', () => {
        class One extends HTMLElement {}
        class Two extends HTMLElement {}
        customElements.define('stack-one', One);
        customElements.define('stack-two', Two);
        const a = make('stack-one'), b = make('stack-two');
        testStack.push(a); testStack.push(b);
        expect([order(a), order(b)]).toEqual(['1', '2']);
    });
});

describe('stacking elements that leave the document while open', () => {
    test('do not stay in the stack as ghosts', () => {
        const [a, b] = [make(), make()] as [HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b);
        b.remove();
        expect(testStack.top).toBe(a);
        expect(testStack.size).toBe(1);
        expect(order(b)).toBe('');
    });

    test('opening another one cleans them up too, so the order has no holes', () => {
        const [a, b, c] = [make(), make(), make()] as [HTMLElement, HTMLElement, HTMLElement];
        testStack.push(a); testStack.push(b);
        a.remove();
        testStack.push(c);
        expect([order(b), order(c)]).toEqual(['1', '2']);
    });
});