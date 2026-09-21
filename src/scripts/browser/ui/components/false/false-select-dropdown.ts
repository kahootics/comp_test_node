import { Expandable, expandableCloseTransition,expandableOnTransitionEnd,expandableOpenTransition } from "../../mixins/add_behaviour/expandable.mixin.js";
import { Popover } from "../../mixins/add_behaviour/popover.mixin.js";
import { ExtendibleElement } from "../extendible-element.js";
import type { value } from "./false-select.js";
import { FalseOption } from "./false-option.js";

export class FalseSelectDropdown extends Popover(Expandable(ExtendibleElement, 'open', 'is-open')) {
    #options: Map<value, FalseOption>;
    #opUl: HTMLUListElement;

    constructor() {
        super();

        this.#options = new Map();
        const ul = this.#opUl = document.createElement('ul');
        ul.setAttribute('role', 'group');
        ul.setAttribute('aria-label', 'List of selectable options for wrapping element');
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
                    } else first = o;
                }
            });
            if (changed) this.#onOptionChange();
        }

    }

    setOptions(options: { value: string; label: string; selected: boolean; }[]) {
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
        });
        // Re-attach list
        this.appendChild(this.#opUl);

    }

    #buildOption(op: { value: string; label: string; selected: boolean; }) {
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
        const checkedSet = new Set(checked); 
        // what if it includes options not present?
        for (const [label, op] of this.#options.entries()) {
            op.selected = checkedSet.has(label);
        }
    }
}
