import type { Brand } from "../../../../shared/general-types.js";
import { Expandable } from "../../mixins/add_behaviour/expandable.mixin.js";
import { Popover } from "../../mixins/add_behaviour/popover.mixin.js";
import { FalseOption, type OptionData } from "./false-option.js";
import type { label } from "./false-select.js";
export type value = Brand<string, 'value'>;

const MISSING_MESSAGE = 'Select at least one option.';
const HANDLED_KEYS = ['ArrowUp','ArrowDown', 'Enter', 'Tab'] as const;

function _isHandledKey(key: string): key is (typeof HANDLED_KEYS)[number] {
    return (HANDLED_KEYS).includes(key as any);
}
/**
 * The list of options of a {@link FalseSelect}, as a popover.
 *
 * @remarks
 * - **Events**: `input` then `change` are fired only for changes made by the user, once each;
 * the native events of the options are taken by the dropdown and never seen by anybody. Nothing is fired for
 * programmatic changes (`setOptions`, `setChecked`, `setMultiple`, ...), as with native controls.
 * - A single selection uses radio buttons, which the browser keeps exclusive by their `name`;
 * a dropdown without a name uses a private one, and is kept out of any form (never submitted).
 * - Moving from multiple to single keeps the last selected option, as a native `<select>` does.
 */
export class FalseSelectDropdown extends Popover(Expandable(HTMLElement)) {
    static #nextGroup = 0;
    /** Names the radios of a dropdown that has no name, so that they stay exclusive. */
    readonly #groupName = `false-select-group-${FalseSelectDropdown.#nextGroup++}`;

    #options = new Map<value, FalseOption>();
    readonly #opUl: HTMLUListElement;

    #name = '';
    #multiple = false;
    #required = false;
    #disabled = false;

    constructor() {
        super();

        const ul = this.#opUl = document.createElement('ul');
        ul.setAttribute('role', 'group');
        ul.setAttribute('aria-label', 'List of selectable options for wrapping element');

        // In the capture phase, so that nobody (listeners of the dropdown itself included)
        // sees the native events of the options: the dropdown tells of the change on its own.
        this.addEventListener('input', this.#takeNative, true);
        this.addEventListener('change', this.#takeNative, true);
    }

    /**
     * The native `input` and `change` of an option are stopped here, 
     * before reaching any element outside the dropdown.
     * 
     * Events dispatched by the dropdown otself are let through.
     * 
     * 'Change' events from the options are stopped and dispatched
     * again by the dropdown as its own events. 
     */
    readonly #takeNative = (e: Event) => {
        if (e.target === this) return;
        e.stopImmediatePropagation();
        if (e.type === 'change')
            this.#onOptionChange();
    };

    /** The options, in the order they are shown. */
    get options() { return Array.from(this.#options.values()); }

    get name() { return this.#name; }
    set name(name: string) {
        if (this.#name === name) return;
        this.#name = name;
        this.#options.forEach(op => this.#identify(op));
    }

    /** Names an option for the form (or for its radio group, if the dropdown has no name). */
    #identify(op: FalseOption) {
        op.name = this.#name || this.#groupName;
        op.form = this.#name ? null : '';
    }

    /**
     * Allows to set the 'multiple' attribute of the internal options.
     * 
     * If moving from `true` to `false` and more than 1 options
     * are selected, only the last selected one will be kept.
     * 
     * Element's validity state is updated afterwards.
     */
    setMultiple(multiple: boolean) {
        if (this.#multiple === multiple) return;
        // Reduce values when moving from multiple to single. Done before the types change,
        // so that the result never depends on how the browser groups radios.
        if (!multiple) this.#keepLastSelected();
        this.#multiple = multiple;
        this.#options.forEach(o => o.multiple = multiple);
        this.#updateValidity();
    }

    /** Sets the 'required' property on the dropdown
     * and updates validity.
     */
    setRequired(required: boolean) {
        if (this.#required === required) return;
        this.#required = required;
        this.#updateValidity();
    }

    /**
     * Sets 'disabled' attribute on each internal input.
     * 
     * Closes itself if disabled.
     */
    setDisabled(disabled: boolean) {
        if (this.#disabled === disabled) return;
        this.#disabled = disabled;
        this.#options.forEach(o => o.disabled = disabled);
        if (disabled) this.close();
    }

    /** Leaves only the last selected option selected, 
     *  mimics a native `<select>` without `multiple`. */
    #keepLastSelected() {
        for (
            const op of this.options
                .filter(o => o.selected)
                .slice(0, -1) // leaves the last one of the selected
        ) op.selected = false; // deselects all the others
    }

    /**
     * Makes the options exactly as the given ones, in the given order: 
     * - options that are already there are updated in place, 
     * - absent options are removed, 
     * - any new option is built.
     * 
     * @remarks
     * An option is told from another by its value; 
     * repeated values keep the last one.
     */
    setOptions(options: OptionData[]) {
        const ul = this.#opUl;
        ul.remove(); // detached while it is rebuilt

        const next = new Map<value, FalseOption>();
        for (const data of new Map(options.map(o => [o.value, o] as const)).values()) {
            const known = this.#options.get(data.value as value);
            if (known) known.updateFrom(data);
            const op = known ?? this.#buildOption(data);
            next.set(op.value, op);
            ul.appendChild(op.el);
            // appending moves one already there: 
            // the DOM follows the given order
        }
        for (const [val, op] of this.#options)
            if (!next.has(val)) op.el.remove();
        this.#options = next;

        if (!this.#multiple) this.#keepLastSelected();
        this.#updateValidity();
        this.appendChild(ul);
    }

    /** 
     * Creates a new option from raw data and sets 
     * properties that need to be shared 
     * between dropdown and option 
     */
    #buildOption(data: OptionData): FalseOption {
        const option = new FalseOption(data);

        option.multiple = this.#multiple;
        this.#identify(option);
        option.disabled = this.#disabled;

        return option;
    }

    /** 
     * The user changed an option:
     * - options validity is updated,
     * - a new 'input' event fires from the dropdown,
     * - a new 'change' event fires from the dropdown.
     */
    #onOptionChange() {
        this.#updateValidity();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * @returns the array containing all the values of selected options.
     */
    checkedValues(): value[] {
        return this.options
            .filter(o => o.selected)
            .map(o => o.value);
    }
    /**
     * @returns the array containing all the labels of selected options.
     */
    checkedLabels(): label[] {
        return this.options
            .filter(o => o.selected)
            .map(o => o.label);
    }

    /**
     * Selects exactly the given values.   
     * Values that are not options are ignored,
     * (like a native `<select>` does);   
     * a single selection keeps the last one.
     * 
     * Validity is updated after change.
     */
    setChecked(checked: value[]) {
        const checkedSet = new Set(checked);
        for (const [val, op] of this.#options)
            op.selected = checkedSet.has(val);
        if (!this.#multiple) this.#keepLastSelected();
        this.#updateValidity();
    }

    // VALIDITY ======================================

    /** The form control that carries the 
     *  validity of the whole selection; 
     *  `null` if there are no options. */
    get validityControl(): HTMLInputElement | null {
        return this.options[0]?.input ?? null;
    }

    /** Recomputes the validity: 
     *  to call when the selection changed 
     *  without the user doing it (e.g. a form reset). */
    revalidate() {
        this.#updateValidity();
    }

    /**
     * Sets validity on the first internal option's input 
     * declaring whether the `required` attribute is respected;
     * behavior differs depending on the value of the `multiple` attribute:
     * 
     * - multiple=`false`: if `required` is set, at least one radio must be selected;
     * 'required' is propagated to all the options; 
     * the browser natively only asks for one in the group to be checked,
     * so no custom validity control is required.
     * - multiple=`true`: if `required` is set, at least one checkbox must be selected
     * (more than one are also accepted);
     * the first option (input) has a custom validity set
     * when the condition is not respected.
     * 
     * a group of checkboxes has no native "at least one", so the first
     * option carries a custom message while nothing is selected.
     */
    #updateValidity() {
        const options = this.options;
        const missing = this.#required && !options.some(o => o.selected);
        options.forEach((op, i) => {
            op.required = this.#required && !this.#multiple;
            // Only meaningful for checkboxes; leverages radio's native behavior otherwise
            op.setCustomValidity(this.#multiple && missing && i === 0 ? MISSING_MESSAGE : '');
        });
    }

    //// TO TEST

    // ARROW BEHAVIOUR ========================================

    /**
     * Handles keyboard events while the dropdown is open and an option is focused:
     * - `Arrow Up`/`Down`: moves focus to previous/next option in the list if available;
     * does not loop around the list (like native '<select>').
     * - `Tab`: closes the dropdown; focus is returned to 
     * the last focused element outside the dropdown (handled by Popover interface).
     * - 'Enter': toggles the currently active option and closes dropdown.
     * The form is not sent.
     */
    #handleKeydown = (e: KeyboardEvent) => {
        // Safeguard
        if (!this.open) return;
        const { key } = e;
        // Ignore keys not handled by this function
        if(!_isHandledKey(key)) return;
        // Check if focus is within an option; exit otherwise
        const options = this.options;
        const focused = options.find(op => op.isFocused);
        if (!focused) return;

        // prevent default once all conditions are met
        e.preventDefault();
        switch (key) {
            case 'ArrowUp': {
                const toFocus = focused.el.previousElementSibling;
                if (!toFocus) return;
                options.find(o => o.owns(toFocus))?.focus({focusVisible: false});
                break;
            }
            case 'ArrowDown': {
                const toFocus = focused.el.nextElementSibling;
                if (!toFocus) return;
                options.find(o => o.owns(toFocus))?.focus({focusVisible: false});
                break;
            }
            case 'Tab': {
                this.close();
                break;
            }
            case 'Enter': {
                if(focused.multiple) 
                    focused.selected = !focused.selected;
                else focused.selected = true;
                this.#onOptionChange();
                this.close();
                break;
            }
        }
    }

    override _onExpandableOpen(): void {
        super._onExpandableOpen();
        const f = this.#opUl.firstElementChild;
        if (f) this.options.find(o => o.owns(f))?.focus();
    }
    override _onExpandableTransitionEnd(): void {
        super._onExpandableTransitionEnd?.();
        if (this.open)
            document.addEventListener('keydown', this.#handleKeydown);
        else
            document.removeEventListener('keydown', this.#handleKeydown);
    }
}
