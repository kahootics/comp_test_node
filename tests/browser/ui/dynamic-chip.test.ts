// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import {
    addChip, chipBoxes, chipLabel, chipValue, createChip, decorateChip, deselectChip, findChip,
    isChip, neighborChip, reconcileChips, selectChip, selectedValues, setSelection,
    type ChipOptions,
} from '../../../src/scripts/browser/ui/components/false/dynamic-chip.js';

const OPTS: ChipOptions = { name: 'tags', form: null, disabled: false };

afterEach(() => { document.body.innerHTML = ''; });

function makeHost(): HTMLDivElement {
    const host = document.createElement('div');
    document.body.append(host);
    return host;
}

/** Markup of a chip as an author would write it: `checked` is an attribute, so the chip is a declared one. */
function chipHtml(val: string, { checked = true, hidden = false } = {}): string {
    return `<label${hidden ? ' hidden' : ''}><input type="checkbox" value="${val}"${checked ? ' checked' : ''}><span>${val}</span></label>`;
}

/** Every chip as `value`, marked `(off)` if unselected and `[hidden]` if hidden. */
const view = (host: Element) => chipBoxes(host).map(box =>
    `${chipValue(box)}${box.checked ? '' : '(off)'}${chipLabel(box).hidden ? '[hidden]' : ''}`);

const box = (host: Element, val: string): HTMLInputElement => {
    const found = findChip(host, val);
    if (!found) throw new Error(`no chip "${val}"`);
    return found;
};

const entries = (form: HTMLFormElement) => Array.from(new FormData(form).entries());

describe('chipBoxes', () => {
    test('returns the checkbox of every direct <label> child, hidden and unselected ones included, in DOM order', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('b', { checked: false }) + chipHtml('c', { hidden: true });
        expect(chipBoxes(host).map(chipValue)).toEqual(['a', 'b', 'c']);
    });

    test('ignores any element that is not a chip', () => {
        const host = makeHost();
        host.innerHTML =
            `<div>${chipHtml('nested-in-div')}</div>` +
            `<label><span><input type="checkbox" value="too-deep" checked></span></label>` +
            `<input type="checkbox" value="bare" checked>` +
            `<label><input type="radio" value="radio" checked></label>` +
            `<label><input type="text" value="text"></label>` +
            `<span>just text</span>` +
            chipHtml('ok');
        expect(chipBoxes(host).map(chipValue)).toEqual(['ok']);
    });

    test('is empty for an empty host', () => {
        expect(chipBoxes(makeHost())).toEqual([]);
    });
});

describe('chipValue', () => {
    test.each([
        ['a', 'a'],
        ['  a  ', 'a'],
        ['', ''],
        ['   ', ''],
    ])('reads value %j as %j', (attr, expected) => {
        const host = makeHost();
        host.innerHTML = `<label><input type="checkbox" value="${attr}" checked></label>`;
        expect(chipValue(chipBoxes(host)[0]!)).toBe(expected);
    });

    test('is empty when there is no value attribute, instead of the "on" a checkbox would submit', () => {
        const host = makeHost();
        host.innerHTML = '<label><input type="checkbox" checked></label>';
        const b = chipBoxes(host)[0]!;
        expect(b.value).toBe('on');
        expect(chipValue(b)).toBe('');
    });
});

describe('isChip', () => {
    test('recognizes the checkbox of a chip of that host', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a');
        expect(isChip(host, chipBoxes(host)[0]!)).toBe(true);
    });

    test('rejects anything else', () => {
        const host = makeHost();
        const other = makeHost();
        host.innerHTML = chipHtml('a') +
            `<div>${chipHtml('nested')}</div><input type="text"><input type="checkbox"><button></button>`;
        other.innerHTML = chipHtml('elsewhere');

        expect(isChip(host, host.querySelector('input[type=text]'))).toBe(false);
        expect(isChip(host, host.querySelector(':scope > input[type=checkbox]'))).toBe(false);
        expect(isChip(host, host.querySelector(':scope > div input'))).toBe(false);
        expect(isChip(host, host.querySelector('button'))).toBe(false);
        expect(isChip(host, chipBoxes(other)[0]!)).toBe(false);
        expect(isChip(host, chipLabel(chipBoxes(host)[0]!))).toBe(false);
        expect(isChip(host, host)).toBe(false);
        expect(isChip(host, null)).toBe(false);
    });
});

describe('findChip', () => {
    test('finds a chip by its trimmed value, selected or not, hidden or not', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('b', { checked: false, hidden: true }) +
            '<label><input type="checkbox" value="  c  " checked></label>';
        expect(findChip(host, 'a')).toBe(chipBoxes(host)[0]);
        expect(findChip(host, 'b')).toBe(chipBoxes(host)[1]);
        expect(findChip(host, 'c')).toBe(chipBoxes(host)[2]);
    });

    test('is undefined when there is none, and does not mistake a prefix for a match', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('abc');
        expect(findChip(host, 'ab')).toBeUndefined();
        expect(findChip(host, '')).toBeUndefined();
    });
});

describe('selectedValues', () => {
    test('returns only the selected chips, in DOM order, trimmed', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('b') + chipHtml('a', { checked: false }) +
            '<label><input type="checkbox" value="  c  " checked></label>';
        expect(selectedValues(host)).toEqual(['b', 'c']);
    });

    test('leaves out chips without a value and hidden unselected ones', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + '<label><input type="checkbox" checked></label>' +
            chipHtml('gone', { checked: false, hidden: true });
        expect(selectedValues(host)).toEqual(['a']);
    });

    test('collapses repetitions', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('a') + chipHtml('b');
        expect(selectedValues(host)).toEqual(['a', 'b']);
    });
});

describe('decorateChip', () => {
    function plainChip() {
        const host = makeHost();
        host.innerHTML = chipHtml('a');
        return chipBoxes(host)[0]!;
    }

    test('gives the chip the name, the form and the disabled state of the selector', () => {
        const b = plainChip();
        decorateChip(b, { name: 'tags', form: 'f1', disabled: true });
        expect(b.getAttribute('name')).toBe('tags');
        expect(b.getAttribute('form')).toBe('f1');
        expect(b.disabled).toBe(true);
    });

    test('takes them away again when the selector no longer has them', () => {
        const b = plainChip();
        decorateChip(b, { name: 'tags', form: 'f1', disabled: true });
        decorateChip(b, { name: null, form: null, disabled: false });
        expect(b.hasAttribute('name')).toBe(false);
        expect(b.hasAttribute('form')).toBe(false);
        expect(b.disabled).toBe(false);
    });

    test('treats an empty name as no name', () => {
        const b = plainChip();
        decorateChip(b, { name: 'tags', form: null, disabled: false });
        decorateChip(b, { name: '', form: null, disabled: false });
        expect(b.hasAttribute('name')).toBe(false);
    });

    test('is idempotent', () => {
        const b = plainChip();
        decorateChip(b, OPTS); const once = b.outerHTML;
        decorateChip(b, OPTS);
        expect(b.outerHTML).toBe(once);
    });
});

describe('createChip', () => {
    test('appends a <label> holding the checkbox and the text, at the end of the host, and returns the checkbox', () => {
        const host = makeHost();
        host.innerHTML = '<div>wrapper</div>' + chipHtml('first');
        const b = createChip(host, 'a', OPTS);

        const label = chipLabel(b);
        expect(host.lastElementChild).toBe(label);
        expect(label.localName).toBe('label');
        expect(Array.from(label.children).map(c => c.localName)).toEqual(['input', 'span']);
        expect(b.type).toBe('checkbox');
        expect(b.getAttribute('value')).toBe('a');
        expect(label.querySelector('span')!.textContent).toBe('a');
    });

    test('creates a selected chip that is not a declared one: a property, not the `checked` attribute', () => {
        const host = makeHost();
        const b = createChip(host, 'a', OPTS);
        expect(b.checked).toBe(true);
        expect(b.hasAttribute('checked')).toBe(false);
        expect(b.defaultChecked).toBe(false);
    });

    test('decorates the chip with the options', () => {
        const host = makeHost();
        const b = createChip(host, 'a', { name: 'tags', form: 'f1', disabled: true });
        expect(b.getAttribute('name')).toBe('tags');
        expect(b.getAttribute('form')).toBe('f1');
        expect(b.disabled).toBe(true);
    });

    test('names the chip after the selector, never after its value (a chip called "submit" would cover form.submtest())', () => {
        const host = makeHost();
        expect(createChip(host, 'submit', OPTS).getAttribute('name')).toBe('tags');
    });

    test('never interprets a value as markup', () => {
        const host = makeHost();
        const evil = '<img src=x onerror=alert(1)>';
        const b = createChip(host, evil, OPTS);
        expect(host.querySelector('img')).toBeNull();
        expect(chipLabel(b).querySelector('span')!.textContent).toBe(evil);
        expect(chipValue(b)).toBe(evil);
    });

    test('keeps quotes in values intact', () => {
        const host = makeHost();
        const b = createChip(host, `a"b'c`, OPTS);
        expect(findChip(host, `a"b'c`)).toBe(b);
    });
});

describe('selectChip and deselectChip', () => {
    test('selecting a chip checks it and shows it again if it was hidden', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a', { checked: false, hidden: true });
        selectChip(box(host, 'a'));
        expect(view(host)).toEqual(['a']);
    });

    test('deselecting a created chip deletes it', () => {
        const host = makeHost();
        const b = createChip(host, 'a', OPTS);
        deselectChip(b);
        expect(b.checked).toBe(false);
        expect(host.contains(b)).toBe(false);
        expect(chipBoxes(host)).toEqual([]);
    });

    test('deselecting a declared chip hides it and keeps it', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a');
        deselectChip(box(host, 'a'));
        expect(view(host)).toEqual(['a(off)[hidden]']);
    });

    test('a hidden declared chip can be selected again', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a');
        deselectChip(box(host, 'a'));
        selectChip(box(host, 'a'));
        expect(view(host)).toEqual(['a']);
    });
});

describe('neighborChip', () => {
    test('is the following selected chip', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('b') + chipHtml('c');
        expect(neighborChip(box(host, 'a'))).toBe(box(host, 'b'));
        expect(neighborChip(box(host, 'b'))).toBe(box(host, 'c'));
    });

    test('is the preceding one when there is no following one', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('b');
        expect(neighborChip(box(host, 'b'))).toBe(box(host, 'a'));
    });

    test('skips unselected and hidden chips', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('off', { checked: false }) +
            chipHtml('gone', { checked: false, hidden: true }) + chipHtml('d');
        expect(neighborChip(box(host, 'a'))).toBe(box(host, 'd'));
        expect(neighborChip(box(host, 'd'))).toBe(box(host, 'a'));
    });

    test('skips what is not a chip', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + '<div>wrapper</div><label>no checkbox</label>' + chipHtml('b');
        expect(neighborChip(box(host, 'a'))).toBe(box(host, 'b'));
    });

    test('is null when there is no other selected chip', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('off', { checked: false });
        expect(neighborChip(box(host, 'a'))).toBeNull();
    });
});

describe('setSelection', () => {
    test('creates the chips of the values that are missing', () => {
        const host = makeHost();
        setSelection(host, ['a', 'b'], OPTS);
        expect(view(host)).toEqual(['a', 'b']);
    });

    test('replaces the selection: keeps shared values, drops the others, adds the new ones', () => {
        const host = makeHost();
        setSelection(host, ['a', 'b'], OPTS);
        const kept = box(host, 'b');
        setSelection(host, ['b', 'c'], OPTS);
        expect(view(host)).toEqual(['b', 'c']);
        expect(box(host, 'b')).toBe(kept); // the same chip, not a copy
    });

    test('trims values and drops blank ones and repetitions', () => {
        const host = makeHost();
        setSelection(host, ['  a  ', '', '   ', 'a', 'b'], OPTS);
        expect(view(host)).toEqual(['a', 'b']);
    });

    test('with no values, empties the selection', () => {
        const host = makeHost();
        setSelection(host, ['a'], OPTS);
        setSelection(host, [], OPTS);
        expect(chipBoxes(host)).toEqual([]);
    });

    test('hides the declared chips it drops, and selects them again instead of duplicating them', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('d1') + chipHtml('d2');
        setSelection(host, ['d1'], OPTS);
        expect(view(host)).toEqual(['d1', 'd2(off)[hidden]']);

        setSelection(host, ['d1', 'd2'], OPTS);
        expect(view(host)).toEqual(['d1', 'd2']);
    });

    test('collapses repeated chips already in the DOM', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('a');
        setSelection(host, ['a'], OPTS);
        expect(view(host)).toEqual(['a']);
    });

    test('drops chips with no value', () => {
        const host = makeHost();
        host.innerHTML = '<label><input type="checkbox" checked></label>';
        setSelection(host, ['a'], OPTS);
        expect(view(host)).toEqual(['a']);
    });

    test('gives the new chips the options', () => {
        const host = makeHost();
        setSelection(host, ['a'], { name: 'tags', form: 'f1', disabled: true });
        expect(box(host, 'a').getAttribute('form')).toBe('f1');
        expect(box(host, 'a').disabled).toBe(true);
    });
});

describe('addChip', () => {
    test("is 'blank' for an empty or whitespace-only value, and adds nothing", () => {
        const host = makeHost();
        expect(addChip(host, '', OPTS)).toBe('blank');
        expect(addChip(host, '   ', OPTS)).toBe('blank');
        expect(chipBoxes(host)).toEqual([]);
    });

    test("is 'added' for a new value, which gets a trimmed chip", () => {
        const host = makeHost();
        expect(addChip(host, '  a  ', OPTS)).toBe('added');
        expect(view(host)).toEqual(['a']);
    });

    test("is 'duplicate' for a value already selected, and adds nothing", () => {
        const host = makeHost();
        addChip(host, 'a', OPTS);
        expect(addChip(host, ' a ', OPTS)).toBe('duplicate');
        expect(view(host)).toEqual(['a']);
    });

    test("is 'added' for the value of a hidden declared chip, which is selected again rather than duplicated", () => {
        const host = makeHost();
        host.innerHTML = chipHtml('d');
        deselectChip(box(host, 'd'));
        expect(addChip(host, 'd', OPTS)).toBe('added');
        expect(view(host)).toEqual(['d']);
    });

    test('does not check the value against any constraint', () => {
        const host = makeHost();
        expect(addChip(host, 'x', OPTS)).toBe('added');
    });
});

describe('reconcileChips', () => {
    test('discards chips without a value', () => {
        const host = makeHost();
        host.innerHTML = '<label><input type="checkbox" checked></label>' +
            '<label><input type="checkbox" value="" checked></label>' +
            '<label><input type="checkbox" value="   " checked></label>' + chipHtml('a');
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['a']);
    });

    test('keeps one chip per value, the first when nothing tells them apart', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('b') + chipHtml('a');
        const first = box(host, 'a');
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['a', 'b']);
        expect(box(host, 'a')).toBe(first);
    });

    test('does not lose a value because the first chip holding it was unselected', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a', { checked: false }) + chipHtml('a');
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['a']);
        expect(selectedValues(host)).toEqual(['a']);
    });

    test('keeps the declared chip among duplicates, selecting it if any duplicate was selected', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a');
        const declared = box(host, 'a');
        deselectChip(declared);                        // hidden, unselected
        const created = createChip(host, 'a', OPTS);   // a selected duplicate, not declared
        reconcileChips(host, OPTS);

        expect(view(host)).toEqual(['a']);
        expect(box(host, 'a')).toBe(declared);
        expect(host.contains(created)).toBe(false);
    });

    test('prefers the declared chip even when a created one comes before it', () => {
        const host = makeHost();
        const created = createChip(host, 'a', OPTS);
        host.insertAdjacentHTML('beforeend', chipHtml('a'));
        const declared = chipBoxes(host)[1]!;
        reconcileChips(host, OPTS);

        expect(chipBoxes(host)).toEqual([declared]);
        expect(host.contains(created)).toBe(false);
        expect(declared.defaultChecked).toBe(true);
    });

    test('keeps the declared chip among duplicates, leaving it hidden if none was selected', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a');
        deselectChip(box(host, 'a'));
        host.insertAdjacentHTML('beforeend', chipHtml('a', { checked: false }));
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['a(off)[hidden]']);
    });

    test('trims the value of a chip', () => {
        const host = makeHost();
        host.innerHTML = '<label><input type="checkbox" value="  a  " checked></label>';
        reconcileChips(host, OPTS);
        expect(chipBoxes(host)[0]!.getAttribute('value')).toBe('a');
    });

    test('gives every chip the name, the form and the disabled state of the selector', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('b');
        reconcileChips(host, { name: 'tags', form: 'f1', disabled: true });
        for (const b of chipBoxes(host)) {
            expect(b.getAttribute('name')).toBe('tags');
            expect(b.getAttribute('form')).toBe('f1');
            expect(b.disabled).toBe(true);
        }
    });

    test('shows a selected chip that was hidden', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a', { hidden: true });
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['a']);
    });

    test('hides an unselected declared chip, and deletes an unselected created one', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('declared');
        createChip(host, 'created', OPTS);
        box(host, 'declared').checked = false;
        box(host, 'created').checked = false;
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['declared(off)[hidden]']);
    });

    test('treats a chip written without `checked` as not selected, and deletes it', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a', { checked: false }) + chipHtml('b');
        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['b']);
    });

    test('leaves what is not a chip alone', () => {
        const host = makeHost();
        host.innerHTML = '<div id="wrapper"><input type="text"><button>Add</button></div>' +
            `<div>${chipHtml('nested')}</div>` + chipHtml('a');
        reconcileChips(host, OPTS);
        expect(host.querySelector('#wrapper')!.children).toHaveLength(2);
        expect(host.querySelector('div > div, div label')).not.toBeNull();
        expect(view(host)).toEqual(['a']);
    });

    test('does nothing on an empty host', () => {
        const host = makeHost();
        expect(() => reconcileChips(host, OPTS)).not.toThrow();
    });

    test('is idempotent: a second run leaves the DOM as it was and changes no structure', () => {
        const host = makeHost();
        host.innerHTML = chipHtml('a') + chipHtml('a') + chipHtml('b', { checked: false }) +
            chipHtml('c', { hidden: true }) + '<label><input type="checkbox" checked></label>';
        reconcileChips(host, OPTS);
        const once = host.innerHTML;

        const observer = new MutationObserver(() => {});
        observer.observe(host, { childList: true, subtree: true });
        reconcileChips(host, OPTS);

        expect(observer.takeRecords()).toEqual([]);
        expect(host.innerHTML).toBe(once);
    });
});

describe('what the browser does with the chips (the contract the module relies on)', () => {
    function mountInForm() {
        const form = document.createElement('form');
        const host = document.createElement('div');
        form.append(host);
        document.body.append(form);
        return { form, host };
    }

    test('submits the selected chips under the name, one entry each, and nothing else', () => {
        const { form, host } = mountInForm();
        host.innerHTML = '<input type="text" value="unsent draft">';
        setSelection(host, ['a', 'b'], OPTS);
        expect(entries(form)).toEqual([['tags', 'a'], ['tags', 'b']]);
    });

    test('does not submit unselected or hidden chips', () => {
        const { form, host } = mountInForm();
        host.innerHTML = chipHtml('d1') + chipHtml('d2');
        reconcileChips(host, OPTS);
        deselectChip(box(host, 'd2'));
        expect(entries(form)).toEqual([['tags', 'd1']]);
    });

    test('does not submit anything without a name', () => {
        const { form, host } = mountInForm();
        setSelection(host, ['a'], { name: null, form: null, disabled: false });
        expect(entries(form)).toEqual([]);
    });

    test('does not submit disabled chips, nor chips inside a disabled fieldset', () => {
        const { form, host } = mountInForm();
        setSelection(host, ['a'], { name: 'tags', form: null, disabled: true });
        expect(entries(form)).toEqual([]);

        setSelection(host, ['a'], OPTS);
        reconcileChips(host, OPTS);
        expect(entries(form)).toEqual([['tags', 'a']]);
        const fieldset = document.createElement('fieldset');
        form.append(fieldset);
        fieldset.append(host);
        fieldset.disabled = true;
        expect(entries(form)).toEqual([]);
    });

    test('follows the `form` option: the chips are submitted by that form, not by the ancestor one', () => {
        const { form, host } = mountInForm();
        const other = document.createElement('form');
        other.id = 'other';
        document.body.append(other);
        setSelection(host, ['a'], { name: 'tags', form: 'other', disabled: false });
        expect(entries(form)).toEqual([]);
        expect(entries(other)).toEqual([['tags', 'a']]);
    });

    test('a form reset selects the declared chips again and unselects the created ones; reconciling then settles the DOM', () => {
        const { form, host } = mountInForm();
        host.innerHTML = chipHtml('d1') + chipHtml('d2');
        reconcileChips(host, OPTS);
        addChip(host, 'made', OPTS);
        deselectChip(box(host, 'd2'));
        expect(view(host)).toEqual(['d1', 'd2(off)[hidden]', 'made']);

        form.reset();
        // the browser has restored the checkedness, nothing more
        expect(view(host)).toEqual(['d1', 'd2[hidden]', 'made(off)']);

        reconcileChips(host, OPTS);
        expect(view(host)).toEqual(['d1', 'd2']);
        expect(entries(form)).toEqual([['tags', 'd1'], ['tags', 'd2']]);
    });

    test('a form reset fires no input or change event on the chips', () => {
        const { form, host } = mountInForm();
        host.innerHTML = chipHtml('d1');
        reconcileChips(host, OPTS);
        const fired: string[] = [];
        for (const type of ['input', 'change']) host.addEventListener(type, () => fired.push(type), true);

        deselectChip(box(host, 'd1'));
        form.reset();

        expect(fired).toEqual([]);
    });

    test('unselecting a chip by the user fires input and then change, bubbling out of the chip', () => {
        const { host } = mountInForm();
        setSelection(host, ['a'], OPTS);
        const fired: string[] = [];
        for (const type of ['click', 'input', 'change'])
            host.addEventListener(type, e => fired.push(`${type}:${(e.target as Element).localName}`));

        chipLabel(box(host, 'a')).click();

        expect(fired).toEqual(['click:label', 'click:input', 'input:input', 'change:input']);
    });
});