// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DynamicSelector } from '../../../src/scripts/browser/ui/components/false/dynamic-selector.js';

// Not covered, because jsdom cannot show it: the real keyboard and the browser's
// own handling of a user-started reset or of a parser creating the element.

const TAG = 'dynamic-selector-test';
if (!customElements.get(TAG)) customElements.define(TAG, DynamicSelector);

/** Waits for a task: enough for the mutation observer and for the timeout that follows a reset. */
const tick = () => new Promise<void>(r => setTimeout(r, 0));

afterEach(() => { document.body.innerHTML = ''; });

// HELPERS ===========================================

function makeEl(attrs: Record<string, string> = {}): DynamicSelector {
    const el = document.createElement(TAG) as DynamicSelector;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

/** Markup of a chip as an author would write it (`checked` attribute: a declared chip). */
const chipHtml = (val: string, { checked = true } = {}) =>
    `<label><input type="checkbox" value="${val}"${checked ? ' checked' : ''}><span>${val}</span></label>`;

/** A selector inside a form, connected. `markup` becomes its initial children. */
function mount(attrs: Record<string, string> = { name: 'tags' }, markup = '') {
    const form = document.createElement('form');
    const el = makeEl(attrs);
    el.innerHTML = markup;
    form.append(el);
    document.body.append(form);
    return { form, el };
}

const draft = (el: Element) => el.querySelector<HTMLInputElement>(':scope > div > input')!;
const addButton = (el: Element) => el.querySelector<HTMLButtonElement>(':scope > div > button')!;
const status = (el: Element) => el.querySelector<HTMLElement>(':scope > div > [role="status"]')!;
const boxes = (el: Element) => Array.from(el.querySelectorAll<HTMLInputElement>(':scope > label > input[type="checkbox"]'));
const box = (el: Element, val: string) => boxes(el).find(b => b.value === val)!;
const labelOf = (b: HTMLInputElement) => b.parentElement as HTMLLabelElement;
const entries = (form: HTMLFormElement) => Array.from(new FormData(form).entries());

/** Types a value in the draft input and presses Add. */
function add(el: Element, text: string) {
    draft(el).value = text;
    addButton(el).click();
}

const enter = (target: Element) => {
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
};

/** Records input/change events as seen at each target, as `type@label:origin`. */
function record(targets: [string, EventTarget][]) {
    const log: string[] = [];
    for (const [label, target] of targets)
        for (const type of ['input', 'change'])
            target.addEventListener(type, e => log.push(`${type}@${label}:${(e.target as Element).localName}`));
    return log;
}
const SELECTOR = TAG;
const USER_CHANGE = [
    `input@host:${SELECTOR}`, `input@form:${SELECTOR}`, `input@document:${SELECTOR}`,
    `change@host:${SELECTOR}`, `change@form:${SELECTOR}`, `change@document:${SELECTOR}`,
];
const watch = (el: Element, form: HTMLFormElement) =>
    record([['host', el], ['form', form], ['document', document]]);

// STRUCTURE ===========================================

describe('DynamicSelector - structure', () => {
    test('prepends a wrapper with the draft input, the Add button and an empty status region on connect', () => {
        const { el } = mount();
        const wrapper = el.firstElementChild!;
        expect(wrapper.localName).toBe('div');
        expect(Array.from(wrapper.children).map(c => c.localName)).toEqual(['input', 'button', 'div']);
        expect(draft(el).type).toBe('text');
        expect(addButton(el).textContent).toBe('Add');
        expect(status(el).textContent).toBe('');
    });

    test('puts the wrapper before chips written in the markup', () => {
        const { el } = mount({ name: 'tags' }, chipHtml('a') + chipHtml('b'));
        expect(el.firstElementChild!.localName).toBe('div');
        expect(boxes(el).map(b => b.value)).toEqual(['a', 'b']);
    });

    test('does not duplicate the wrapper when it is moved and connected again', () => {
        const { el } = mount();
        const other = document.createElement('div');
        document.body.append(other);
        other.append(el);
        expect(el.querySelectorAll(':scope > div')).toHaveLength(1);
        expect(el.querySelectorAll('input[type="text"]')).toHaveLength(1);
    });

    test('never gives the text input a name (it is not data), and the Add button is not a submit button', () => {
        const { el } = mount();
        expect(draft(el).hasAttribute('name')).toBe(false);
        expect(addButton(el).type).toBe('button');
    });

    test('labels the Add button and makes the status region a live region', () => {
        const { el } = mount();
        expect(addButton(el).getAttribute('aria-label')).toBe('Add new item');
        expect(status(el).getAttribute('role')).toBe('status');
    });

    test('gives each instance its own status region id', () => {
        const a = mount().el;
        const b = mount().el;
        expect(status(a).id).not.toBe('');
        expect(status(a).id).not.toBe(status(b).id);
    });

    test('lists the attributes it reacts to', () => {
        expect(DynamicSelector.observedAttributes).toEqual(expect.arrayContaining(
            ['maxlength', 'placeholder', 'autocomplete', 'spellcheck', 'minlength', 'pattern', 'disabled', 'required', 'name', 'form']));
    });
});

// ACCESSORS ===========================================

describe('DynamicSelector - accessors', () => {
    test('name reflects the attribute and is empty by default', () => {
        const el = makeEl();
        expect(el.name).toBe('');
        el.name = 'tags';
        expect(el.getAttribute('name')).toBe('tags');
    });

    test.each(['disabled', 'required'] as const)('%s reflects the attribute', (prop) => {
        const el = makeEl();
        expect(el[prop]).toBe(false);
        el[prop] = true;
        expect(el.hasAttribute(prop)).toBe(true);
        el[prop] = false;
        expect(el.hasAttribute(prop)).toBe(false);
    });

    test('form is the ancestor form, or null without one', () => {
        const { form, el } = mount();
        expect(el.form).toBe(form);
        const alone = makeEl();
        document.body.append(alone);
        expect(alone.form).toBeNull();
    });

    test('value is derived from the DOM on every read', () => {
        const { el } = mount({ name: 'tags' }, chipHtml('a') + chipHtml('b'));
        expect(el.value).toEqual(['a', 'b']);
        box(el, 'a').checked = false; // changed behind the selector's back
        expect(el.value).toEqual(['b']);
    });

    test('value can be set before the element is connected', () => {
        const el = makeEl({ name: 'tags' });
        el.value = ['a', 'b'];
        expect(el.value).toEqual(['a', 'b']);

        const form = document.createElement('form');
        form.append(el);
        document.body.append(form);
        expect(el.value).toEqual(['a', 'b']);
        expect(entries(form)).toEqual([['tags', 'a'], ['tags', 'b']]);
    });

    test('value replaces the selection and trims, dropping blanks and repetitions', () => {
        const { el } = mount();
        el.value = [' a ', '', 'a', 'b'];
        expect(el.value).toEqual(['a', 'b']);
        el.value = ['b', 'c'];
        expect(el.value).toEqual(['b', 'c']);
    });
});

// DELEGATED ATTRIBUTES ===========================================

describe('DynamicSelector - delegated attributes', () => {
    test.each([['maxlength', '5'], ['placeholder', 'type here'], ['autocomplete', 'off'], ['spellcheck', 'false']])(
        'forwards %s to the text input, and takes it away again', (attr, val) => {
            const { el } = mount();
            el.setAttribute(attr, val);
            expect(draft(el).getAttribute(attr)).toBe(val);
            el.removeAttribute(attr);
            expect(draft(el).hasAttribute(attr)).toBe(false);
        });

    test('applies the attributes already present at connection', () => {
        const { el } = mount({ name: 'tags', placeholder: 'type here', maxlength: '7' });
        expect(draft(el).getAttribute('placeholder')).toBe('type here');
        expect(draft(el).getAttribute('maxlength')).toBe('7');
    });

    test.each(['minlength', 'pattern', 'required'])(
        'does not forward %s: the selector checks entries itself, and a draft must not block the form', (attr) => {
            const { el } = mount({ name: 'tags', [attr]: attr === 'pattern' ? '[a-z]+' : '3' });
            expect(draft(el).hasAttribute(attr)).toBe(false);
        });

    test('a draft that would violate pattern does not make the form invalid', () => {
        const { form, el } = mount({ name: 'tags', pattern: '[a-z]+' });
        draft(el).value = 'ab1';
        expect(form.checkValidity()).toBe(true);
    });
});

// DISABLED ===========================================

describe('DynamicSelector - disabled', () => {
    test('disables the text input, the Add button and the chips, and enables them again', () => {
        const { el } = mount({ name: 'tags' }, chipHtml('a'));
        el.disabled = true;
        expect(draft(el).disabled).toBe(true);
        expect(addButton(el).disabled).toBe(true);
        expect(boxes(el)[0]!.disabled).toBe(true);
        el.disabled = false;
        expect(draft(el).disabled).toBe(false);
        expect(addButton(el).disabled).toBe(false);
        expect(boxes(el)[0]!.disabled).toBe(false);
    });

    test('applies to chips created while disabled', () => {
        const { el } = mount();
        el.disabled = true;
        el.value = ['a'];
        expect(boxes(el)[0]!.disabled).toBe(true);
    });

    test('applies at connection when the attribute is already there', () => {
        const { el } = mount({ name: 'tags', disabled: '' }, chipHtml('a'));
        expect(draft(el).disabled).toBe(true);
        expect(boxes(el)[0]!.disabled).toBe(true);
    });

    test('a disabled selector submits nothing', () => {
        const { form, el } = mount();
        el.value = ['a'];
        el.disabled = true;
        expect(entries(form)).toEqual([]);
        el.disabled = false;
        expect(entries(form)).toEqual([['tags', 'a']]);
    });

    test('inside a disabled fieldset nothing is submitted, with no help from the selector', () => {
        const { form, el } = mount();
        el.value = ['a'];
        const fieldset = document.createElement('fieldset');
        form.append(fieldset);
        fieldset.append(el);
        fieldset.disabled = true;
        expect(entries(form)).toEqual([]);
        fieldset.disabled = false;
        expect(entries(form)).toEqual([['tags', 'a']]);
    });
});

// NAME AND FORM ===========================================

describe('DynamicSelector - name and form', () => {
    test('submits the selected chips under its name, one entry each, and not the draft', () => {
        const { form, el } = mount();
        el.value = ['x', 'y'];
        draft(el).value = 'unsent draft';
        expect(entries(form)).toEqual([['tags', 'x'], ['tags', 'y']]);
    });

    test('renames the chips when its name changes, and stops submitting them without a name', () => {
        const { form, el } = mount();
        el.value = ['a'];
        el.setAttribute('name', 'other');
        expect(entries(form)).toEqual([['other', 'a']]);
        el.removeAttribute('name');
        expect(entries(form)).toEqual([]);
    });

    test('names a chip after the selector, never after its value', () => {
        const { form, el } = mount();
        el.value = ['submit'];
        expect(boxes(el)[0]!.getAttribute('name')).toBe('tags');
        expect(entries(form)).toEqual([['tags', 'submit']]);
    });

    test('keeps two selectors in one form apart', () => {
        const form = document.createElement('form');
        const a = makeEl({ name: 'first' });
        const b = makeEl({ name: 'second' });
        form.append(a, b);
        document.body.append(form);
        a.value = ['1'];
        b.value = ['2', '3'];
        expect(entries(form)).toEqual([['first', '1'], ['second', '2'], ['second', '3']]);
    });

    test("moves the text input and the chips to another form with the `form` attribute", () => {
        const { form, el } = mount();
        const other = document.createElement('form');
        other.id = 'other';
        document.body.append(other);
        el.value = ['a'];

        el.setAttribute('form', 'other');
        expect(el.form).toBe(other);
        expect(entries(form)).toEqual([]);
        expect(entries(other)).toEqual([['tags', 'a']]);

        el.value = ['a', 'b']; // chips created afterwards follow too
        expect(entries(other)).toEqual([['tags', 'a'], ['tags', 'b']]);

        el.removeAttribute('form');
        expect(el.form).toBe(form);
        expect(entries(form)).toEqual([['tags', 'a'], ['tags', 'b']]);
    });

    test('works with a `form` attribute from the start, even outside any form', () => {
        const other = document.createElement('form');
        other.id = 'other';
        document.body.append(other);
        const el = makeEl({ name: 'tags', form: 'other' });
        el.value = ['z'];
        document.body.append(el);
        expect(el.form).toBe(other);
        expect(entries(other)).toEqual([['tags', 'z']]);
    });
});

// ADDING FROM THE UI ===========================================

describe('DynamicSelector - adding from the UI', () => {
    test('adds the typed value, trimmed, when Add is pressed, and clears the draft', () => {
        const { el } = mount();
        add(el, '  hello  ');
        expect(el.value).toEqual(['hello']);
        expect(draft(el).value).toBe('');
        expect(labelOf(boxes(el)[0]!).querySelector('span')!.textContent).toBe('hello');
    });

    test('does the same when Enter is pressed in the draft, and keeps the form from being submitted', () => {
        const { el } = mount();
        draft(el).value = 'hello';
        const e = enter(draft(el));
        expect(e.defaultPrevented).toBe(true);
        expect(el.value).toEqual(['hello']);
    });

    test('ignores other keys', () => {
        const { el } = mount();
        draft(el).value = 'hello';
        const e = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
        draft(el).dispatchEvent(e);
        expect(e.defaultPrevented).toBe(false);
        expect(el.value).toEqual([]);
    });

    test('selects again a declared chip the user had removed, instead of creating another', () => {
        const { el } = mount({ name: 'tags' }, chipHtml('d'));
        box(el, 'd').click();
        expect(el.value).toEqual([]);
        add(el, 'd');
        expect(el.value).toEqual(['d']);
        expect(boxes(el)).toHaveLength(1);
    });

    describe('feedback on refused additions', () => {
        test('reports a blank value, linking the message to the input', () => {
            const { el } = mount();
            add(el, '   ');
            expect(el.value).toEqual([]);
            expect(status(el).textContent).not.toBe('');
            expect(draft(el).getAttribute('aria-invalid')).toBe('true');
            expect(draft(el).getAttribute('aria-describedby')).toBe(status(el).id);
        });

        test('reports a duplicate, keeps the draft and selects it, ready to be overwritten', () => {
            const { el } = mount();
            el.value = ['dup'];
            const select = vi.spyOn(draft(el), 'select');
            add(el, 'dup');
            expect(el.value).toEqual(['dup']);
            expect(status(el).textContent).not.toBe('');
            expect(draft(el).value).toBe('dup');
            expect(select).toHaveBeenCalled();
        });

        test('tells a blank value from a duplicate', () => {
            const { el } = mount();
            el.value = ['dup'];
            add(el, '');
            const blank = status(el).textContent;
            add(el, 'dup');
            expect(status(el).textContent).not.toBe(blank);
        });

        test('is dismissed by typing again', () => {
            const { el } = mount();
            add(el, '');
            draft(el).dispatchEvent(new Event('input', { bubbles: true }));
            expect(status(el).textContent).toBe('');
            expect(draft(el).hasAttribute('aria-invalid')).toBe(false);
            expect(draft(el).hasAttribute('aria-describedby')).toBe(false);
        });

        test('is dismissed by a successful addition', () => {
            const { el } = mount();
            add(el, '');
            add(el, 'ok');
            expect(status(el).textContent).toBe('');
            expect(draft(el).hasAttribute('aria-invalid')).toBe(false);
        });
    });

    describe('entry constraints', () => {
        test('refuses an entry shorter than minlength, even when it was not typed (so natively unchecked)', () => {
            const { el } = mount({ name: 'tags', minlength: '3' });
            add(el, 'ab');
            expect(el.value).toEqual([]);
            expect(status(el).textContent).not.toBe('');
            expect(draft(el).value).toBe('ab');
        });

        test('refuses an entry longer than maxlength', () => {
            const { el } = mount({ name: 'tags', maxlength: '3' });
            add(el, 'abcd');
            expect(el.value).toEqual([]);
        });

        test('refuses an entry that does not match the whole pattern', () => {
            const { el } = mount({ name: 'tags', pattern: '[a-z]+' });
            add(el, 'abc1');
            expect(el.value).toEqual([]);
            add(el, 'abc');
            expect(el.value).toEqual(['abc']);
        });

        test('measures the trimmed entry', () => {
            const { el } = mount({ name: 'tags', minlength: '3' });
            add(el, ' ab ');
            expect(el.value).toEqual([]);
        });

        test('reports an empty entry as blank, not as too short', () => {
            const { el } = mount({ name: 'tags', minlength: '3' });
            add(el, '');
            const blank = status(el).textContent;
            add(el, 'ab');
            expect(status(el).textContent).not.toBe(blank);
        });

        test('ignores constraints that are not valid, as native controls do', () => {
            const { el } = mount({ name: 'tags', minlength: 'abc', pattern: '(' });
            add(el, 'x');
            expect(el.value).toEqual(['x']);
        });

        test('gives a message for each constraint', () => {
            const { el } = mount({ name: 'tags', minlength: '3', maxlength: '4', pattern: '[a-z]+' });
            const messages = new Set<string>();
            for (const text of ['ab', 'abcde', 'ab1c']) { add(el, text); messages.add(status(el).textContent!); }
            expect(messages.size).toBe(3);
        });
    });
});

// REMOVING FROM THE UI ===========================================

describe('DynamicSelector - removing from the UI', () => {
    test('unchecking a chip removes it from the value and from the DOM', () => {
        const { el } = mount();
        el.value = ['a', 'b'];
        box(el, 'a').click();
        expect(el.value).toEqual(['b']);
        expect(boxes(el).map(b => b.value)).toEqual(['b']);
    });

    test('clicking the chip text does the same (it is a label)', () => {
        const { el } = mount();
        el.value = ['a'];
        labelOf(box(el, 'a')).click();
        expect(el.value).toEqual([]);
    });

    test('Enter on a chip removes it too, and does not submit the form', () => {
        const { el } = mount();
        el.value = ['a'];
        const e = enter(boxes(el)[0]!);
        expect(e.defaultPrevented).toBe(true);
        expect(el.value).toEqual([]);
    });

    test('other keys on a chip are left alone', () => {
        const { el } = mount();
        el.value = ['a'];
        const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        boxes(el)[0]!.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(false);
        expect(el.value).toEqual(['a']);
    });

    test('hides a declared chip instead of deleting it', () => {
        const { el } = mount({ name: 'tags' }, chipHtml('d'));
        box(el, 'd').click();
        expect(el.value).toEqual([]);
        expect(labelOf(box(el, 'd')).hidden).toBe(true);
    });

    test('stops submitting the removed value', () => {
        const { form, el } = mount();
        el.value = ['a', 'b'];
        box(el, 'a').click();
        expect(entries(form)).toEqual([['tags', 'b']]);
    });

    describe('focus', () => {
        test('moves to the next chip when the focused chip is removed', () => {
            const { el } = mount();
            el.value = ['a', 'b', 'c'];
            box(el, 'a').focus();
            box(el, 'a').click();
            expect(document.activeElement).toBe(box(el, 'b'));
        });

        test('moves to the previous chip when there is no next one', () => {
            const { el } = mount();
            el.value = ['a', 'b'];
            box(el, 'b').focus();
            box(el, 'b').click();
            expect(document.activeElement).toBe(box(el, 'a'));
        });

        test('moves to the Add button when the last chip is removed', () => {
            const { el } = mount();
            el.value = ['a'];
            box(el, 'a').focus();
            box(el, 'a').click();
            expect(document.activeElement).toBe(addButton(el));
        });

        test('is left where it was when the removed chip did not have it', () => {
            const { el } = mount();
            el.value = ['a'];
            draft(el).focus();
            box(el, 'a').click();
            expect(document.activeElement).toBe(draft(el));
        });

        test('is not stolen by a programmatic change of the value', () => {
            const { el } = mount();
            el.value = ['a', 'b'];
            const elsewhere = document.createElement('input');
            document.body.append(elsewhere);
            elsewhere.focus();
            el.value = [];
            expect(document.activeElement).toBe(elsewhere);
        });
    });
});

// EVENTS ===========================================

describe('DynamicSelector - events', () => {
    test('adding from the UI fires input then change, once, bubbling from the selector', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        add(el, 'a');
        expect(log).toEqual(USER_CHANGE);
    });

    test('removing from the UI fires them too', () => {
        const { form, el } = mount();
        el.value = ['a'];
        const log = watch(el, form);
        box(el, 'a').click();
        expect(log).toEqual(USER_CHANGE);
    });

    test('adding with Enter fires them', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        draft(el).value = 'a';
        enter(draft(el));
        expect(log).toEqual(USER_CHANGE);
    });

    test('the state is already up to date when they fire', () => {
        const { form, el } = mount();
        const seen: string[][] = [];
        el.addEventListener('input', () => seen.push([...el.value]));
        el.addEventListener('change', () => seen.push([...el.value]));
        add(el, 'a');
        expect(seen).toEqual([['a'], ['a']]);
        box(el, 'a').click();
        expect(seen.slice(2)).toEqual([[], []]);
        expect(entries(form)).toEqual([]);
    });

    test('input is composed and change is not, as with native controls', () => {
        const { el } = mount();
        const events: Event[] = [];
        el.addEventListener('input', e => events.push(e));
        el.addEventListener('change', e => events.push(e));
        add(el, 'a');
        const [input, change] = events as [Event, Event];
        expect([input.bubbles, input.composed]).toEqual([true, true]);
        expect([change.bubbles, change.composed]).toEqual([true, false]);
    });

    test('is silent for refused additions', () => {
        const { form, el } = mount();
        el.value = ['a'];
        const log = watch(el, form);
        add(el, 'a');
        add(el, '');
        expect(log).toEqual([]);
    });

    test('is silent for programmatic changes: value, attributes, external chips', async () => {
        const { form, el } = mount();
        const log = watch(el, form);
        el.value = ['a', 'b'];
        el.value = ['b'];
        el.disabled = true;
        el.setAttribute('name', 'other');
        el.insertAdjacentHTML('beforeend', chipHtml('ext'));
        await tick();
        expect(log).toEqual([]);
    });

    test('the native events of the chips never leave the selector: nobody sees the checkbox as target', () => {
        const { form, el } = mount();
        el.value = ['a'];
        const log = watch(el, form);
        box(el, 'a').click();
        expect(log.filter(entry => entry.endsWith(':input'))).toEqual([]);
        expect(log).toEqual(USER_CHANGE);
    });

    test('typing a draft does not look like a change of the selector', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        draft(el).value = 'dra';
        draft(el).dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        draft(el).dispatchEvent(new Event('change', { bubbles: true }));
        expect(log).toEqual([]);
    });
});

// VALIDITY ===========================================

describe('DynamicSelector - validity', () => {
    test('an empty required selection invalidates the form, with a message on the selector', () => {
        const { form, el } = mount({ name: 'tags', required: '' });
        expect(form.checkValidity()).toBe(false);
        expect(el.validity.customError).toBe(true);
        expect(el.validationMessage).not.toBe('');
        expect(el.willValidate).toBe(true);
    });

    test('is valid again once there is a value, and invalid again once it is gone', () => {
        const { form, el } = mount({ name: 'tags', required: '' });
        el.value = ['a'];
        expect(form.checkValidity()).toBe(true);
        expect(el.validationMessage).toBe('');
        el.value = [];
        expect(form.checkValidity()).toBe(false);
    });

    test('a disabled selector never blocks the form, even if required and empty (a disabled control is not validated)', () => {
        const { form, el } = mount({ name: 'tags', required: '' });
        expect(form.checkValidity()).toBe(false);
        el.disabled = true;
        expect(form.checkValidity()).toBe(true);
        expect(el.willValidate).toBe(false);
        el.disabled = false;
        expect(form.checkValidity()).toBe(false);
    });

    test('is valid without `required`, even when empty', () => {
        const { form } = mount();
        expect(form.checkValidity()).toBe(true);
    });

    test('follows the UI: typing a value satisfies a required selection, removing it breaks it again', () => {
        const { form, el } = mount({ name: 'tags', required: '' });
        add(el, 'a');
        expect(form.checkValidity()).toBe(true);
        box(el, 'a').click();
        expect(form.checkValidity()).toBe(false);
    });

    test('reacts to `required` being added and removed', () => {
        const { form, el } = mount();
        el.required = true;
        expect(form.checkValidity()).toBe(false);
        el.required = false;
        expect(form.checkValidity()).toBe(true);
    });

    test('values set from code that violate a constraint are kept, and reported with the offending value', () => {
        const { form, el } = mount({ name: 'tags', minlength: '3' });
        el.value = ['ab', 'abcd'];
        expect(el.value).toEqual(['ab', 'abcd']);
        expect(form.checkValidity()).toBe(false);
        expect(el.validationMessage).toContain('"ab"');
    });

    test('flags the invalid chips with aria-invalid, and only them', () => {
        const { el } = mount({ name: 'tags', minlength: '3' });
        el.value = ['ab', 'abcd'];
        expect(box(el, 'ab').getAttribute('aria-invalid')).toBe('true');
        expect(box(el, 'abcd').hasAttribute('aria-invalid')).toBe(false);
    });

    test.each([
        ['minlength', '3', ['ab']],
        ['maxlength', '2', ['abc']],
        ['pattern', '[a-z]+', ['a1']],
    ])('detects a %s violation', (attr, constraint, values) => {
        const { form, el } = mount({ name: 'tags', [attr]: constraint });
        el.value = values;
        expect(form.checkValidity()).toBe(false);
    });

    test('recomputes when the constraints change, keeping every value', () => {
        const { form, el } = mount();
        el.value = ['ab'];
        expect(form.checkValidity()).toBe(true);

        el.setAttribute('minlength', '3');
        expect(el.value).toEqual(['ab']);
        expect(form.checkValidity()).toBe(false);

        el.removeAttribute('minlength');
        expect(form.checkValidity()).toBe(true);
        expect(box(el, 'ab').hasAttribute('aria-invalid')).toBe(false);

        el.setAttribute('maxlength', '1');
        expect(form.checkValidity()).toBe(false);
        el.removeAttribute('maxlength');
        el.setAttribute('pattern', '[0-9]+');
        expect(form.checkValidity()).toBe(false);
    });

    test('reports a missing required selection before invalid entries', () => {
        const { el } = mount({ name: 'tags', required: '', minlength: '3' });
        const missing = el.validationMessage;
        el.value = ['ab'];
        expect(el.validationMessage).not.toBe(missing);
        expect(el.validationMessage).toContain('"ab"');
    });

    test('does not flag unselected chips', () => {
        const { form, el } = mount({ name: 'tags', minlength: '3' }, chipHtml('d'));
        expect(form.checkValidity()).toBe(false);
        box(el, 'd').click();
        expect(form.checkValidity()).toBe(true);
    });

    test('exposes the validity API of the selection on the selector', () => {
        const { el } = mount({ name: 'tags', required: '' });
        expect(el.checkValidity()).toBe(false);
        expect(el.validity).toBe(draft(el).validity);
        expect(el.validationMessage).toBe(draft(el).validationMessage);

        const invalid = vi.fn();
        draft(el).addEventListener('invalid', invalid);
        expect(el.reportValidity()).toBe(false);
        expect(invalid).toHaveBeenCalled();

        el.value = ['a'];
        expect(el.checkValidity()).toBe(true);
        expect(el.reportValidity()).toBe(true);
    });

    test('is not blocked by the unsent draft, whatever it contains', () => {
        const { form, el } = mount({ name: 'tags', required: '' });
        el.value = ['a'];
        draft(el).value = '!!!';
        expect(form.checkValidity()).toBe(true);
    });
});

// DOM CHANGES FROM OUTSIDE ===========================================

describe('DynamicSelector - chips changed from outside', () => {
    test('registers a chip appended while connected: decorated, in the value, submitted', async () => {
        const { form, el } = mount();
        el.insertAdjacentHTML('beforeend', chipHtml('ext'));
        await tick();
        expect(el.value).toEqual(['ext']);
        expect(boxes(el)[0]!.getAttribute('name')).toBe('tags');
        expect(entries(form)).toEqual([['tags', 'ext']]);
    });

    test('discards duplicates, chips without a value and unselected ones', async () => {
        const { el } = mount();
        el.value = ['a'];
        el.insertAdjacentHTML('beforeend',
            chipHtml('a') + '<label><input type="checkbox" checked></label>' + chipHtml('off', { checked: false }));
        await tick();
        expect(el.value).toEqual(['a']);
        expect(boxes(el)).toHaveLength(1);
    });

    test('notices a chip removed from the DOM, and the validity follows', async () => {
        const { el } = mount({ name: 'tags', required: '' });
        el.value = ['a'];
        expect(el.checkValidity()).toBe(true);
        labelOf(box(el, 'a')).remove();
        await tick();
        expect(el.value).toEqual([]);
        expect(el.checkValidity()).toBe(false);
    });

    test('applies the constraints to chips that arrive from outside', async () => {
        const { form, el } = mount({ name: 'tags', minlength: '3' });
        el.insertAdjacentHTML('beforeend', chipHtml('ab'));
        await tick();
        expect(form.checkValidity()).toBe(false);
    });

    test('handles a burst of changes in one go', async () => {
        const { form, el } = mount();
        for (let i = 0; i < 20; i++) el.insertAdjacentHTML('beforeend', chipHtml('v' + i));
        await tick();
        expect(el.value).toHaveLength(20);
        expect(entries(form)).toHaveLength(20);
    });

    test('ignores anything that is not a chip: nested elements, other children', async () => {
        const { el } = mount();
        const box_ = document.createElement('div');
        box_.innerHTML = chipHtml('nested');
        el.append(box_, document.createElement('span'));
        await tick();
        expect(el.value).toEqual([]);
        expect(box_.querySelector('label')).not.toBeNull();
    });

    test('registers chips that arrive while the selector is disconnected, when it connects again', () => {
        const { form, el } = mount();
        el.remove();
        el.insertAdjacentHTML('beforeend', chipHtml('away'));
        form.append(el);
        expect(el.value).toEqual(['away']);
        expect(entries(form)).toEqual([['tags', 'away']]);
    });

    test('registers markup chips on connection', () => {
        const { el } = mount({ name: 'tags' }, chipHtml('a') + chipHtml('b'));
        expect(el.value).toEqual(['a', 'b']);
        expect(boxes(el).every(b => b.getAttribute('name') === 'tags')).toBe(true);
    });
});

// FORM RESET ===========================================

describe('DynamicSelector - form reset', () => {
    // Each test lets the mutation observer settle (`await tick()`) before resetting: in the
    // browser a reset is a task of its own, and a pending observer callback would otherwise run
    // after the reset and quietly do the work the reset handler is supposed to do.

    test('selects the declared chips again, discards the created ones, clears the draft and the error', async () => {
        const { form, el } = mount({ name: 'tags' }, chipHtml('d1') + chipHtml('d2'));
        el.value = ['d1', 'made'];                       // d2 is hidden, made is created
        add(el, '');                                      // leaves an error and no draft
        draft(el).value = 'unsent';
        await tick();

        form.reset();
        await tick();

        expect(el.value).toEqual(['d1', 'd2']);
        expect(boxes(el).map(b => b.value)).toEqual(['d1', 'd2']);
        expect(labelOf(box(el, 'd2')).hidden).toBe(false);
        expect(draft(el).value).toBe('');
        expect(status(el).textContent).toBe('');
        expect(draft(el).hasAttribute('aria-invalid')).toBe(false);
    });

    test('submits the restored selection', async () => {
        const { form, el } = mount({ name: 'tags' }, chipHtml('d'));
        el.value = ['x'];
        await tick();
        form.reset();
        await tick();
        expect(entries(form)).toEqual([['tags', 'd']]);
    });

    test('recomputes the validity', async () => {
        const { form, el } = mount({ name: 'tags', required: '' });
        el.value = ['made'];
        expect(form.checkValidity()).toBe(true);
        await tick();
        form.reset();
        await tick();
        expect(form.checkValidity()).toBe(false);
    });

    test('fires no input or change', async () => {
        const { form, el } = mount({ name: 'tags' }, chipHtml('d'));
        el.value = ['x'];
        await tick();
        const log = watch(el, form);
        form.reset();
        await tick();
        expect(log).toEqual([]);
    });

    test('waits for the browser to reset the controls, so the result does not depend on listener order', async () => {
        const { form, el } = mount({ name: 'tags' }, chipHtml('d'));
        el.value = ['x'];
        await tick();
        form.reset();
        // synchronously, the controls are reset and the selector has not yet settled
        expect(boxes(el).map(b => b.value)).toEqual(['d', 'x']);
        await tick();
        expect(boxes(el).map(b => b.value)).toEqual(['d']);
    });

    test('leaves everything as it is if somebody cancels the reset', async () => {
        const { form, el } = mount({ name: 'tags' }, chipHtml('d'));
        add(el, 'x');
        draft(el).value = 'unsent';
        await tick();
        form.addEventListener('reset', e => e.preventDefault());
        form.reset();
        await tick();
        expect(el.value).toEqual(['d', 'x']);
        expect(draft(el).value).toBe('unsent');
    });

    test('ignores the reset of a form that is not its own', async () => {
        const { el } = mount({ name: 'tags' }, chipHtml('d'));
        add(el, 'x');
        await tick();
        const other = document.createElement('form');
        document.body.append(other);
        other.reset();
        await tick();
        expect(el.value).toEqual(['d', 'x']);
    });

    test('follows the `form` attribute: it answers to the reset of the new form, not of the old one', async () => {
        const { form, el } = mount({ name: 'tags' }, chipHtml('d'));
        const other = document.createElement('form');
        other.id = 'other';
        document.body.append(other);
        el.setAttribute('form', 'other');
        add(el, 'x');
        await tick();

        form.reset();
        await tick();
        expect(boxes(el).map(b => b.value)).toEqual(['d', 'x']); // the old form's reset is not its business

        other.reset();
        await tick();
        expect(boxes(el).map(b => b.value)).toEqual(['d']);
    });

    test('stops listening to its form when disconnected, and listens again when connected', () => {
        const { form, el } = mount();
        const remove = vi.spyOn(form, 'removeEventListener');
        const addListener = vi.spyOn(form, 'addEventListener');
        el.remove();
        expect(remove).toHaveBeenCalledWith('reset', expect.any(Function));
        form.append(el);
        expect(addListener).toHaveBeenCalledWith('reset', expect.any(Function));
    });

    test('listens to the form it is moved to', async () => {
        const { el } = mount({ name: 'tags' }, chipHtml('d'));
        const form2 = document.createElement('form');
        document.body.append(form2);
        form2.append(el);
        el.value = ['x'];
        await tick();
        form2.reset();
        await tick();
        expect(boxes(el).map(b => b.value)).toEqual(['d']);
    });

    test('does nothing outside a form', async () => {
        const el = makeEl({ name: 'tags' });
        document.body.append(el);
        el.value = ['x'];
        await tick();
        expect(el.value).toEqual(['x']);
    });
});

// LIFECYCLE ===========================================

describe('DynamicSelector - lifecycle', () => {
    test('keeps its chips when it is moved, and submits them with its new form', () => {
        const { el } = mount();
        el.value = ['a', 'b'];
        const form2 = document.createElement('form');
        document.body.append(form2);
        form2.append(el);
        expect(el.value).toEqual(['a', 'b']);
        expect(el.form).toBe(form2);
        expect(entries(form2)).toEqual([['tags', 'a'], ['tags', 'b']]);
    });

    test('can be built with attributes before it is connected', () => {
        const el = makeEl({ name: 'tags', placeholder: 'p', disabled: '', required: '' });
        expect(draft(el)).toBeNull(); // nothing is built until it connects
        document.body.append(el);
        expect(draft(el).getAttribute('placeholder')).toBe('p');
        expect(draft(el).disabled).toBe(true);

        const enabled = makeEl({ name: 'tags', required: '' });
        document.body.append(enabled);
        expect(enabled.validationMessage).not.toBe('');
    });

    test('handles a large value in one go', () => {
        const { form, el } = mount();
        el.value = Array.from({ length: 500 }, (_, i) => `v${i}`);
        expect(el.value).toHaveLength(500);
        expect(entries(form)).toHaveLength(500);
    });
});