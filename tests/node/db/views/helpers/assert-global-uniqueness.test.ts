import { describe, test, expect } from 'vitest';
import { Admitted } from '../../../../../src/scripts/node/db/views/helpers/admitted-types.js'
import { PrimitiveUColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/primitive-u-column-descriptor.js';
import { NestableUColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/nestable-u-column-descriptor.js';
import { _collectAllLabels, _assertGlobalUniqueness, } from '../../../../../src/scripts/node/db/views/helpers/assert-global-uniqueness.js';
import type { ColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/column-descriptor.js';
import type { EditableColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/editable-column-descriptor.js';
import type { UnmodifiableColumnDescriptor } from '../../../../../src/scripts/node/db/views/columns/unmodifiable-column-descriptor.js';

const IllegalArgumentError = 'IllegalArgumentError';

/** Builds an actual primitive column descriptor (non-mocked). */
function primitiveCol(label: string): PrimitiveUColumnDescriptor {
    return new PrimitiveUColumnDescriptor(label, [label], Admitted.PRIMITIVE);
}

/** Builds an actual nestable column with children. */
function nestedCol(label: string, children: UnmodifiableColumnDescriptor[]): NestableUColumnDescriptor {
    return new NestableUColumnDescriptor(label, [label], Admitted.ARRAY_OBJECT, children);
}

/**
 * Builds a column descriptor mocked instance that only 
 * implements the `label` property (the other properties 
 * are not necessary for the purpose of this test).
 */
function fakeLabeled(label: string) {
    return { label } as unknown as ColumnDescriptor;
}
/**
 * Builds an editable column descriptor mocked instance that 
 * only implements the `label` property (the other properties 
 * are not necessary for the purpose of this test).
 */
function fakeEditable(label: string) {
    return { label } as unknown as EditableColumnDescriptor;
}

describe('_collectAllLabels', () => {
    test('when given an empty array, returns an empty array', () => {
        expect(_collectAllLabels([])).toEqual([]);
    });

    test('when given only primitive descriptors, returns their label in the same order', () => {
        const cols = [primitiveCol('a'), primitiveCol('b'), primitiveCol('c')];
        expect(_collectAllLabels(cols)).toEqual(['a', 'b', 'c']);
    });

    test('when given a nestable column descriptor, returns the label of said column and the its children\'s labels flattened in the same array', () => {
        const nested = nestedCol('tags[i]', [primitiveCol('tags[i]_name'), primitiveCol('tags[i]_valore')]);
        expect(_collectAllLabels([primitiveCol('a'), nested])).toEqual([
            'a',
            'tags[i]',
            'tags[i]_name',
            'tags[i]_valore',
        ]);
    });

    test('when given nestable column descriptors with nestable children, resolves recursively and returns the labels flattened in the same array', () => {
        const deepestLayer = nestedCol('b_children[i]', [primitiveCol('b_children[i]_name')]);
        const frstLayer = nestedCol('b', [primitiveCol('b_a'), deepestLayer]);
        expect(_collectAllLabels([frstLayer])).toEqual([
            'b',
            'b_a',
            'b_children[i]',
            'b_children[i]_name',
        ]);
    });

    test('ehen given a childless nestable column descriptor, only returns its label (no empty label to placehold the children)', () => {
        const nested = nestedCol('empty[i]', []);
        expect(_collectAllLabels([nested])).toEqual(['empty[i]']);
    });

    test('when given nestable and primitive column descriptors in mixed order, '
        + 'the nestables are fully resolved before moving to next descriptor, '
        + 'thus preserving the original order while expanding the nestables', () => {
            const nested = nestedCol('mid[i]', [primitiveCol('mid[i]_x')]);
            const cols = [primitiveCol('first'), nested, primitiveCol('last')];
            expect(_collectAllLabels(cols)).toEqual(['first', 'mid[i]', 'mid[i]_x', 'last']);
        });
});

describe('_assertGlobalUniqueness', () => {
    test('does not throw if all labels are unique', () => {
        const base = [fakeLabeled('inv'), fakeLabeled('versions')];
        const unmodifiables = [primitiveCol('nome'), primitiveCol('prezzo')];
        const editables = [fakeEditable('note'), fakeEditable('attivo')];
        expect(() => _assertGlobalUniqueness(base, unmodifiables, editables)).not.toThrow();
    });

    test('does not throw if all the lists are empty', () => {
        expect(() => _assertGlobalUniqueness([], [], [])).not.toThrow();
    });

    test(`throws ${IllegalArgumentError} se una label di base coincide con una editable`, () => {
        const base = [fakeLabeled('nota')];
        const editables = [fakeEditable('nota')];
        expect(() => _assertGlobalUniqueness(base, [], editables)).toThrowWithName(IllegalArgumentError);
    });

    test('throws if two primitive column descriptors share the same label (case sensitive)', () => {
        const unmodifiables = [primitiveCol('x'), primitiveCol('x')];
        expect(() => _assertGlobalUniqueness([], unmodifiables, [])).toThrowWithName(IllegalArgumentError);
    });

    test('throws if a primitive column shares the same label with a child of a nestable', () => {
        // NOTE: under normal circumstances, a child of a nestable would 
        // never have a label that does not reprise its parent's; 
        // here the mock is leveraged to bypass this limit 
        // and test edge case circumstances
        const nested = nestedCol('tags[i]', [primitiveCol('note')]); 
        const editables = [fakeEditable('note')]; 
        expect(() => _assertGlobalUniqueness([], [nested], editables)).toThrowWithName(IllegalArgumentError);
    });

    test('throws if a nestable label collides with a primitive column', () => {
        // NOTE: nothing prevents the usage of nestable-specific 
        // terminator in labels but common sense
        const nested = nestedCol('group[i]', [primitiveCol('group[i]_x')]);
        const base = [fakeLabeled('group[i]')];
        expect(() => _assertGlobalUniqueness(base, [nested], [])).toThrowWithName(IllegalArgumentError);
    });

    test('error message logs the duplicate labels', () => {
        const base = [fakeLabeled('make-sure-this-is-duplicate')];
        const editables = [fakeEditable('make-sure-this-is-duplicate')];
        expect(() => _assertGlobalUniqueness(base, [], editables)).toThrow(/make-sure-this-is-duplicate/);
    });

    test('the labels\' comparison is case sensitive and does not auto-trim', () => {
        const base = [fakeLabeled('Name')];
        const editables = [fakeEditable('name')];
        expect(() => _assertGlobalUniqueness(base, [], editables)).not.toThrow();
    });
});