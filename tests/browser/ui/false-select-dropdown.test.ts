// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DROPDOWN_TAG, click, entries, record } from './helpers.ts';
import { FalseSelectDropdown } from '../../../src/scripts/browser/ui/components/false/false-select-dropdown.js';
// Test fails if not mocked:
import { Popover } from '../../../src/scripts/browser/ui/mixins/add_behaviour/popover.mixin.ts';
import { Expandable } from '../../../src/scripts/browser/ui/mixins/add_behaviour/expandable.mixin.ts';

// The Expandable and Popover mixins are 
// collaborators of their own (see what they 
// do in the mocks).
vi.mock('../../../src/scripts/browser/ui/mixins/add_behaviour/expandable.mixin.js', async () => ({
    Expandable: (await import('./popover.mock.js')).Expandable,
}));
vi.mock('../../../src/scripts/browser/ui/mixins/add_behaviour/popover.mixin.js', async () => ({
    Popover: (await import('./popover.mock.js')).Popover,
}));


afterEach(() => { document.body.innerHTML = ''; });

// HELPERS ===========================================

const opt = (value: string, label = value.toUpperCase(), selected = false) => ({ value, label, selected });
const ABC = () => [opt('a'), opt('b'), opt('c')];

/** A dropdown inside a form, connected. */
function mount(options = ABC(), { name = 'tags', multiple = false } = {}) {
    const form = document.createElement('form');
    const dropdown = document.createElement(DROPDOWN_TAG) as FalseSelectDropdown;
    form.append(dropdown);
    document.body.append(form);
    dropdown.name = name;
    dropdown.setMultiple(multiple);
    dropdown.setOptions(options);
    return { form, dropdown };
}

const inputs = (d: Element) => Array.from(d.querySelectorAll<HTMLInputElement>('input'));
const input = (d: Element, value: string) => inputs(d).find(i => i.value === value)!;
const checked = (d: Element) => inputs(d).filter(i => i.checked).map(i => i.value);
const types = (d: Element) => inputs(d).map(i => i.type);

// CONSTRUCTION ===========================================

describe('FalseSelectDropdown - construction', () => {
    test('can be created with document.createElement: a constructor must not add children or attributes', () => {
        const errors: unknown[] = [];
        const onError = (e: ErrorEvent) => { errors.push(e.error); e.preventDefault(); };
        window.addEventListener('error', onError);

        const d = document.createElement(DROPDOWN_TAG);
        window.removeEventListener('error', onError);

        expect(errors).toEqual([]);
        expect(d).toBeInstanceOf(FalseSelectDropdown);
        expect(d.children).toHaveLength(0);
        expect(d.attributes).toHaveLength(0);
    });

    test('starts with no options, closed', () => {
        const d = document.createElement(DROPDOWN_TAG) as FalseSelectDropdown;
        expect(d.options).toEqual([]);
        expect(d.checkedValues()).toEqual([]);
        expect(d.open).toBe(false);
        expect(d.name).toBe('');
    });

    test('gets its list when options are set: one <ul> that is a labelled group', () => {
        const { dropdown } = mount();
        const lists = dropdown.querySelectorAll(':scope > ul');
        expect(lists).toHaveLength(1);
        expect(lists[0]!.getAttribute('role')).toBe('group');
        expect(lists[0]!.getAttribute('aria-label')).not.toBe('');
    });

    test('is open-able through the mixins', () => {
        const { dropdown } = mount();
        dropdown.show();
        expect(dropdown.open).toBe(true);
        expect(dropdown.hasAttribute('open')).toBe(true);
        dropdown.close();
        expect(dropdown.open).toBe(false);
    });
});

// setOptions ===========================================

describe('FalseSelectDropdown - setOptions', () => {
    test('builds the options, in the given order, with their values, labels and selection', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        expect(dropdown.options.map(o => o.value)).toEqual(['a', 'b', 'c']);
        expect(dropdown.options.map(o => o.label)).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect(dropdown.options.map(o => o.selected)).toEqual([false, true, false]);
        expect(inputs(dropdown).map(i => i.value)).toEqual(['a', 'b', 'c']);
    });

    test('keeps the options and the DOM in the same order', () => {
        const { dropdown } = mount();
        dropdown.setOptions([opt('c'), opt('a'), opt('b')]);
        expect(dropdown.options.map(o => o.value)).toEqual(['c', 'a', 'b']);
        expect(inputs(dropdown).map(i => i.value)).toEqual(['c', 'a', 'b']);
    });

    test('puts a new option where it is in the list, not at the end', () => {
        const { dropdown } = mount([opt('a'), opt('c')]);
        dropdown.setOptions([opt('a'), opt('b'), opt('c')]);
        expect(dropdown.options.map(o => o.value)).toEqual(['a', 'b', 'c']);
        expect(inputs(dropdown).map(i => i.value)).toEqual(['a', 'b', 'c']);
    });

    test('updates the options already there in place: same option, same control', () => {
        const { dropdown } = mount();
        const before = dropdown.options.map(o => o.input);
        dropdown.setOptions([opt('a', 'Renamed'), opt('b'), opt('c')]);
        expect(dropdown.options.map(o => o.input)).toEqual(before);
        expect(dropdown.options[0]!.label).toBe('Renamed');
        expect(inputs(dropdown)).toHaveLength(3); // updating the label does not eat the controls
    });

    test('removes the options that are no longer in the list', () => {
        const { dropdown } = mount();
        dropdown.setOptions([opt('b')]);
        expect(dropdown.options.map(o => o.value)).toEqual(['b']);
        expect(inputs(dropdown).map(i => i.value)).toEqual(['b']);
    });

    test('with an empty list, leaves no options', () => {
        const { dropdown } = mount();
        dropdown.setOptions([]);
        expect(dropdown.options).toEqual([]);
        expect(inputs(dropdown)).toEqual([]);
    });

    test('keeps the last of the options that repeat a value', () => {
        const { dropdown } = mount([]);
        dropdown.setOptions([opt('a', 'First'), opt('b'), opt('a', 'Second')]);
        expect(dropdown.options.map(o => `${o.value}:${o.label}`)).toEqual(['a:Second', 'b:B']);
    });

    test('updates the selection of the options already there', () => {
        const { dropdown } = mount();
        dropdown.setOptions([opt('a'), opt('b', 'B', true), opt('c')]);
        expect(checked(dropdown)).toEqual(['b']);
    });

    test('keeps one list, still the last child, however many times it is called', () => {
        const { dropdown } = mount();
        dropdown.setOptions(ABC());
        dropdown.setOptions([opt('x')]);
        expect(dropdown.querySelectorAll('ul')).toHaveLength(1);
        expect(dropdown.lastElementChild!.localName).toBe('ul');
    });

    test('builds new options like the existing ones: type, name and disabled state', () => {
        const { dropdown } = mount([], { name: 'tags', multiple: true });
        dropdown.setDisabled(true);
        dropdown.setOptions([opt('a')]);
        const i = input(dropdown, 'a');
        expect(i.type).toBe('checkbox');
        expect(i.name).toBe('tags');
        expect(i.disabled).toBe(true);
    });

    test('in a single selection, several selected options leave the last one selected', () => {
        const { dropdown } = mount([opt('a', 'A', true), opt('b', 'B', true), opt('c', 'C', true)]);
        expect(checked(dropdown)).toEqual(['c']);
    });

    test('in a multiple selection, they all stay selected', () => {
        const { dropdown } = mount([opt('a', 'A', true), opt('b', 'B', true)], { multiple: true });
        expect(checked(dropdown)).toEqual(['a', 'b']);
    });

    test('fires no event', () => {
        const { form, dropdown } = mount();
        const log = record([['dropdown', dropdown], ['form', form]]);
        dropdown.setOptions([opt('a', 'A', true), opt('z')]);
        expect(log).toEqual([]);
    });
});

// name ===========================================

describe('FalseSelectDropdown - name', () => {
    test('can be set to a name, which the options take (it must not loop forever)', () => {
        const d = document.createElement(DROPDOWN_TAG) as FalseSelectDropdown;
        expect(() => { d.name = 'tags'; }).not.toThrow();
        expect(d.name).toBe('tags');
    });

    test('is given to the existing options, and to the ones built later', () => {
        const { dropdown } = mount(ABC(), { name: 'one' });
        dropdown.name = 'two';
        expect(inputs(dropdown).every(i => i.name === 'two')).toBe(true);
        dropdown.setOptions([...ABC(), opt('d')]);
        expect(input(dropdown, 'd').name).toBe('two');
    });

    test('names the options for the form: only the selected ones are submitted under it', () => {
        const { form, dropdown } = mount([opt('a'), opt('b', 'B', true), opt('c')], { name: 'tags' });
        expect(entries(form)).toEqual([['tags', 'b']]);
    });

    test('renaming moves the submission to the new name', () => {
        const { form, dropdown } = mount([opt('a', 'A', true)], { name: 'one' });
        dropdown.name = 'two';
        expect(entries(form)).toEqual([['two', 'a']]);
    });

    describe('without a name', () => {
        test('the options still get one, the same for all, so that the radios exclude each other', () => {
            const { dropdown } = mount(ABC(), { name: '' });
            const names = new Set(inputs(dropdown).map(i => i.name));
            expect(names.size).toBe(1);
            expect([...names][0]).not.toBe('');
            click(input(dropdown, 'a'));
            click(input(dropdown, 'c'));
            expect(checked(dropdown)).toEqual(['c']);
        });

        test('two dropdowns without a name do not interfere with each other', () => {
            const one = mount(ABC(), { name: '' }).dropdown;
            const two = mount(ABC(), { name: '' }).dropdown;
            click(input(one, 'a'));
            click(input(two, 'b'));
            expect(checked(one)).toEqual(['a']);
            expect(checked(two)).toEqual(['b']);
        });

        test('is kept out of the form: nothing is submitted, whatever is selected', () => {
            const { form, dropdown } = mount([opt('a', 'A', true)], { name: '' });
            expect(inputs(dropdown)[0]!.form).toBeNull();
            expect(entries(form)).toEqual([]);
        });

        test('is not touched by a form reset', () => {
            const { form, dropdown } = mount([opt('a', 'A', true), opt('b')], { name: '' });
            click(input(dropdown, 'b'));
            form.reset();
            expect(checked(dropdown)).toEqual(['b']);
        });

        test('with a name later, it joins the form: submitted, and reset with it', () => {
            const { form, dropdown } = mount([opt('a', 'A', true), opt('b')], { name: '' });
            dropdown.name = 'tags';
            expect(inputs(dropdown)[0]!.form).toBe(form);
            expect(entries(form)).toEqual([['tags', 'a']]);
            click(input(dropdown, 'b'));
            form.reset();
            expect(checked(dropdown)).toEqual(['a']);
        });

        test('removing the name takes it out of the form again, keeping the radios exclusive', () => {
            const { form, dropdown } = mount(ABC(), { name: 'tags' });
            dropdown.name = '';
            expect(entries(form)).toEqual([]);
            click(input(dropdown, 'a'));
            click(input(dropdown, 'b'));
            expect(checked(dropdown)).toEqual(['b']);
        });
    });
});

// multiple ===========================================

describe('FalseSelectDropdown - multiple and single selection', () => {
    test('is single by default: radio buttons', () => {
        const { dropdown } = mount();
        expect(types(dropdown)).toEqual(['radio', 'radio', 'radio']);
    });

    test('setMultiple(true) makes checkboxes, keeping the selection', () => {
        const { dropdown } = mount([opt('a'), opt('b', 'B', true)]);
        dropdown.setMultiple(true);
        expect(types(dropdown)).toEqual(['checkbox', 'checkbox']);
        expect(checked(dropdown)).toEqual(['b']);
    });

    test('several can then be selected, and they are all submitted', () => {
        const { form, dropdown } = mount(ABC(), { multiple: true });
        click(input(dropdown, 'a'));
        click(input(dropdown, 'c'));
        expect(checked(dropdown)).toEqual(['a', 'c']);
        expect(entries(form)).toEqual([['tags', 'a'], ['tags', 'c']]);
    });

    test('going back to single keeps the last selected option and unselects the others', () => {
        const { dropdown } = mount(ABC(), { multiple: true });
        dropdown.setChecked(['a', 'b', 'c'] as never);
        dropdown.setMultiple(false);
        expect(types(dropdown)).toEqual(['radio', 'radio', 'radio']);
        expect(checked(dropdown)).toEqual(['c']);
    });

    test('does so whatever the names (the radios of a named dropdown would do it on their own, the others would not)', () => {
        for (const name of ['', 'tags']) {
            const { dropdown } = mount(ABC(), { multiple: true, name });
            dropdown.setChecked(['a', 'b'] as never);
            dropdown.setMultiple(false);
            expect(checked(dropdown)).toEqual(['b']);
        }
    });

    test('with one option selected, or none, going to single changes nothing', () => {
        const one = mount([opt('a'), opt('b', 'B', true)], { multiple: true }).dropdown;
        one.setMultiple(false);
        expect(checked(one)).toEqual(['b']);
        const none = mount(ABC(), { multiple: true }).dropdown;
        none.setMultiple(false);
        expect(checked(none)).toEqual([]);
    });

    test('is idempotent', () => {
        const { dropdown } = mount(ABC(), { multiple: true });
        dropdown.setChecked(['a', 'b'] as never);
        dropdown.setMultiple(true);
        expect(checked(dropdown)).toEqual(['a', 'b']);
        dropdown.setMultiple(false);
        dropdown.setMultiple(false);
        expect(checked(dropdown)).toEqual(['b']);
    });

    test('fires no event, not even when the selection shrank', () => {
        const { form, dropdown } = mount(ABC(), { multiple: true });
        dropdown.setChecked(['a', 'b'] as never);
        const log = record([['dropdown', dropdown], ['form', form]]);
        dropdown.setMultiple(false);
        expect(checked(dropdown)).toEqual(['b']);
        expect(log).toEqual([]);
    });

    test('in a single selection, choosing another option unselects the previous one', () => {
        const { dropdown } = mount([opt('a', 'A', true), opt('b'), opt('c')]);
        click(input(dropdown, 'c'));
        expect(checked(dropdown)).toEqual(['c']);
    });
});

// checked values ===========================================

describe('FalseSelectDropdown - checkedValues, checkedLabels and setChecked', () => {
    test('lists the selected values and labels, in the order of the options', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta'), opt('c', 'Gamma')], { multiple: true });
        dropdown.setChecked(['c', 'a'] as never);
        expect(dropdown.checkedValues()).toEqual(['a', 'c']);
        expect(dropdown.checkedLabels()).toEqual(['Alpha', 'Gamma']);
    });

    test('setChecked selects exactly the given values', () => {
        const { dropdown } = mount(ABC(), { multiple: true });
        dropdown.setChecked(['a', 'b'] as never);
        dropdown.setChecked(['b', 'c'] as never);
        expect(dropdown.checkedValues()).toEqual(['b', 'c']);
    });

    test('with no values, unselects everything', () => {
        const { dropdown } = mount([opt('a', 'A', true)]);
        dropdown.setChecked([]);
        expect(dropdown.checkedValues()).toEqual([]);
    });

    test('ignores values that are not options, as a native <select> does', () => {
        const { dropdown } = mount(ABC(), { multiple: true });
        dropdown.setChecked(['a', 'nope'] as never);
        expect(dropdown.checkedValues()).toEqual(['a']);
        expect(dropdown.options).toHaveLength(3);
    });

    test('with only unknown values, selects nothing', () => {
        const { dropdown } = mount([opt('a', 'A', true)]);
        dropdown.setChecked(['nope'] as never);
        expect(dropdown.checkedValues()).toEqual([]);
    });

    test('in a single selection, keeps the last of several given values', () => {
        const { dropdown } = mount(ABC());
        dropdown.setChecked(['a', 'c'] as never);
        expect(dropdown.checkedValues()).toEqual(['c']);
    });

    test('fires no event', () => {
        const { form, dropdown } = mount(ABC(), { multiple: true });
        const log = record([['dropdown', dropdown], ['form', form]]);
        dropdown.setChecked(['a'] as never);
        dropdown.setChecked([]);
        expect(log).toEqual([]);
    });

    test('is not the default: a form reset goes back to what the options were built with', () => {
        const { form, dropdown } = mount([opt('a', 'A', true), opt('b')]);
        dropdown.setChecked(['b'] as never);
        form.reset();
        expect(dropdown.checkedValues()).toEqual(['a']);
    });
});

// events ===========================================

describe('FalseSelectDropdown - events', () => {
    const USER_CHANGE = ['input@dropdown:' + DROPDOWN_TAG, 'change@dropdown:' + DROPDOWN_TAG];

    test('a user click on an option fires input then change, once each, with the dropdown as target', () => {
        const { dropdown } = mount();
        const log = record([['dropdown', dropdown]]);
        click(input(dropdown, 'b'));
        expect(log).toEqual(USER_CHANGE);
    });

    test('they bubble out of the dropdown, input first', () => {
        const { form, dropdown } = mount();
        const log = record([['form', form], ['document', document]]);
        click(input(dropdown, 'b'));
        expect(log).toEqual([
            `input@form:${DROPDOWN_TAG}`, `input@document:${DROPDOWN_TAG}`,
            `change@form:${DROPDOWN_TAG}`, `change@document:${DROPDOWN_TAG}`,
        ]);
    });

    test('the native events of the options do not get out: nobody sees an input as target', () => {
        const { form, dropdown } = mount();
        const log = record([['dropdown', dropdown], ['form', form], ['document', document]]);
        click(input(dropdown, 'b'));
        expect(log.filter(entry => entry.endsWith(':input'))).toEqual([]);
        expect(log).toHaveLength(6);
    });

    test('the state is up to date when they fire', () => {
        const { dropdown } = mount();
        const seen: string[][] = [];
        dropdown.addEventListener('input', () => seen.push(dropdown.checkedValues()));
        dropdown.addEventListener('change', () => seen.push(dropdown.checkedValues()));
        click(input(dropdown, 'b'));
        expect(seen).toEqual([['b'], ['b']]);
    });

    test('input is composed and change is not, as with native controls', () => {
        const { dropdown } = mount();
        const events: Event[] = [];
        dropdown.addEventListener('input', e => events.push(e));
        dropdown.addEventListener('change', e => events.push(e));
        click(input(dropdown, 'a'));
        const [inputEvent, changeEvent] = events as [Event, Event];
        expect([inputEvent.bubbles, inputEvent.composed]).toEqual([true, true]);
        expect([changeEvent.bubbles, changeEvent.composed]).toEqual([true, false]);
    });

    test('a checkbox fires them when it is checked and when it is unchecked', () => {
        const { dropdown } = mount(ABC(), { multiple: true });
        const log = record([['dropdown', dropdown]]);
        click(input(dropdown, 'a'));
        click(input(dropdown, 'a'));
        expect(log).toEqual([...USER_CHANGE, ...USER_CHANGE]);
    });

    test('choosing the option that is already selected fires nothing', () => {
        const { dropdown } = mount([opt('a', 'A', true), opt('b')]);
        const log = record([['dropdown', dropdown]]);
        click(input(dropdown, 'a'));
        expect(log).toEqual([]);
    });

    test('choosing another option fires one change, not one for each option that changed', () => {
        const { dropdown } = mount([opt('a', 'A', true), opt('b')]);
        const log = record([['dropdown', dropdown]]);
        click(input(dropdown, 'b'));
        expect(log).toEqual(USER_CHANGE);
    });

    test('fires nothing for programmatic changes', () => {
        const { form, dropdown } = mount();
        const log = record([['dropdown', dropdown], ['form', form], ['document', document]]);
        dropdown.name = 'other';
        dropdown.setOptions([opt('a', 'A', true), opt('b')]);
        dropdown.setChecked(['b'] as never);
        dropdown.setMultiple(true);
        dropdown.setMultiple(false);
        dropdown.setRequired(true);
        dropdown.setDisabled(true);
        dropdown.setDisabled(false);
        dropdown.revalidate();
        expect(log).toEqual([]);
    });
});

// form ===========================================

describe('FalseSelectDropdown - form', () => {
    test('submits the selected option of a single selection, under its name', () => {
        const { form, dropdown } = mount(ABC());
        expect(entries(form)).toEqual([]);
        click(input(dropdown, 'b'));
        expect(entries(form)).toEqual([['tags', 'b']]);
        click(input(dropdown, 'c'));
        expect(entries(form)).toEqual([['tags', 'c']]);
    });

    test('submits every selected option of a multiple selection, one entry each, in the order of the options', () => {
        const { form, dropdown } = mount([opt('x'), opt('y'), opt('z')], { multiple: true });
        dropdown.setChecked(['z', 'x'] as never);
        expect(entries(form)).toEqual([['tags', 'x'], ['tags', 'z']]);
    });

    test('submits nothing when nothing is selected', () => {
        const { form } = mount(ABC(), { multiple: true });
        expect(entries(form)).toEqual([]);
    });

    test('does not submit a disabled dropdown, and submits it again when enabled', () => {
        const { form, dropdown } = mount([opt('a', 'A', true)]);
        dropdown.setDisabled(true);
        expect(entries(form)).toEqual([]);
        dropdown.setDisabled(false);
        expect(entries(form)).toEqual([['tags', 'a']]);
    });

    test('does not submit anything inside a disabled fieldset', () => {
        const { form, dropdown } = mount([opt('a', 'A', true)]);
        const fieldset = document.createElement('fieldset');
        form.append(fieldset);
        fieldset.append(dropdown);
        fieldset.disabled = true;
        expect(entries(form)).toEqual([]);
        fieldset.disabled = false;
        expect(entries(form)).toEqual([['tags', 'a']]);
    });

    test('a form reset brings back the options selected from the start', () => {
        const { form, dropdown } = mount([opt('a', 'A', true), opt('b'), opt('c')]);
        click(input(dropdown, 'c'));
        form.reset();
        expect(dropdown.checkedValues()).toEqual(['a']);
        expect(entries(form)).toEqual([['tags', 'a']]);
    });

    test('a form reset of a multiple selection brings back all of them', () => {
        const { form, dropdown } = mount([opt('a', 'A', true), opt('b', 'B', true), opt('c')], { multiple: true });
        click(input(dropdown, 'a'));
        click(input(dropdown, 'c'));
        form.reset();
        expect(dropdown.checkedValues()).toEqual(['a', 'b']);
    });

    test('a form reset fires no event', () => {
        const { form, dropdown } = mount([opt('a', 'A', true), opt('b')]);
        click(input(dropdown, 'b'));
        const log = record([['dropdown', dropdown], ['form', form], ['document', document]]);
        form.reset();
        expect(log).toEqual([]);
    });

    test('options selected from the start in a single selection: after a reset, the last one is the selected one', () => {
        const { form, dropdown } = mount([opt('a', 'A', true), opt('b', 'B', true)]);
        click(input(dropdown, 'a'));
        form.reset();
        expect(dropdown.checkedValues()).toEqual(['b']);
    });
});

// validity ===========================================

describe('FalseSelectDropdown - validity', () => {
    describe('single selection', () => {
        test('required: the form is invalid until an option is selected', () => {
            const { form, dropdown } = mount(ABC());
            dropdown.setRequired(true);
            expect(form.checkValidity()).toBe(false);
            expect(dropdown.validityControl!.validity.valueMissing).toBe(true);
            click(input(dropdown, 'b'));
            expect(form.checkValidity()).toBe(true);
        });

        test('is valid when not required, and again when no longer required', () => {
            const { form, dropdown } = mount(ABC());
            expect(form.checkValidity()).toBe(true);
            dropdown.setRequired(true);
            dropdown.setRequired(false);
            expect(form.checkValidity()).toBe(true);
        });

        test('is valid with an option selected from the start', () => {
            const { form, dropdown } = mount([opt('a', 'A', true), opt('b')]);
            dropdown.setRequired(true);
            expect(form.checkValidity()).toBe(true);
        });

        test('asks for it from options built later too', () => {
            const { form, dropdown } = mount([]);
            dropdown.setRequired(true);
            dropdown.setOptions(ABC());
            expect(form.checkValidity()).toBe(false);
        });

        test('uses the validity of the radio group, with no custom message', () => {
            const { dropdown } = mount(ABC());
            dropdown.setRequired(true);
            expect(dropdown.options.every(o => !o.input.validity.customError)).toBe(true);
            expect(dropdown.options.every(o => o.input.required)).toBe(true);
        });
    });

    describe('multiple selection', () => {
        test('required: the form is invalid until at least one option is selected', () => {
            const { form, dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            expect(form.checkValidity()).toBe(false);
            click(input(dropdown, 'b'));
            expect(form.checkValidity()).toBe(true);
        });

        test('is invalid again when the last selected option is unselected by the user', () => {
            const { form, dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            click(input(dropdown, 'b'));
            click(input(dropdown, 'b'));
            expect(form.checkValidity()).toBe(false);
        });

        test('does not ask for every checkbox: one is enough', () => {
            const { dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            expect(dropdown.options.every(o => !o.input.required)).toBe(true);
            dropdown.setChecked(['c'] as never);
            expect(dropdown.options.every(o => o.input.validity.valid)).toBe(true);
        });

        test('puts a message on the first option only, and only while nothing is selected', () => {
            const { dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            expect(dropdown.options.map(o => o.input.validity.customError)).toEqual([true, false, false]);
            expect(dropdown.validityControl!.validationMessage).not.toBe('');
            dropdown.setChecked(['b'] as never);
            expect(dropdown.options.map(o => o.input.validity.customError)).toEqual([false, false, false]);
        });

        test('follows a programmatic selection', () => {
            const { form, dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            dropdown.setChecked(['a'] as never);
            expect(form.checkValidity()).toBe(true);
            dropdown.setChecked([]);
            expect(form.checkValidity()).toBe(false);
        });

        test('is valid when not required', () => {
            const { form } = mount(ABC(), { multiple: true });
            expect(form.checkValidity()).toBe(true);
        });

        test('the message moves to the new first option when the options change', () => {
            const { dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            dropdown.setOptions([opt('x'), opt('a'), opt('b')]);
            expect(dropdown.options.map(o => o.input.validity.customError)).toEqual([true, false, false]);
            expect(dropdown.options[0]!.value).toBe('x');
        });

        test('is recomputed by revalidate() after a change the user did not make (a form reset)', () => {
            const { form, dropdown } = mount([opt('a', 'A', true), opt('b')], { multiple: true });
            dropdown.setRequired(true);
            click(input(dropdown, 'a')); // now nothing selected: invalid
            expect(form.checkValidity()).toBe(false);
            form.reset();                // the browser selects it again, silently
            dropdown.revalidate();
            expect(form.checkValidity()).toBe(true);
        });
    });

    describe('switching between them', () => {
        test('leaves nothing of the other mode behind', () => {
            const { form, dropdown } = mount(ABC(), { multiple: true });
            dropdown.setRequired(true);
            expect(dropdown.options[0]!.input.validity.customError).toBe(true);

            dropdown.setMultiple(false);
            expect(dropdown.options.some(o => o.input.validity.customError)).toBe(false);
            expect(dropdown.options.every(o => o.input.required)).toBe(true);
            expect(form.checkValidity()).toBe(false);

            dropdown.setMultiple(true);
            expect(dropdown.options.some(o => o.input.required)).toBe(false);
            expect(dropdown.options[0]!.input.validity.customError).toBe(true);
        });
    });

    test('has a control to carry the validity: the first option; none without options', () => {
        const { dropdown } = mount(ABC());
        expect(dropdown.validityControl).toBe(dropdown.options[0]!.input);
        dropdown.setOptions([]);
        expect(dropdown.validityControl).toBeNull();
    });

    test('a required selection with no options cannot be missing', () => {
        const { form, dropdown } = mount([]);
        dropdown.setRequired(true);
        expect(form.checkValidity()).toBe(true);
    });

    test('a disabled dropdown is not validated', () => {
        const { form, dropdown } = mount(ABC());
        dropdown.setRequired(true);
        dropdown.setDisabled(true);
        expect(form.checkValidity()).toBe(true);
        dropdown.setDisabled(false);
        expect(form.checkValidity()).toBe(false);
    });

    test('a dropdown without a name is not validated by the form either', () => {
        const { form, dropdown } = mount(ABC(), { name: '' });
        dropdown.setRequired(true);
        expect(form.checkValidity()).toBe(true);
    });
});

// disabled ===========================================

describe('FalseSelectDropdown - setDisabled', () => {
    test('disables every option, the ones already there and the ones built later', () => {
        const { dropdown } = mount();
        dropdown.setDisabled(true);
        expect(inputs(dropdown).every(i => i.disabled)).toBe(true);
        dropdown.setOptions([...ABC(), opt('d')]);
        expect(inputs(dropdown).every(i => i.disabled)).toBe(true);
    });

    test('enables them again', () => {
        const { dropdown } = mount();
        dropdown.setDisabled(true);
        dropdown.setDisabled(false);
        expect(inputs(dropdown).some(i => i.disabled)).toBe(false);
    });

    test('closes the dropdown if it was open', () => {
        const { dropdown } = mount();
        dropdown.show();
        dropdown.setDisabled(true);
        expect(dropdown.open).toBe(false);
    });

    test('is idempotent: disabling twice does not close what was opened in between', () => {
        const { dropdown } = mount();
        dropdown.setDisabled(true);
        dropdown.show();
        dropdown.setDisabled(true);
        expect(dropdown.open).toBe(true);
    });
});

// Navigation ===========================================

describe('FalseSelectDropdown - navigation', () => {

    function sendKey(key: string) {
        return document.activeElement
            ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    test('the first option is focused after opening', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        dropdown.show();
        expect(dropdown.querySelector('input')).toBe(document.activeElement);
    });

    test('pressing arrow down allows to move down among the options', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        dropdown.show();

        sendKey('ArrowDown');
        expect(dropdown.querySelector('li:nth-child(2) input')).toBe(document.activeElement);
    
        sendKey('ArrowDown');
        expect(dropdown.querySelector('li:nth-child(3) input')).toBe(document.activeElement);
    });

    test('pressing arrow up allows to move up among the options', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        dropdown.show();
        dropdown.querySelector<HTMLInputElement>('li:nth-child(3) input')!.focus();

        sendKey('ArrowUp');
        expect(dropdown.querySelector('li:nth-child(2) input')).toBe(document.activeElement);
    
        sendKey('ArrowUp');
        expect(dropdown.querySelector('li:nth-child(1) input')).toBe(document.activeElement);
    });

    test('pressing arrow keys does not allow to move along options in a loop', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        dropdown.show();

        dropdown.querySelector<HTMLInputElement>('li:nth-child(2) input')!.focus();
        sendKey('ArrowUp');
        sendKey('ArrowUp');
        expect(dropdown.querySelector('li:nth-child(1) input')).toBe(document.activeElement);
    
        dropdown.querySelector<HTMLInputElement>('li:nth-child(2) input')!.focus();
        sendKey('ArrowDown');
        sendKey('ArrowDown');
        expect(dropdown.querySelector('li:nth-child(3) input')).toBe(document.activeElement);
    });

    test('tab key closes dropdown without selecting anything', () => {
        const { dropdown } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        dropdown.show();
        const initVal = dropdown.checkedValues();

        sendKey('Tab');
        expect(dropdown.open).toBe(false);
        expect(dropdown.checkedValues()).toEqual(initVal);
    });

    test('enter key selects focused option and closes dropdown', () => {
        const { dropdown, form } = mount([opt('a', 'Alpha'), opt('b', 'Beta', true), opt('c', 'Gamma')]);
        dropdown.show();
        const initVal = dropdown.checkedValues();

        dropdown.querySelector('input')!.focus();
        sendKey('Enter');
        expect(dropdown.open).toBe(false);
        expect(dropdown.checkedValues()).not.toEqual(initVal);
        expect(dropdown.checkedValues()).toEqual(['a', ...initVal.slice(1)]);
    });
});