
import { ExtendibleElement } from "../extendible-element.js";
import { Expandable } from "../../mixins/add_behaviour/expandable.mixin.js";
import { Popover } from "../../mixins/add_behaviour/popover.mixin.js";
import type { Brand } from "../../../../types/general-types.js";
import { IllegalAccessError } from "../../../../../errors/common-errors.mjs";

// Types

type label = Brand<string, 'label'>;
type value = Brand<string, 'value'>;

class FalseOption {
    readonly #li: HTMLLIElement;
    readonly #label: HTMLLabelElement;
    readonly #input: HTMLInputElement;

    get el() { return this.#li }

    set multiple(multiple: boolean) {
        this.#input.type = multiple ? 'checkbox' : 'radio';
    }

    set name(name: string) {
        this.#input.name = name;
    }
    get name() {
        return this.#input.name;
    }

    get selected() { return this.#input.checked; }
    set selected(selected: boolean) { this.#input.checked = selected; }
    get value() { return this.#input.value as value; }
    get label() { return this.#label.textContent as label; }

    onchange(callback: (e: Event) => void) {
        this.#input.addEventListener('change', callback);
    }

    updateFrom(up: { value: string, label: string, selected: boolean }) {
        if (!(up.value === this.value))
            throw new IllegalAccessError(`Cannot update option with a different value; expected ${this.value}, but found ${up.value}`)
        this.#label.textContent = up.label;
        this.selected = up.selected;
    }

    constructor(op: { value: string, label: string, selected: boolean }) {
        const li = this.#li = document.createElement('li');
        const label = this.#label = document.createElement('label');
        const input = this.#input = document.createElement('input');

        input.value = op.value;
        input.checked = op.selected;

        label.append(input, op.label);
        li.appendChild(label);
    }
}

class FalseSelectDropdown extends Popover(Expandable(ExtendibleElement, 'open', 'false-select-open')) {
    #options: Map<value, FalseOption>;
    #opUl: HTMLUListElement;

    constructor() {
        super();

        this.#options = new Map();
        const ul = this.#opUl = document.createElement('ul');
        ul.setAttribute('role', 'group');
        ul.setAttribute('aria-label','List of selectable options for wrapping element');
    }

    get options() { return Array.from(this.#options.values()); }

    #name: string = '';
    get name() { return this.#name; }
    set name(name: string) {
        if (this.name === name) return;
        this.name = name;
        this.#options.forEach(op => op.name = name);
    }

    #multiple: boolean = false;
    setMultiple(multiple: boolean) {
        if (this.#multiple === multiple) return;
        this.#multiple = multiple;
        this.#options.forEach(o => o.multiple = multiple);
        // Reduce values when moving from multiple to single
        if (!multiple) {
            let first: FalseOption | undefined;
            let changed = false;
            this.#options.forEach(o => {
                if (o.selected) {
                    if (first) {
                        o.selected = false;
                        changed = true;
                    } else first = o
                }
            });
            if (changed) this.#onOptionChange();
        }

    }

    setOptions(options: { value: string, label: string, selected: boolean }[]) {
        // Detach list
        this.#opUl.remove();
        const toAdd = new Map(options.map(o => [o.value, o]));

        // Update existing options and delete absent ones
        for (const [value, op] of this.#options.entries()) {
            const updated = toAdd.get(value);
            if (updated) {
                op.updateFrom(updated);
                toAdd.delete(value);
            } else {
                this.#options.delete(value);
                this.#opUl.removeChild(op.el);
            }
        }

        // Build and register all the new ones
        toAdd.forEach(option => {
            const op = this.#buildOption(option);
            this.#opUl.appendChild(op.el);
            this.#options.set(op.value, op);
        })
        // Re-attach list
        this.appendChild(this.#opUl);

    }

    #buildOption(op: { value: string, label: string, selected: boolean }) {
        const option = new FalseOption(op);

        option.multiple = this.#multiple;
        option.name = this.name;

        option.onchange(() => this.#onOptionChange());

        return option;
    }

    #onOptionChange() {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }
    checkedValues(): value[] {
        return this.options
            .filter(o => o.selected)
            .map(o => o.value);
    }
    setChecked(checked: value[]) {
        const checkedSet = new Set(checked); // what if it includes options not present
        for (const [label, op] of this.#options.entries()) {
            op.selected = checkedSet.has(label);
        }
    }
}

customElements.define('false-select-dropdown', FalseSelectDropdown);
/**
 * Custom HTML element that aims to implement an input-like interface
 * to use for a select, including multiple selection while
 * also bypassing the multi-value problem 
 * 
 * This is not a polyfill of the select element
 */
export class FalseSelect extends HTMLElement {

    public get multiple(): boolean {
        return this.hasAttribute('multiple');
    }
    public set multiple(multiple: boolean) {
        if (multiple) {
            this.setAttribute('multiple', '');
        } else {
            this.removeAttribute('multiple')
        }
    }

    readonly #dropdown: FalseSelectDropdown;
    readonly #valuesDisplay: HTMLSpanElement;

    constructor() {
        super();
        this.#dropdown = new FalseSelectDropdown(); // created closed by default
        this.#valuesDisplay = document.createElement('span');
        this.append(this.#valuesDisplay, this.#dropdown);
        this.tabIndex = 0;
        this.setAttribute('role', 'button');
    }

    public get name(): string {
        return this.getAttribute('name') ?? '';
    }
    public set name(name: string) {
        this.setAttribute('name', name);
    }

    get value(): string | string[] {
        return this.multiple
            ? this.#dropdown.checkedValues()
            : this.#dropdown.checkedValues()[0] ?? '';
    }
    set value(v: string | string[]) {
        this.#dropdown.setChecked((Array.isArray(v) ? v : [v]) as value[]);
    }

    #onKeydown = (e: KeyboardEvent) => {
    if (!this.#dropdown.isOpen && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); // evita lo scroll della pagina sullo Spazio
        this.#dropdown.show();
    }
};
    #onChange = () => {
        const state = this.value;
        if (Array.isArray(state)) {
            this.#valuesDisplay.textContent = state.join(', ');
        } else {
            this.#valuesDisplay.textContent = state;
        }
    }

    connectedCallback() {
        const dropdown = this.#dropdown;
        dropdown.name = this.name;
        dropdown.setMultiple(this.multiple);
        this.#hydrateFromLightDom();
        this.#onChange(); // to init value displayer
        dropdown.addController(this, true);
        this.addEventListener('keydown', this.#onKeydown);
        this.addEventListener('change', this.#onChange);
    }

    disconnectedCallback() {
        this.removeEventListener('keydown', this.#onKeydown);
        this.removeEventListener('change', this.#onChange);
    }

    #hydrateFromLightDom() {
        const ogOptions = this.querySelectorAll('option');
        if (ogOptions.length === 0) return; // also guards against disconnect - > reconnect that would wipe options
        const options = Array.from(ogOptions).map(opt => ({
            value: opt.value,
            label: opt.textContent ?? opt.value,
            selected: opt.selected,
        }));
        this.#dropdown.setOptions(options);

        ogOptions.forEach(o => o.remove());
    }

    /** Element's observed attributes. */
    static get observedAttributes(): string[] {
        return ['name', 'multiple'];
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name' && oldValue !== newValue) {
            this.#dropdown.name = this.name;

        } else if (name === 'multiple' && oldValue !== newValue) {
            this.#dropdown.setMultiple(this.multiple);

        }

    }
}
