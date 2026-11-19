import { IllegalAccessError } from "../../../../../errors/common-errors.mjs";
import type { label } from "./false-select.js";
import type { value } from "./false-select-dropdown.js";

/** What it takes to describe an option. */
export interface OptionData {
    value: string;
    label: string;
    selected: boolean;
}

/**
 * One option of a {@link FalseSelectDropdown}: 
 * - a radio button (single selection)
 * - or a checkbox (multiple selection) 
 * input are placed inside its own list element.
 *
 * ```html
 * <li>
 *   <label>
 *     <input type="radio" value="a">
 *     <span>Alpha</span>
 *   </label>
 * </li>
 * ```
 *
 * The browser does the work of a form control here: submitting the selected
 * ones, grouping radios, resetting.
 */
export class FalseOption implements OptionData {
    readonly #li: HTMLLIElement;
    readonly #label: HTMLLabelElement;
    readonly #input: HTMLInputElement;
    /** Holds the label's text: setting the text of the `<label>` itself would delete the input. */
    readonly #text: HTMLSpanElement;

    /** External list element that wraps the entire option's structure. */
    get el() { return this.#li; }
    /** The form control of the option (also the one that carries its validity). */
    get input() { return this.#input; }

    /** 
     * Determines whether options can be multi-selected.
     * - `true` means the inputs will be checkboxes,
     * - `false` means the inputs will be radios.
     */
    set multiple(multiple: boolean) {
        this.#input.type = multiple ? 'checkbox' : 'radio';
    }
    /** Reflects the `name` attribute and property on the internal input. */
    set name(name: string) {
        this.#input.name = name;
    }
    get name() {
        return this.#input.name;
    }

    /** Id of the form the option belongs to; `''` for none at all (never submitted); `null` for the ancestor form. */
    set form(form: string | null) {
        if (form === null) this.#input.removeAttribute('form');
        else this.#input.setAttribute('form', form);
    }

    set disabled(disabled: boolean) { this.#input.disabled = disabled; }
    set required(required: boolean) { this.#input.required = required; }
    setCustomValidity(message: string) { this.#input.setCustomValidity(message); }

    get selected() { return this.#input.checked; }
    set selected(selected: boolean) { this.#input.checked = selected; }
    get value() { return this.#input.value as value; }
    get label() { return this.#text.textContent as label; }

    /** Adds a listener for 'change events on the 
     *  input that will call the provided callback. */
    onchange(callback: (e: Event) => void) {
        this.#input.addEventListener('change', callback);
    }

    /**
     * Takes raw data to update the label and state of the concrete element.
     * 
     * @param up - Raw data of the option that will be used to update the concrete instance.
     * 
     * @throws {IllegalAccessError} If the raw option and the concrete instance have different values.
     */
    updateFrom(up: OptionData) {
        if (!(up.value === this.value))
            throw new IllegalAccessError(`Cannot update option with a different value; expected ${this.value}, but found ${up.value}`);
        this.#text.textContent = up.label;
        this.selected = up.selected;
    }

    constructor(op: OptionData) {
        const li = this.#li = document.createElement('li');
        const label = this.#label = document.createElement('label');
        const input = this.#input = document.createElement('input');
        const text = this.#text = document.createElement('span');

        // A valid type from the start; the dropdown sets the real one.
        input.type = 'radio';
        input.value = op.value;
        // The `checked` attribute is the default 
        // a form reset goes back to (like `<option selected>`);
        // the property is what is selected now.
        input.defaultChecked = op.selected;
        input.checked = op.selected;
        text.textContent = op.label;

        label.append(input, text);
        li.appendChild(label);
    }

    // To Test

    /** @returns `true` if the currently active element is the input within the option. */
    get isFocused(): boolean {
        const focus = document.activeElement;
        return this.#input.contains(focus);
    }
    /** Interface to the internal input's own `focus` method. */
    focus(options?: FocusOptions): void {
        return this.#input.focus(options);
    }
    /**
     * @param el - Any element that needs its ownership to be determined.
     * @returns a boolean value indicating whether the element is one of the option's inner fields (input,label,li or span).
     */
    owns(el: Element): boolean {
        return el === this.#input 
            || el === this.#label
            || el === this.#li
            || el === this.#text;
    }
}