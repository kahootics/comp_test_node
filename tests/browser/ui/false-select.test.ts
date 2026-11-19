// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FalseSelect } from '../../../src/scripts/browser/ui/components/false/false-select.js';
import { FalseSelectDropdown } from '../../../src/scripts/browser/ui/components/false/false-select-dropdown.js';
import { SELECT_TAG, DROPDOWN_TAG, click, entries, record, tick } from './helpers.ts';
import { Popover } from '../../../src/scripts/browser/ui/mixins/add_behaviour/popover.mixin.ts';
import { Expandable } from '../../../src/scripts/browser/ui/mixins/add_behaviour/expandable.mixin.ts';

vi.mock('../../../src/scripts/browser/ui/mixins/add_behaviour/expandable.mixin.js', async () => ({
    Expandable: (await import('./popover.mock.js')).Expandable,
}));
vi.mock('../../../src/scripts/browser/ui/mixins/add_behaviour/popover.mixin.js', async () => ({
    Popover: (await import('./popover.mock.js')).Popover,
}));

// Not covered, because jsdom cannot show it: the real keyboard, the browser's own handling of a
// reset started by the user, a parser creating the element, and what the popover really does.

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

// HELPERS ===========================================

const OPTIONS = `<option value="a">Alpha</option><option value="b" selected>Beta</option><option value="c">Gamma</option>`;

/** A select inside a form, connected. `html` becomes its content (the <option>s). */
function mount(attrs: Record<string, string> = { name: 'color' }, html = OPTIONS) {
    const form = document.createElement('form');
    const el = document.createElement(SELECT_TAG) as FalseSelect;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.innerHTML = html;
    form.append(el);
    document.body.append(form);
    return { form, el };
}

const dropdownOf = (el: Element) => el.querySelector(DROPDOWN_TAG) as FalseSelectDropdown;
const displayOf = (el: Element) => el.querySelector(':scope > span') as HTMLSpanElement;
const inputs = (el: Element) => Array.from(el.querySelectorAll<HTMLInputElement>(`${DROPDOWN_TAG} input`));
const input = (el: Element, value: string) => inputs(el).find(i => i.value === value)!;
const checked = (el: Element) => inputs(el).filter(i => i.checked).map(i => i.value);
const types = (el: Element) => inputs(el).map(i => i.type);

const key = (target: Element, k: string) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
};

const watch = (el: Element, form: HTMLFormElement) =>
    record([['host', el], ['form', form], ['document', document]]);
const USER_CHANGE = [
    `input@host:${SELECT_TAG}`, `input@form:${SELECT_TAG}`, `input@document:${SELECT_TAG}`,
    `change@host:${SELECT_TAG}`, `change@form:${SELECT_TAG}`, `change@document:${SELECT_TAG}`,
];

// CONSTRUCTION AND STRUCTURE ===========================================

describe('construction and structure', () => {
    test('can be created with document.createElement: a constructor must not add children or attributes', () => {
        const errors: unknown[] = [];
        const onError = (e: ErrorEvent) => { errors.push(e.error); e.preventDefault(); };
        window.addEventListener('error', onError);
        const el = document.createElement(SELECT_TAG);
        window.removeEventListener('error', onError);

        expect(errors).toEqual([]);
        expect(el).toBeInstanceOf(FalseSelect);
        expect(el.children).toHaveLength(0);
        expect(el.attributes).toHaveLength(0);
    });

    test('builds its display and its dropdown when connected, display first', () => {
        const { el } = mount();
        expect(Array.from(el.children).map(c => c.localName)).toEqual(['span', DROPDOWN_TAG]);
    });

    test('adds them after whatever the element already had, and does not move them when connected again', () => {
        const { form, el } = mount({ name: 'color' }, `<em>mine</em>${OPTIONS}`);
        expect(Array.from(el.children).map(c => c.localName)).toEqual(['em', 'span', DROPDOWN_TAG]);
        el.insertAdjacentHTML('beforeend', '<strong>later</strong>');
        el.remove();
        form.append(el);
        expect(Array.from(el.children).map(c => c.localName)).toEqual(['em', 'span', DROPDOWN_TAG, 'strong']);
    });

    test('is a button that can be focused', () => {
        const { el } = mount();
        expect(el.getAttribute('role')).toBe('button');
        expect(el.tabIndex).toBe(0);
    });

    test('leaves the role and the tabindex the author gave', () => {
        const { el } = mount({ name: 'color', role: 'combobox', tabindex: '3' });
        expect(el.getAttribute('role')).toBe('combobox');
        expect(el.getAttribute('tabindex')).toBe('3');
    });

    test('registers itself as a controller of its dropdown, opening it on click', () => {
        const spy = vi.spyOn(FalseSelectDropdown.prototype, 'addController');
        const { el } = mount();
        expect(spy).toHaveBeenCalledWith(el, { toggleOnClick: true });
        expect(el.getAttribute('aria-controls')).toBe(dropdownOf(el).id);
        expect(el.getAttribute('aria-expanded')).toBe('false');
    });

    test('does not build things twice when moved or connected again', () => {
        const { el } = mount();
        const elsewhere = document.createElement('div');
        document.body.append(elsewhere);
        elsewhere.append(el);
        expect(el.querySelectorAll(':scope > span')).toHaveLength(1);
        expect(el.querySelectorAll(DROPDOWN_TAG)).toHaveLength(1);
        expect(inputs(el)).toHaveLength(3);
    });

    test('lists the attributes it reacts to', () => {
        expect(FalseSelect.observedAttributes).toEqual(['name', 'multiple', 'required', 'disabled']);
    });

    test('exposes required, multiple, disabled and name as properties that reflect the attributes', () => {
        const el = document.createElement(SELECT_TAG) as FalseSelect;
        for (const prop of ['required', 'multiple', 'disabled'] as const) {
            expect(el[prop]).toBe(false);
            el[prop] = true;
            expect(el.hasAttribute(prop)).toBe(true);
            el[prop] = false;
            expect(el.hasAttribute(prop)).toBe(false);
        }
        expect(el.name).toBe('');
        el.name = 'x';
        expect(el.getAttribute('name')).toBe('x');
    });
});

// OPTIONS FROM THE MARKUP ===========================================

describe('options from the markup', () => {
    test('become the options of the dropdown, with value, label and selection', () => {
        const { el } = mount();
        const options = dropdownOf(el).options;
        expect(options.map(o => o.value)).toEqual(['a', 'b', 'c']);
        expect(options.map(o => o.label)).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect(options.map(o => o.selected)).toEqual([false, true, false]);
    });

    test('are removed from the element once taken', () => {
        const { el } = mount();
        expect(el.querySelectorAll('option')).toHaveLength(0);
    });

    test('take the label from the `label` attribute, else from the text, else from the value', () => {
        const { el } = mount({ name: 'x' },
            `<option value="a" label="From attribute">ignored</option><option value="b">  Spaced   text </option><option value="c"></option><option>plain</option>`);
        expect(dropdownOf(el).options.map(o => o.label)).toEqual(['From attribute', 'Spaced text', '', 'plain']);
        expect(dropdownOf(el).options.map(o => o.value)).toEqual(['a', 'b', 'c', 'plain']);
    });

    test('may be nested in an <optgroup>', () => {
        const { el } = mount({ name: 'x' }, `<optgroup label="G"><option value="a">A</option></optgroup><option value="b">B</option>`);
        expect(dropdownOf(el).options.map(o => o.value)).toEqual(['a', 'b']);
    });

    test('in a single selection, several selected leave the last one', () => {
        const { el } = mount({ name: 'x' }, `<option value="a" selected>A</option><option value="b" selected>B</option>`);
        expect(el.value).toBe('b');
    });

    test('in a multiple selection, all the selected ones stay', () => {
        const { el } = mount({ name: 'x', multiple: '' }, `<option value="a" selected>A</option><option value="b" selected>B</option>`);
        expect(el.value).toEqual(['a', 'b']);
    });

    test('with the same value, the last one wins', () => {
        const { el } = mount({ name: 'x' }, `<option value="a">First</option><option value="a">Second</option>`);
        expect(dropdownOf(el).options.map(o => o.label)).toEqual(['Second']);
    });

    test('with none at all, nothing breaks and the display is empty', () => {
        const { el } = mount({ name: 'x' }, '');
        expect(dropdownOf(el).options).toEqual([]);
        expect(displayOf(el).textContent).toBe('');
        expect(el.value).toBe('');
    });

    test('that arrive after the element is connected are taken too, the existing ones staying', async () => {
        const { el } = mount();
        el.insertAdjacentHTML('beforeend', `<option value="d">Delta</option>`);
        await tick();
        expect(dropdownOf(el).options.map(o => o.value)).toEqual(['a', 'b', 'c', 'd']);
        expect(el.querySelectorAll('option')).toHaveLength(0);
        expect(el.value).toBe('b');
    });

    test('that arrive later and are selected become the selection of a single select', async () => {
        const { el } = mount();
        el.insertAdjacentHTML('beforeend', `<option value="d" selected>Delta</option>`);
        await tick();
        expect(el.value).toBe('d');
        expect(displayOf(el).textContent).toBe('Delta');
    });

    test('that arrive later and are selected join the selection of a multiple select', async () => {
        const { el } = mount({ name: 'x', multiple: '' });
        el.insertAdjacentHTML('beforeend', `<option value="d" selected>Delta</option>`);
        await tick();
        expect(el.value).toEqual(['b', 'd']);
    });

    test('that arrive later with a value that exists replace that option', async () => {
        const { el } = mount();
        el.insertAdjacentHTML('beforeend', `<option value="a">Renamed</option>`);
        await tick();
        expect(dropdownOf(el).options.map(o => o.label)).toEqual(['Renamed', 'Beta', 'Gamma']);
    });

    test('that arrive while the element is disconnected are taken when it connects again', async () => {
        const { form, el } = mount();
        el.remove();
        el.insertAdjacentHTML('beforeend', `<option value="z">Zeta</option>`);
        form.append(el);
        await tick();
        expect(dropdownOf(el).options.map(o => o.value)).toEqual(['a', 'b', 'c', 'z']);
    });

    test('are not lost when the element is disconnected and connected again', () => {
        const { form, el } = mount();
        el.remove();
        form.append(el);
        expect(dropdownOf(el).options).toHaveLength(3);
        expect(inputs(el)).toHaveLength(3);
    });
});

// DISPLAY ===========================================

describe('display', () => {
    test('shows the label of the selected option, not its value', () => {
        const { el } = mount();
        expect(displayOf(el).textContent).toBe('Beta');
    });

    test('shows the labels of the selected options of a multiple select, joined', () => {
        const { el } = mount({ name: 'x', multiple: '' });
        el.value = ['c', 'a'];
        expect(displayOf(el).textContent).toBe('Alpha, Gamma');
    });

    test('is empty when nothing is selected', () => {
        const { el } = mount({ name: 'x' }, `<option value="a">A</option>`);
        expect(displayOf(el).textContent).toBe('');
    });

    test('follows a choice of the user', () => {
        const { el } = mount();
        click(input(el, 'c'));
        expect(displayOf(el).textContent).toBe('Gamma');
    });

    test('follows the value being set from code', () => {
        const { el } = mount();
        el.value = 'c';
        expect(displayOf(el).textContent).toBe('Gamma');
        el.value = '';
        expect(displayOf(el).textContent).toBe('');
    });

    test('follows a selection reduced by going from multiple to single', () => {
        const { el } = mount({ name: 'x', multiple: '' });
        el.value = ['a', 'b', 'c'];
        expect(displayOf(el).textContent).toBe('Alpha, Beta, Gamma');
        el.multiple = false;
        expect(displayOf(el).textContent).toBe('Gamma');
    });

    test('follows a form reset', async () => {
        const { form, el } = mount();
        click(input(el, 'a'));
        expect(displayOf(el).textContent).toBe('Alpha');
        form.reset();
        await tick();
        expect(displayOf(el).textContent).toBe('Beta');
    });

    test('shows text as text', async () => {
        const { el } = mount({ name: 'x' }, `<option value="a">&lt;b&gt;bold&lt;/b&gt;</option>`);
        el.value = 'a';
        expect(displayOf(el).querySelector('b')).toBeNull();
        expect(displayOf(el).textContent).toBe('<b>bold</b>');
    });
});

// VALUE ===========================================

describe('value', () => {
    test('of a single select is the selected value as a string', () => {
        const { el } = mount();
        expect(el.value).toBe('b');
    });

    test('of a single select with nothing selected is an empty string', () => {
        const { el } = mount({ name: 'x' }, `<option value="a">A</option>`);
        expect(el.value).toBe('');
    });

    test('of a multiple select is an array, empty when nothing is selected', () => {
        const { el } = mount({ name: 'x', multiple: '' }, `<option value="a">A</option>`);
        expect(el.value).toEqual([]);
        el.value = ['a'];
        expect(el.value).toEqual(['a']);
    });

    test('can be set to a string or to an array, in either kind of select', () => {
        const single = mount().el;
        single.value = 'a';
        expect(single.value).toBe('a');
        single.value = ['c'];
        expect(single.value).toBe('c');

        const multiple = mount({ name: 'x', multiple: '' }).el;
        multiple.value = 'a';
        expect(multiple.value).toEqual(['a']);
        multiple.value = ['a', 'c'];
        expect(multiple.value).toEqual(['a', 'c']);
    });

    test('ignores values that are not options, as a native <select> does', () => {
        const { el } = mount({ name: 'x', multiple: '' });
        el.value = ['a', 'nope'];
        expect(el.value).toEqual(['a']);
        const single = mount().el;
        single.value = 'nope';
        expect(single.value).toBe('');
        expect(checked(single)).toEqual([]);
    });

    test('in a single select, keeps the last of several values', () => {
        const { el } = mount();
        el.value = ['a', 'c'];
        expect(el.value).toBe('c');
    });

    test('can be set to nothing', () => {
        const { el } = mount({ name: 'x', multiple: '' });
        el.value = ['a'];
        el.value = [];
        expect(el.value).toEqual([]);
    });

    test('fires no event', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        el.value = 'a';
        el.value = '';
        expect(log).toEqual([]);
    });
});

// ATTRIBUTES ===========================================

describe('attributes', () => {
    describe('name', () => {
        test('is the name of the options, so that the form submits them under it', () => {
            const { form, el } = mount({ name: 'color' });
            expect(inputs(el).every(i => i.name === 'color')).toBe(true);
            expect(entries(form)).toEqual([['color', 'b']]);
        });

        test('can change, and the form follows', () => {
            const { form, el } = mount({ name: 'color' });
            el.setAttribute('name', 'shade');
            expect(entries(form)).toEqual([['shade', 'b']]);
        });

        test('can be added later: the select joins the form', () => {
            const { form, el } = mount({});
            expect(entries(form)).toEqual([]);
            el.setAttribute('name', 'color');
            expect(entries(form)).toEqual([['color', 'b']]);
        });

        test('connecting with a name works (it used to loop forever and leave the element half built)', () => {
            const errors: unknown[] = [];
            const onError = (e: ErrorEvent) => { errors.push(e.error); e.preventDefault(); };
            window.addEventListener('error', onError);
            const { el } = mount({ name: 'color' });
            window.removeEventListener('error', onError);
            expect(errors).toEqual([]);
            expect(inputs(el)).toHaveLength(3);
        });
    });

    describe('multiple', () => {
        test('makes the options checkboxes, and removing it makes them radio buttons again', () => {
            const { el } = mount({ name: 'x' });
            expect(types(el)).toEqual(['radio', 'radio', 'radio']);
            el.multiple = true;
            expect(types(el)).toEqual(['checkbox', 'checkbox', 'checkbox']);
            el.multiple = false;
            expect(types(el)).toEqual(['radio', 'radio', 'radio']);
        });

        test('is applied when the element connects with it', () => {
            const { el } = mount({ name: 'x', multiple: '' });
            expect(types(el)).toEqual(['checkbox', 'checkbox', 'checkbox']);
        });

        test('changes the shape of value', () => {
            const { el } = mount({ name: 'x' });
            expect(el.value).toBe('b');
            el.multiple = true;
            expect(el.value).toEqual(['b']);
        });

        test('keeps the selection going to multiple', () => {
            const { el } = mount({ name: 'x' });
            el.multiple = true;
            expect(el.value).toEqual(['b']);
        });

        test('going to single keeps the last selected option, as the browser does for a <select>', () => {
            const { el } = mount({ name: 'x', multiple: '' });
            el.value = ['a', 'b', 'c'];
            el.multiple = false;
            expect(el.value).toBe('c');
            expect(checked(el)).toEqual(['c']);
        });

        test('does so with or without a name', () => {
            for (const name of ['x', '']) {
                const { el } = mount(name ? { name, multiple: '' } : { multiple: '' });
                el.value = ['a', 'b'];
                el.multiple = false;
                expect(el.value).toBe('b');
            }
        });

        test('fires no event, even when the selection shrank', () => {
            const { form, el } = mount({ name: 'x', multiple: '' });
            el.value = ['a', 'b'];
            const log = watch(el, form);
            el.multiple = false;
            expect(log).toEqual([]);
        });

        test('submits every selected option when multiple, one when not', () => {
            const { form, el } = mount({ name: 'x', multiple: '' });
            el.value = ['a', 'c'];
            expect(entries(form)).toEqual([['x', 'a'], ['x', 'c']]);
            el.multiple = false;
            expect(entries(form)).toEqual([['x', 'c']]);
        });
    });

    describe('disabled', () => {
        test('disables the options, and the select is marked as disabled', () => {
            const { el } = mount();
            el.disabled = true;
            expect(inputs(el).every(i => i.disabled)).toBe(true);
            expect(el.getAttribute('aria-disabled')).toBe('true');
        });

        test('is no longer a tab stop while disabled, and is again afterwards', () => {
            const { el } = mount();
            el.disabled = true;
            expect(el.tabIndex).toBe(-1);
            el.disabled = false;
            expect(el.tabIndex).toBe(0);
            expect(el.hasAttribute('aria-disabled')).toBe(false);
            expect(inputs(el).some(i => i.disabled)).toBe(false);
        });

        test('leaves alone a tabindex the author set', () => {
            const { el } = mount({ name: 'color', tabindex: '5' });
            el.disabled = true;
            el.disabled = false;
            expect(el.getAttribute('tabindex')).toBe('5');
        });

        test('is applied when the element connects with it', () => {
            const { el } = mount({ name: 'color', disabled: '' });
            expect(inputs(el).every(i => i.disabled)).toBe(true);
            expect(el.tabIndex).toBe(-1);
            expect(el.getAttribute('aria-disabled')).toBe('true');
        });

        test('submits nothing', () => {
            const { form, el } = mount();
            el.disabled = true;
            expect(entries(form)).toEqual([]);
            el.disabled = false;
            expect(entries(form)).toEqual([['color', 'b']]);
        });

        test('closes the dropdown if it was open', () => {
            const { el } = mount();
            dropdownOf(el).show();
            el.disabled = true;
            expect(dropdownOf(el).open).toBe(false);
        });

        test('applies to options that arrive later', async () => {
            const { el } = mount();
            el.disabled = true;
            el.insertAdjacentHTML('beforeend', `<option value="d">D</option>`);
            await tick();
            expect(inputs(el).every(i => i.disabled)).toBe(true);
        });
    });
});

// EVENTS ===========================================

describe('events', () => {
    test('a choice of the user fires input then change, once each, from the select, bubbling', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        click(input(el, 'c'));
        expect(log).toEqual(USER_CHANGE);
    });

    test('nobody sees the options or the dropdown as the target of an event', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        click(input(el, 'c'));
        expect(log.filter(entry => !entry.endsWith(`:${SELECT_TAG}`))).toEqual([]);
    });

    test('listeners of the dropdown itself and of the options see nothing of it from outside the select', () => {
        const { el } = mount();
        const seen: string[] = [];
        // listeners above the dropdown but below the select would see native events: there are none
        dropdownOf(el).addEventListener('change', e => seen.push(`dropdown:${(e.target as Element).localName}`));
        click(input(el, 'c'));
        // the dropdown's own (synthetic) change is taken by the select before it reaches anybody
        expect(seen).toEqual([]);
    });

    test('the state is up to date when they fire: value, display and form', () => {
        const { form, el } = mount();
        const seen: unknown[] = [];
        const read = () => seen.push([el.value, displayOf(el).textContent, entries(form)]);
        el.addEventListener('input', read);
        el.addEventListener('change', read);
        click(input(el, 'c'));
        const expected = ['c', 'Gamma', [['color', 'c']]];
        expect(seen).toEqual([expected, expected]);
    });

    test('input is composed and change is not, as with native controls', () => {
        const { el } = mount();
        const events: Event[] = [];
        el.addEventListener('input', e => events.push(e));
        el.addEventListener('change', e => events.push(e));
        click(input(el, 'c'));
        const [inputEvent, changeEvent] = events as [Event, Event];
        expect([inputEvent.bubbles, inputEvent.composed]).toEqual([true, true]);
        expect([changeEvent.bubbles, changeEvent.composed]).toEqual([true, false]);
    });

    test('in a multiple select, checking and unchecking each fire them once', () => {
        const { form, el } = mount({ name: 'x', multiple: '' });
        const log = watch(el, form);
        click(input(el, 'a'));
        click(input(el, 'a'));
        expect(log).toEqual([...USER_CHANGE, ...USER_CHANGE]);
    });

    test('choosing the option that is already selected fires nothing', () => {
        const { form, el } = mount();
        const log = watch(el, form);
        click(input(el, 'b'));
        expect(log).toEqual([]);
    });

    test('fires nothing for programmatic changes: value, attributes, options', async () => {
        const { form, el } = mount();
        const log = watch(el, form);
        el.value = 'a';
        el.multiple = true;
        el.multiple = false;
        el.required = true;
        el.disabled = true;
        el.disabled = false;
        el.setAttribute('name', 'other');
        el.insertAdjacentHTML('beforeend', `<option value="d" selected>D</option>`);
        await tick();
        expect(log).toEqual([]);
    });

    test('two selects do not hear each other', () => {
        const first = mount({ name: 'one' });
        const second = mount({ name: 'two' });
        const log = record([['second', second.el]]);
        click(input(first.el, 'c'));
        expect(log).toEqual([]);
    });
});

// KEYBOARD AND MOUSE ===========================================

describe('keyboard and mouse', () => {
    // !Test fails in jsdom, but behaviour seems correct in real browser,
    // check for mock error or missing jsdom behaviour
    test.each(['Enter', ' '])('the %j key opens the dropdown, /* and the page does not scroll */', (k) => {
        const { el } = mount();
        const e = key(el, k);
        expect(e.defaultPrevented).toBe(true);
        
        const show = vi.spyOn(dropdownOf(el), 'show');
        const close = vi.spyOn(dropdownOf(el), 'close');

        expect(close).not.toHaveBeenCalled();
        expect(show).toHaveBeenCalled();

        expect(dropdownOf(el).open).toBe(true);
        expect(el.getAttribute('aria-expanded')).toBe('true');
    });

    test('other keys do nothing', () => {
        const { el } = mount();
        const e = key(el, 'a');
        expect(e.defaultPrevented).toBe(false);
        expect(dropdownOf(el).open).toBe(false);
    });

    test('enter closes dropdown', () => {
        const { el } = mount();
        dropdownOf(el).show();
        const show = vi.spyOn(dropdownOf(el), 'show');
        const close = vi.spyOn(dropdownOf(el), 'close');
        const e = key(el, 'Enter');
        expect(e.defaultPrevented).toBe(true);
        expect(show).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledOnce();
    });

    test('ignores the key presses made on the options inside it', () => {
        const { el } = mount();
        const e = key(input(el, 'a'), ' ');
        expect(e.defaultPrevented).toBe(false);
        expect(dropdownOf(el).open).toBe(false);
    });

    test('does nothing when disabled', () => {
        const { el } = mount({ name: 'color', disabled: '' });
        const e = key(el, 'Enter');
        expect(e.defaultPrevented).toBe(false);
        expect(dropdownOf(el).open).toBe(false);
    });

    test('a click opens it', () => {
        const { el } = mount();
        el.click();
        expect(dropdownOf(el).open).toBe(true);
    });

    test('a click does not open it when disabled', () => {
        const { el } = mount({ name: 'color', disabled: '' });
        el.click();
        expect(dropdownOf(el).open).toBe(false);
    });

    test('opens again by click once enabled', () => {
        const { el } = mount({ name: 'color', disabled: '' });
        el.disabled = false;
        el.click();
        expect(dropdownOf(el).open).toBe(true);
    });
});

// FORM ===========================================

describe('form', () => {
    test('submits the selected option under its name; nothing when none is selected', () => {
        const { form, el } = mount({ name: 'color' }, `<option value="a">A</option><option value="b">B</option>`);
        expect(entries(form)).toEqual([]);
        click(input(el, 'b'));
        expect(entries(form)).toEqual([['color', 'b']]);
    });

    test('submits every selected option of a multiple select, one entry each, in the order of the options', () => {
        const { form, el } = mount({ name: 'colors', multiple: '' });
        el.value = ['c', 'a'];
        expect(entries(form)).toEqual([['colors', 'a'], ['colors', 'c']]);
    });

    test('submits the selection that was there from the start', () => {
        const { form } = mount();
        expect(entries(form)).toEqual([['color', 'b']]);
    });

    test('follows the user: choosing another option changes what is submitted', () => {
        const { form, el } = mount();
        click(input(el, 'a'));
        expect(entries(form)).toEqual([['color', 'a']]);
    });

    test('keeps two selects of a form apart', () => {
        const form = document.createElement('form');
        form.innerHTML = `<${SELECT_TAG} name="one"><option value="1" selected>1</option></${SELECT_TAG}><${SELECT_TAG} name="two" multiple><option value="x" selected>x</option><option value="y" selected>y</option></${SELECT_TAG}>`;
        document.body.append(form);
        expect(entries(form)).toEqual([['one', '1'], ['two', 'x'], ['two', 'y']]);
    });

    test('does not submit what is inside a disabled fieldset', () => {
        const { form, el } = mount();
        const fieldset = document.createElement('fieldset');
        form.append(fieldset);
        fieldset.append(el);
        fieldset.disabled = true;
        expect(entries(form)).toEqual([]);
        fieldset.disabled = false;
        expect(entries(form)).toEqual([['color', 'b']]);
    });

    test('is the form the select sits in', () => {
        const { form, el } = mount();
        expect(el.form).toBe(form);
        const alone = document.createElement(SELECT_TAG) as FalseSelect;
        document.body.append(alone);
        expect(alone.form).toBeNull();
    });

    describe('without a name', () => {
        test('works as a select (its radio buttons exclude each other) but submits nothing', () => {
            const { form, el } = mount({}, OPTIONS);
            click(input(el, 'a'));
            click(input(el, 'c'));
            expect(checked(el)).toEqual(['c']);
            expect(el.value).toBe('c');
            expect(entries(form)).toEqual([]);
        });

        test('a form reset does not touch it', async () => {
            const { form, el } = mount({});
            click(input(el, 'a'));
            form.reset();
            await tick();
            expect(el.value).toBe('a');
        });

        test('is not validated by the form', () => {
            const { form } = mount({ required: '' }, `<option value="a">A</option>`);
            expect(form.checkValidity()).toBe(true);
        });
    });
});

// VALIDITY ===========================================

describe('required', () => {
    const OPTS = `<option value="a">A</option><option value="b">B</option>`;

    test('a single select asks for a selection: the form is invalid until there is one', () => {
        const { form, el } = mount({ name: 'x', required: '' }, OPTS);
        expect(form.checkValidity()).toBe(false);
        click(input(el, 'a'));
        expect(form.checkValidity()).toBe(true);
    });

    test('a multiple select asks for at least one', () => {
        const { form, el } = mount({ name: 'x', required: '', multiple: '' }, OPTS);
        expect(form.checkValidity()).toBe(false);
        click(input(el, 'a'));
        expect(form.checkValidity()).toBe(true);
        click(input(el, 'b'));
        expect(form.checkValidity()).toBe(true);
        click(input(el, 'a'));
        click(input(el, 'b'));
        expect(form.checkValidity()).toBe(false);
    });

    test('is satisfied by a selection made from code, and unsatisfied by clearing it', () => {
        const { form, el } = mount({ name: 'x', required: '', multiple: '' }, OPTS);
        el.value = ['a'];
        expect(form.checkValidity()).toBe(true);
        el.value = [];
        expect(form.checkValidity()).toBe(false);
    });

    test('is satisfied by an option selected from the start', () => {
        const { form } = mount({ name: 'x', required: '' }, `<option value="a" selected>A</option>`);
        expect(form.checkValidity()).toBe(true);
    });

    test('can be added and removed', () => {
        const { form, el } = mount({ name: 'x' }, OPTS);
        expect(form.checkValidity()).toBe(true);
        el.required = true;
        expect(form.checkValidity()).toBe(false);
        el.required = false;
        expect(form.checkValidity()).toBe(true);
    });

    test('survives going between single and multiple', () => {
        const { form, el } = mount({ name: 'x', required: '' }, OPTS);
        el.multiple = true;
        expect(form.checkValidity()).toBe(false);
        el.value = ['a'];
        el.multiple = false;
        expect(form.checkValidity()).toBe(true);
    });

    test('is not asked of a disabled select', () => {
        const { form } = mount({ name: 'x', required: '', disabled: '' }, OPTS);
        expect(form.checkValidity()).toBe(true);
    });

    test('with no options, nothing can be missing', () => {
        const { form } = mount({ name: 'x', required: '' }, '');
        expect(form.checkValidity()).toBe(true);
    });

    test('reporting a missing selection opens the dropdown, so that the browser has something to point at', () => {
        const { form, el } = mount({ name: 'x', required: '' }, OPTS);
        expect(dropdownOf(el).open).toBe(false);
        expect(form.reportValidity()).toBe(false);
        expect(dropdownOf(el).open).toBe(true);
    });

    test('does the same for a multiple select', () => {
        const { form, el } = mount({ name: 'x', required: '', multiple: '' }, OPTS);
        form.reportValidity();
        expect(dropdownOf(el).open).toBe(true);
    });

    test('a valid select is not opened by the form being reported', () => {
        const { form, el } = mount({ name: 'x', required: '' }, `<option value="a" selected>A</option>`);
        form.reportValidity();
        expect(dropdownOf(el).open).toBe(false);
    });

    test('does not open the dropdown again when it is already open', () => {
        const { form, el } = mount({ name: 'x', required: '' }, OPTS);
        dropdownOf(el).show();
        const show = vi.spyOn(dropdownOf(el), 'show');
        form.reportValidity();
        expect(show).not.toHaveBeenCalled();
    });

    describe('validity API of the element', () => {
        test('reports the validity of the selection', () => {
            const { el } = mount({ name: 'x', required: '' }, OPTS);
            expect(el.willValidate).toBe(true);
            expect(el.checkValidity()).toBe(false);
            expect(el.validity.valueMissing).toBe(true);
            expect(el.validationMessage).not.toBe('');
            click(input(el, 'a'));
            expect(el.checkValidity()).toBe(true);
            expect(el.validity.valid).toBe(true);
            expect(el.validationMessage).toBe('');
        });

        test('reportValidity opens the dropdown when invalid', () => {
            const { el } = mount({ name: 'x', required: '' }, OPTS);
            expect(el.reportValidity()).toBe(false);
            expect(dropdownOf(el).open).toBe(true);
        });

        test('of a multiple select says what is missing', () => {
            const { el } = mount({ name: 'x', required: '', multiple: '' }, OPTS);
            expect(el.validity.customError).toBe(true);
            expect(el.validationMessage).not.toBe('');
        });

        test('is valid and not validated when there are no options', () => {
            const { el } = mount({ name: 'x', required: '' }, '');
            expect(el.willValidate).toBe(false);
            expect(el.checkValidity()).toBe(true);
            expect(el.validity.valid).toBe(true);
            expect(el.validationMessage).toBe('');
            expect(el.reportValidity()).toBe(true);
        });
    });
});

// FORM RESET ===========================================

describe('form reset', () => {
    // Each test lets the mutation observer settle before resetting: in the browser a reset is
    // a task of its own, and a pending observer callback would otherwise run after the reset.

    test('brings back the option that was selected from the start, and shows it', async () => {
        const { form, el } = mount();
        click(input(el, 'c'));
        await tick();
        form.reset();
        await tick();
        expect(el.value).toBe('b');
        expect(displayOf(el).textContent).toBe('Beta');
        expect(entries(form)).toEqual([['color', 'b']]);
    });

    test('brings back all the options selected from the start of a multiple select', async () => {
        const { form, el } = mount({ name: 'x', multiple: '' }, `<option value="a" selected>A</option><option value="b" selected>B</option><option value="c">C</option>`);
        click(input(el, 'a'));
        click(input(el, 'c'));
        await tick();
        form.reset();
        await tick();
        expect(el.value).toEqual(['a', 'b']);
        expect(displayOf(el).textContent).toBe('A, B');
    });

    test('unselects what was selected from code, if it was not selected from the start', async () => {
        const { form, el } = mount({ name: 'x' }, `<option value="a">A</option><option value="b">B</option>`);
        el.value = 'b';
        await tick();
        form.reset();
        await tick();
        expect(el.value).toBe('');
        expect(displayOf(el).textContent).toBe('');
    });

    test('waits for the browser to reset the options before updating the display', async () => {
        const { form, el } = mount();
        click(input(el, 'c'));
        await tick();
        form.reset();
        expect(displayOf(el).textContent).toBe('Gamma'); // not yet
        await tick();
        expect(displayOf(el).textContent).toBe('Beta');
    });

    test('fires no input or change', async () => {
        const { form, el } = mount();
        click(input(el, 'c'));
        await tick();
        const log = watch(el, form);
        form.reset();
        await tick();
        expect(log).toEqual([]);
    });

    test('recomputes the validity of a required multiple select', async () => {
        const { form, el } = mount({ name: 'x', required: '', multiple: '' }, `<option value="a" selected>A</option><option value="b">B</option>`);
        click(input(el, 'a'));
        expect(form.checkValidity()).toBe(false);
        await tick();
        form.reset();
        await tick();
        expect(form.checkValidity()).toBe(true);
    });

    test('leaves everything as it is if somebody cancels the reset', async () => {
        const { form, el } = mount();
        click(input(el, 'c'));
        await tick();
        form.addEventListener('reset', e => e.preventDefault());
        form.reset();
        await tick();
        expect(el.value).toBe('c');
        expect(displayOf(el).textContent).toBe('Gamma');
    });

    test('ignores the reset of another form', async () => {
        const { el } = mount();
        click(input(el, 'c'));
        await tick();
        const other = document.createElement('form');
        document.body.append(other);
        const spy = vi.spyOn(dropdownOf(el), 'revalidate');
        other.reset();
        await tick();
        expect(spy).not.toHaveBeenCalled();
        expect(el.value).toBe('c');
    });

    test('stops listening to its form when disconnected, and listens again when connected', () => {
        const { form, el } = mount();
        const remove = vi.spyOn(form, 'removeEventListener');
        const add = vi.spyOn(form, 'addEventListener');
        el.remove();
        expect(remove).toHaveBeenCalledWith('reset', expect.any(Function));
        form.append(el);
        expect(add).toHaveBeenCalledWith('reset', expect.any(Function));
    });

    test('listens to the form it is moved to', async () => {
        const { el } = mount();
        const form2 = document.createElement('form');
        document.body.append(form2);
        form2.append(el);
        click(input(el, 'c'));
        await tick();
        form2.reset();
        await tick();
        expect(el.value).toBe('b');
        expect(displayOf(el).textContent).toBe('Beta');
    });

    test('does nothing outside a form', async () => {
        const el = document.createElement(SELECT_TAG) as FalseSelect;
        el.innerHTML = OPTIONS;
        document.body.append(el);
        expect(el.value).toBe('b');
        await tick();
        expect(displayOf(el).textContent).toBe('Beta');
    });
});

// LIFECYCLE ===========================================

describe('lifecycle', () => {
    test('keeps its selection when moved to another place', () => {
        const { el } = mount();
        click(input(el, 'c'));
        const elsewhere = document.createElement('div');
        document.body.append(elsewhere);
        elsewhere.append(el);
        expect(el.value).toBe('c');
        expect(displayOf(el).textContent).toBe('Gamma');
    });

    test('applies the attributes it was given before it connected', () => {
        const el = document.createElement(SELECT_TAG) as FalseSelect;
        el.setAttribute('name', 'x');
        el.setAttribute('multiple', '');
        el.setAttribute('required', '');
        el.innerHTML = OPTIONS;
        const form = document.createElement('form');
        form.append(el);
        document.body.append(form);
        expect(types(el)).toEqual(['checkbox', 'checkbox', 'checkbox']);
        expect(inputs(el).every(i => i.name === 'x')).toBe(true);
        expect(el.value).toEqual(['b']);
    });

    test('can be given its options through the property of the dropdown, without markup', () => {
        const el = document.createElement(SELECT_TAG) as FalseSelect;
        el.setAttribute('name', 'x');
        document.body.append(el);
        dropdownOf(el).setOptions([{ value: 'a', label: 'A', selected: true }]);
        expect(inputs(el)).toHaveLength(1);
        expect(dropdownOf(el).checkedValues()).toEqual(['a']);
    });
});