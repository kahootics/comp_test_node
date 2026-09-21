
import type { Brand } from "../../../../shared/general-types.js";
import { FalseSelectDropdown } from "./false-select-dropdown.js";
import { CUSTOM_TAGS } from "../../../../shared/custom-components-tags.js";

// Types

export type label = Brand<string, 'label'>;
export type value = Brand<string, 'value'>;

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
        this.#dropdown = document.createElement(CUSTOM_TAGS.falseSelectDropdown); // created closed by default
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
        dropdown.addController(this, {addListener: true});
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
