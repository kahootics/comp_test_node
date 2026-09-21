import { IllegalAccessError } from "../../../../../errors/common-errors.mjs";
import type { value, label } from "./false-select.js";


export class FalseOption {
    readonly #li: HTMLLIElement;
    readonly #label: HTMLLabelElement;
    readonly #input: HTMLInputElement;

    get el() { return this.#li; }

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

    updateFrom(up: { value: string; label: string; selected: boolean; }) {
        if (!(up.value === this.value))
            throw new IllegalAccessError(`Cannot update option with a different value; expected ${this.value}, but found ${up.value}`);
        this.#label.textContent = up.label;
        this.selected = up.selected;
    }

    constructor(op: { value: string; label: string; selected: boolean; }) {
        const li = this.#li = document.createElement('li');
        const label = this.#label = document.createElement('label');
        const input = this.#input = document.createElement('input');

        input.value = op.value;
        input.checked = op.selected;

        label.append(input, op.label);
        li.appendChild(label);
    }
}
