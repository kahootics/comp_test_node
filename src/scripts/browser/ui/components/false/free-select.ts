import { IllegalStateError } from "../../../../../errors/common-errors.mjs";
import { CUSTOM_TAGS } from "../../../../shared/custom-components-tags.js";
import type { Popover } from "../../mixins/add_behaviour/popover.mixin.js";
import { FalseSelect, type value } from "./false-select.js";


const SELECTED_LABEL = 'Click to remove from selection';

/**
 * A component that allows users to add new items to a list from a select or input
 */
export class ListSelector extends HTMLElement {

    /** A list of buttons of selected values. */
    readonly #selectedMap = new Map<value, HTMLButtonElement>();

    /** A button to add new selected items to the list. */
    readonly #addButton: HTMLButtonElement;

    readonly #selectionInterface: Popover;

    #nullableSelectionInput: HTMLInputElement | HTMLSelectElement | FalseSelect | null = null;

    get #selectionInput(): HTMLInputElement | HTMLSelectElement | FalseSelect {
        const s = this.#nullableSelectionInput;
        if (s) return s;
        throw new Error(); // towrite
    }

    readonly #saveButton: HTMLButtonElement;
    readonly #cancelButton: HTMLButtonElement;

    public constructor() {
        super();
        const addButton = this.#addButton = document.createElement('button');
        addButton.ariaLabel = 'Click to add new item';

        const selectionInterface = this.#selectionInterface = document.createElement(CUSTOM_TAGS.falsePopover);

        const saveButton = this.#saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.type = 'button';

        const cancelButton = this.#cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel'
        saveButton.type = 'button';

        this.tabIndex = 0;
        this.setAttribute('role', 'button');
    }

    public connectedCallback(): void {
        this.appendChild(this.#addButton);
        this.#initSelected();
        this.#initSelectionInput();
        const selectionInterface = this.#selectionInterface;
        selectionInterface.addController(this.#addButton, { addListener: true });

        const save = this.#saveButton;
        save.addEventListener('click', this.#onSave);
        const cancel = this.#cancelButton
        cancel.addEventListener('click', this.#onCancel);
        // listen to sInterface close to send onCancel

        selectionInterface.append(save, cancel);
    }

    public disconnectedCallback(): void {
        this.#saveButton.removeEventListener('click', this.#onSave);
        this.#cancelButton.removeEventListener('click', this.#onCancel);
        // stop listening to sInterface close 
    }

    public attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'type' && newValue !== oldValue) {
            this.type = this.type; // defaults to 'text'
        }
    }

    #initSelectionInput() {
        let input: HTMLInputElement | HTMLSelectElement | FalseSelect;
        switch (this.type) {
            case 'select': {
                input = document.createElement('select');
                // Options?? 
                break;
            }
            case 'false-select': {
                input = document.createElement('false-select');
                // Options?? 
                break;
            }
            case 'text': {
                input = document.createElement('input');
                input.type = 'text';
                break;
            }
            default: // defensive (cannot trigger)
                throw new IllegalStateError('') // to write
        }
        if (this.#nullableSelectionInput) {
            this.#nullableSelectionInput.remove();
        }
        this.#nullableSelectionInput = input;
        this.#selectionInterface.insertBefore(input, this.#saveButton);
    }

    public get type(): 'text' | 'select' | 'false-select' {
        const type = this.getAttribute('type');
        switch (type) {
            case 'text': case 'select': case 'false-select':
                return type;
            default:
                this.type = 'text';
                return 'text'
        }
    }
    public set type(type: 'text' | 'select' | 'false-select') {
        const old = this.getAttribute('type');
        if (old === type) return;
        this.setAttribute('type', type);
        // Type changed, input must change accordingly
        this.#initSelectionInput();
    }

    public get value(): value[] {
        return Array.from(this.#selectedMap.keys());
    }
    public set value(value: string[]) {
        const selectedMap = this.#selectedMap;
        const valueSet = new Set(value);

        for (const value of selectedMap.keys()) {
            // Value is already set, remove from queue
            if (valueSet.delete(value)) continue;
            // We don't have the value, must be removed
            this.#removeSelected(value)
        }

        // What remains in valueSet are new values to add
        valueSet.forEach(this.#addSelected);
    }

    #removeSelected(value: value): boolean {
        const selected = this.#selectedMap.get(value);
        if (!selected) return false;
        try {
            this.removeChild(selected);
            return true;
        } catch (e: unknown) {
            // Purely defensive check
            if (e instanceof DOMException) {
                throw new IllegalStateError(`Button with name ${selected.name
                    } is marked as selected, but is not a child of selector ${this.id}`);
            } throw e;
        }
    }

    #addSelected = (value: string): boolean => {
        const selectedMap = this.#selectedMap;
        if (this.#selectedMap.has(value as value)) return false;

        const sel = document.createElement('button');
        sel.value = sel.name = value;
        sel.type = 'button';
        sel.ariaLabel = SELECTED_LABEL;
        requestAnimationFrame(() => this.insertBefore(sel, this.#addButton));
        selectedMap.set(value as value, sel);
        return true;
    }

    #initSelected() {
        const selectedMap = this.#selectedMap;
        selectedMap.clear();
        this.querySelectorAll('button').forEach(b => {
            const { value } = b;
            if (value) {
                b.name = value;
                b.type = 'button';
                b.ariaLabel = SELECTED_LABEL;
                selectedMap.set(value as value, b);
            } else if (!(b === this.#addButton)) b.remove();
        })
    }

    #onCancel = () => {
        this.#selectionInterface.close();
        // Should reset input inside * 
        this.#selectionInput.value = '';
    }

    #onSave = () => {
        const { value } = this.#selectionInput; 
        // False select can have array as value
        const selected = Array.isArray(value) ? value : [value];
        selected.forEach(this.#addSelected);
        this.#selectionInterface.close();
    }
}

// Probably should listen for child mutations to reinit in case a selected is added/removed manually