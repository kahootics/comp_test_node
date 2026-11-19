// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FalseOption } from '../../../src/scripts/browser/ui/components/false/false-option';
import type { dummy } from "../../setup";

afterEach(() => { document.body.innerHTML = ''; });

const data = (value = 'a', label = 'Alpha', selected = false) => ({ value, label, selected });

/** Puts an option in a form, so that the browser's own form behaviour applies to it. */
function inForm(...ops: FalseOption[]) {
    const form = document.createElement('form');
    const ul = document.createElement('ul');
    for (const op of ops) ul.append(op.el);
    form.append(ul);
    document.body.append(form);
    return form;
}
const entries = (form: HTMLFormElement) => Array.from(new FormData(form).entries());

describe('FalseOption - structure', () => {
    test('is a <li> holding a <label> with the control and the text (<input>,<span>)', () => {
        const op = new FalseOption(data());
        expect(op.el.localName).toBe('li');
        const label = op.el.firstElementChild as HTMLElement;
        expect(label.localName).toBe('label');
        expect(Array.from(label.children).map(c => c.localName)).toEqual(['input', 'span']);
        expect(label.querySelector('span')!.textContent).toBe('Alpha');
    });

    test('exposes its control (is in Light DOM)', () => {
        const op = new FalseOption(data());
        expect(op.input).toBe(op.el.querySelector('input'));
    });

    test('defaults as a radio button, so that it is a valid control from the beginning', () => {
        expect(new FalseOption(data()).input.type).toBe('radio');
    });

    test('keeps the value as it is, quotes and spaces included', () => {
        const op = new FalseOption(data(` a"b'c `));
        expect(op.value).toBe(` a"b'c `);
    });

    test('takes the label as text, never as markup', () => {
        const op = new FalseOption(data('a', '<b>bold</b> & "quoted"'));
        expect(op.el.querySelector('b')).toBeNull();
        expect(op.label).toBe('<b>bold</b> & "quoted"');
    });
});

describe('FalseOption - accessors', () => {
    test('reads value and label', () => {
        const op = new FalseOption(data('a', 'Alpha'));
        expect(op.value).toBe('a');
        expect(op.label).toBe('Alpha');
    });

    test('name reads and writes the control\'s name', () => {
        const op = new FalseOption(data());
        expect(op.name).toBe('');
        op.name = 'color';
        expect(op.name).toBe('color');
        expect(op.input.name).toBe('color');
    });

    test('multiple makes it a checkbox, and not multiple a radio button, keeping what is selected', () => {
        const op = new FalseOption(data('a', 'Alpha', true));
        op.multiple = true;
        expect(op.input.type).toBe('checkbox');
        expect(op.selected).toBe(true);
        op.multiple = false;
        expect(op.input.type).toBe('radio');
        expect(op.selected).toBe(true);
    });

    test('selected reads and writes the the box checked property', () => {
        const op = new FalseOption(data());
        expect(op.selected).toBe(false);
        op.selected = true;
        expect(op.input.checked).toBe(true);
        expect(op.selected).toBe(true);
    });

    test('disabled and required are those of the control', () => {
        const op = new FalseOption(data());
        op.disabled = true;
        op.required = true;
        expect(op.input.disabled).toBe(true);
        expect(op.input.required).toBe(true);
        op.disabled = false;
        op.required = false;
        expect(op.input.disabled).toBe(false);
        expect(op.input.required).toBe(false);
    });

    test('setCustomValidity puts a message on the control, and an empty one takes it away', () => {
        const op = new FalseOption(data());
        inForm(op);
        op.setCustomValidity('nope');
        expect(op.input.validity.customError).toBe(true);
        expect(op.input.validationMessage).toBe('nope');
        op.setCustomValidity('');
        expect(op.input.validity.valid).toBe(true);
    });
});

describe('FalseOption - selected: current state and default', () => {
    test('an option built selected has `defaultChecked` on the input set to true', () => {
        const op = new FalseOption(data('a', 'Alpha', true));
        expect(op.selected).toBe(true);
        expect(op.input.defaultChecked).toBe(true);
        expect(op.input.hasAttribute('checked')).toBe(true);
    });

    test('an option built unselected has it set to false', () => {
        const op = new FalseOption(data());
        expect(op.selected).toBe(false);
        expect(op.input.defaultChecked).toBe(false);
    });

    test('selecting it later changes the current state only, not the default', () => {
        const op = new FalseOption(data());
        op.selected = true;
        expect(op.input.defaultChecked).toBe(false);
        expect(op.input.hasAttribute('checked')).toBe(false);
    });

    test('a form reset brings back the initially selected option', () => {
        const op = new FalseOption(data('a', 'Alpha', true));
        const form = inForm(op);
        op.name = 'x';
        op.selected = false;
        form.reset();
        expect(op.selected).toBe(true);
    });

    test('a form reset unselects an option that was selected afterwards', () => {
        const op = new FalseOption(data());
        const form = inForm(op);
        op.selected = true;
        form.reset();
        expect(op.selected).toBe(false);
    });
});

describe('FalseOption - updateFrom', () => {
    test('changes the label and the selection', () => {
        const op = new FalseOption(data('a', 'Alpha', false));
        op.updateFrom(data('a', 'Renamed', true));
        expect(op.label).toBe('Renamed');
        expect(op.selected).toBe(true);
    });

    test('keeps the control inside the option (changing the text must not remove it)', () => {
        const op = new FalseOption(data('a', 'Alpha'));
        const input = op.input;
        op.updateFrom(data('a', 'Renamed'));
        expect(op.el.contains(input)).toBe(true);
        expect(op.input).toBe(input);
        expect(op.el.querySelectorAll('input')).toHaveLength(1);
    });

    test('does not touch the default selection', () => {
        const op = new FalseOption(data('a', 'Alpha', true));
        op.updateFrom(data('a', 'Alpha', false));
        expect(op.selected).toBe(false);
        expect(op.input.defaultChecked).toBe(true);
    });

    // Fragile to error message changes
    test('refuses another value, saying which, and changes nothing', () => {
        const op = new FalseOption(data('a', 'Alpha', false));
        expect(() => op.updateFrom(data('b', 'Other', true))).toThrowWithName('IllegalAccessError');
        expect(() => op.updateFrom(data('b', 'Other', true))).toThrow(/expected a, but found b/);
        expect(op.label).toBe('Alpha');
        expect(op.selected).toBe(false);
    });
});

describe('FalseOption - onchange', () => {
    test('is called, with the native event, when the user changes the option', () => {
        const op = new FalseOption(data());
        inForm(op);
        const callback = vi.fn();
        op.onchange(callback);
        op.input.click();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0]![0]).toBeInstanceOf(Event);
        expect(callback.mock.calls[0]![0].type).toBe('change');
    });

    test('is not called for a programmatic change', () => {
        const op = new FalseOption(data());
        const callback = vi.fn();
        op.onchange(callback);
        op.selected = true;
        op.updateFrom(data('a', 'Alpha', false));
        expect(callback).not.toHaveBeenCalled();
    });

    test('can have several callbacks', () => {
        const op = new FalseOption(data());
        inForm(op);
        const first = vi.fn(), second = vi.fn();
        op.onchange(first);
        op.onchange(second);
        op.input.click();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    test('is called when a checkbox is unchecked too', () => {
        const op = new FalseOption(data('a', 'Alpha', true));
        op.multiple = true;
        inForm(op);
        const callback = vi.fn();
        op.onchange(callback);
        op.input.click();
        expect(op.selected).toBe(false);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});

describe('FalseOption - browser interaction', () => {
    test('radio buttons with the same name exclude each other; with different names they do not', () => {
        const a = new FalseOption(data('a')), b = new FalseOption(data('b')), c = new FalseOption(data('c'));
        inForm(a, b, c);
        a.name = 'one'; b.name = 'one'; c.name = 'two';
        a.input.click(); c.input.click(); b.input.click();
        expect([a.selected, b.selected, c.selected]).toEqual([false, true, true]);
    });

    test('radio buttons without a name do not exclude each other', () => {
        const a = new FalseOption(data('a')), b = new FalseOption(data('b'));
        inForm(a, b);
        a.input.click(); b.input.click();
        expect([a.selected, b.selected]).toEqual([true, true]);
    });

    test('is submitted under its name, with its value, only when selected', () => {
        const a = new FalseOption(data('a')), b = new FalseOption(data('b', 'Beta', true));
        const form = inForm(a, b);
        a.name = 'x'; b.name = 'x';
        expect(entries(form)).toEqual([['x', 'b']]);
        a.input.click();
        expect(entries(form)).toEqual([['x', 'a']]);
    });

    test('is not submitted without a name', () => {
        const a = new FalseOption(data('a', 'Alpha', true));
        const form = inForm(a);
        expect(entries(form)).toEqual([]);
    });

    test('is not submitted when disabled', () => {
        const a = new FalseOption(data('a', 'Alpha', true));
        const form = inForm(a);
        a.name = 'x';
        a.disabled = true;
        expect(entries(form)).toEqual([]);
    });

    test('with an empty `form`, it belongs to no form at all: not submitted, not validated', () => {
        const a = new FalseOption(data('a', 'Alpha', true));
        const form = inForm(a);
        a.name = 'x';
        a.required = true;
        a.selected = false;
        expect(form.checkValidity()).toBe(false);
        a.form = '';
        expect(a.input.form).toBeNull();
        expect(form.checkValidity()).toBe(true);
        a.selected = true;
        expect(entries(form)).toEqual([]);
    });

    test('with a `form`, it belongs to that form; with null again, to the ancestor one', () => {
        const a = new FalseOption(data('a', 'Alpha', true));
        const form = inForm(a);
        a.name = 'x';
        const other = document.createElement('form');
        other.id = 'other';
        document.body.append(other);

        a.form = 'other';
        expect(entries(form)).toEqual([]);
        expect(entries(other)).toEqual([['x', 'a']]);

        a.form = null;
        expect(entries(form)).toEqual([['x', 'a']]);
        expect(a.input.hasAttribute('form')).toBe(false);
    });
});

describe('FalseOption - focus', () => {
    test('brings focus to the input', () => {
        const a = new FalseOption(data('a', 'Alpha', true));
        document.body.append(a.el);
        expect(document.activeElement).not.toBe(a.input);
        a.focus();
        expect(document.activeElement).toBe(a.input);
    });

    test('isFocused returns true when input is focused, false otherwise', () => {
        const a = new FalseOption(data('a', 'Alpha', true));
        document.body.append(a.el);
        expect(a.isFocused).toBe(false);

        a.input.focus();
        expect(a.isFocused).toBe(true);

        document.body.append(a.el);
        a.el.querySelector('label')!.focus();
        expect(a.isFocused).toBe(false);

        document.body.append(a.el);
        a.el.focus();
        expect(a.isFocused).toBe(false);

        document.body.append(a.el);
        a.focus();
        expect(a.isFocused).toBe(true);
    })
})