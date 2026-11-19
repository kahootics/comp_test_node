import type { Brand } from "../../../../shared/general-types.js";
import { FalseSelectDropdown, type value } from "./false-select-dropdown.js";

// Types

export type label = Brand<string, 'label'>;

/**
 * Custom HTML element that aims to implement an input-like interface
 * to use as a select substitute; includes multiple selection while
 * also bypassing the multi-value problem by making it the standard.
 *
 * This is not a polyfill of the select element, but rather a
 * css customizable alternative.
 *
 * ```html
 * <false-select name="color" multiple>
 *   <option value="r" selected>Red</option>
 *   <option value="g">Green</option>
 * </false-select>
 * ```
 *
 * @remarks
 * - `FalseSelectDropdown` must be defined before this element.
 * - **Form.** Options are radio buttons or checkboxes (see {@link FalseOption}), so the browser submits
 * the selected ones under the select's `name` (repeated entries for a multiple selection), excludes
 * them inside a disabled `<fieldset>` and resets them with the form. Without a `name` the select
 * works but is not part of the form: nothing is submitted, and a form reset does not touch it.
 * - **Events.** `input` then `change` are fired, from this element, once each for a change made by
 * the user; never for programmatic ones (`value`, attributes, options). The native events of the
 * options never leave.
 * - **Options** are the `<option>` children, taken (and removed) whenever they appear; 
 * a `FalseOption` with the value of the removed option replaces it.
 * - **Validity.** `required` asks for a selection (one option, or at least one with `multiple`).
 * Reporting a missing one opens the dropdown, so that the browser has something to point at.
 * With no options at all, nothing can be missing.
 * - Not supported: `form`, `optgroup` and per-option `disabled`.
 */
export class FalseSelect extends HTMLElement {

    public get required(): boolean { return this.hasAttribute('required'); }
    public set required(v: boolean) { this.toggleAttribute('required', v); }

    public get multiple(): boolean { return this.hasAttribute('multiple'); }
    public set multiple(v: boolean) { this.toggleAttribute('multiple', v); }

    public get disabled(): boolean { return this.hasAttribute('disabled'); }
    public set disabled(v: boolean) { this.toggleAttribute('disabled', v); }

    readonly #dropdown = new FalseSelectDropdown(); // created closed by default
    readonly #valuesDisplay = document.createElement('span');

    /** The children (and attributes) are added when connected: a constructor must not add any. */
    #built = false;
    /** The `tabindex` is ours to manage only if the author did not set one. */
    #ownTabindex = false;
    #boundForm: HTMLFormElement | null = null;
    #fallbackControl: HTMLInputElement | undefined;

    /** Takes the `<option>` children whenever they appear (they may come after the element is connected). */
    readonly #observer = new MutationObserver(() => this.#hydrateFromLightDom());

    constructor() {
        super();
        this.addEventListener('keydown', this.#onKeydown);
        this.addEventListener('click', this.#guardClick, true);
        this.addEventListener('input', this.#onDropdownEvent, true);
        this.addEventListener('change', this.#onDropdownEvent, true);
        this.addEventListener('invalid', this.#onInvalid, true);
        this.#observer.observe(this, { childList: true });
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
        this.#refreshDisplay();
    }

    /** The form the select sits in. */
    get form(): HTMLFormElement | null { return this.closest('form'); }

    // The validity of the selection is the one of the first option's control.
    get #control(): HTMLInputElement {
        return this.#dropdown.validityControl ?? (this.#fallbackControl ??= document.createElement('input'));
    }
    get willValidate(): boolean { return this.#dropdown.validityControl?.willValidate ?? false; }
    get validity(): ValidityState { return this.#control.validity; }
    get validationMessage(): string { return this.#control.validationMessage; }
    checkValidity(): boolean { return this.#control.checkValidity(); }
    reportValidity(): boolean { return this.#control.reportValidity(); }

    // DISPLAY ======================================

    /** Shows the labels of the selected options. */
    #refreshDisplay() {
        this.#valuesDisplay.textContent = this.#dropdown.checkedLabels().join(', ');
    }

    // EVENTS ======================================

    #emitChange() {
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * The dropdown tells of the user's changes with its own `input` and `change`,
     * whose target would be the dropdown: they are taken here (in the capture phase,
     * before anybody else) and told again, once, from this element.
     */
    readonly #onDropdownEvent = (e: Event) => {
        if (e.target !== this.#dropdown) return;
        e.stopImmediatePropagation();
        if (e.type !== 'change') return;
        this.#refreshDisplay();
        this.#emitChange();
    };

    // KEYBOARD AND MOUSE ======================================

    #onKeydown = (e: KeyboardEvent) => {
        // only the key presses made on the select itself, not on the options inside it
        if (e.target !== this || this.disabled || this.#dropdown.open) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.#dropdown.show();
        }
    };

    /** A disabled select does not open: the click never gets to the popover's controller. */
    readonly #guardClick = (e: Event) => {
        if (this.disabled) e.stopImmediatePropagation();
    };

    // VALIDITY ======================================

    /** A control that is not shown cannot be pointed at by the browser: opening the dropdown makes it possible. */
    readonly #onInvalid = (e: Event) => {
        if (e.target instanceof Node && this.#dropdown.contains(e.target) && !this.#dropdown.open)
            this.#dropdown.show();
    };

    // FORM RESET ======================================

    /** Follows the `reset` event of the form the select sits in. */
    #bindForm() {
        const form = this.closest('form');
        if (form === this.#boundForm) return;
        this.#boundForm?.removeEventListener('reset', this.#onFormReset);
        this.#boundForm = form;
        form?.addEventListener('reset', this.#onFormReset);
    }

    /**
     * `reset` is fired *before* the options are reset, and resetting fires no `change`:
     * after it, the display and the validity are brought up to date. A microtask would not do
     * (for a reset started by the user it would run before the browser resets the options),
     * so the work waits for a task.
     */
    readonly #onFormReset = () => {
        setTimeout(() => {
            this.#dropdown.revalidate();
            this.#refreshDisplay();
        }, 0);
    };

    // LIFECYCLE ======================================

    connectedCallback() {
        if (!this.#built) {
            this.#built = true;
            this.append(this.#valuesDisplay, this.#dropdown);
        }
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
        if (!this.hasAttribute('tabindex')) {
            this.#ownTabindex = true;
            this.tabIndex = 0;
        }

        this.#applyAttributes();
        this.#hydrateFromLightDom();
        this.#refreshDisplay(); // to init value displayer
        this.#dropdown.addController(this, { toggleOnClick: true });
        this.#bindForm();
    }

    disconnectedCallback() {
        this.#boundForm?.removeEventListener('reset', this.#onFormReset);
        this.#boundForm = null;
    }

    /**
     * Takes every `<option>` child, whenever it appears, and makes it an option of the dropdown
     * (the ones already there stay), removing the original.
     */
    #hydrateFromLightDom() {
        const ogOptions = Array.from(this.querySelectorAll('option'));
        if (ogOptions.length === 0) return; // also guards against disconnect - > reconnect that would wipe options
        const dropdown = this.#dropdown;
        const current = dropdown.options.map(o => ({ value: o.value as string, label: o.label as string, selected: o.selected }));
        const incoming = ogOptions.map(opt => ({
            value: opt.value,
            label: opt.label,
            selected: opt.selected,
        }));
        dropdown.setOptions([...current, ...incoming]);

        ogOptions.forEach(o => o.remove());
        this.#refreshDisplay();
    }

    // ATTRIBUTES ======================================

    /** Element's observed attributes. */
    static get observedAttributes(): string[] {
        return ['name', 'multiple', 'required', 'disabled'];
    }

    #applyAttributes() {
        const dropdown = this.#dropdown;
        dropdown.name = this.name;
        dropdown.setMultiple(this.multiple);
        dropdown.setRequired(this.required);
        this.#applyDisabled();
    }

    #applyDisabled() {
        const disabled = this.disabled;
        this.#dropdown.setDisabled(disabled);
        if (disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
        if (this.#ownTabindex) this.tabIndex = disabled ? -1 : 0;
    }

    attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null): void {
        switch (name) {
            case 'name':
                this.#dropdown.name = this.name;
                break;
            case 'multiple':
                this.#dropdown.setMultiple(this.multiple);
                this.#refreshDisplay(); // going to single may have unselected some
                break;
            case 'required':
                this.#dropdown.setRequired(this.required);
                break;
            case 'disabled':
                this.#applyDisabled();
                break;
        }
    }
}