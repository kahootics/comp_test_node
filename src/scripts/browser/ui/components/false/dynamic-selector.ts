import {
    addChip, chipBoxes, chipValue, deselectChip, isChip, neighborChip,
    reconcileChips, selectedValues, setSelection, decorateChip,
    type ChipOptions,
} from "./dynamic-chip.js";
import type { value } from "./false-select-dropdown.js";

/** Attributes forwarded verbatim to the internal text input. */
const DELEGATED_ATTRS = ['maxlength', 'placeholder', 'autocomplete', 'spellcheck'] as const;

/** Constraints a single entry can violate. */
type EntryFlag = 'tooShort' | 'tooLong' | 'patternMismatch';

/** User-facing messages, in one place so they can be replaced (e.g. for i18n). */
const MESSAGES = {
    blank: 'Enter a value to add.',
    duplicate: 'This value is already selected.',
    tooShort: 'This value is too short.',
    tooLong: 'This value is too long.',
    patternMismatch: 'This value does not match the required format.',
    valueMissing: 'Select at least one item.',
} as const;

/**
 * A form control that lets users build a list of free-text values, entered
 * through an inline text input and shown as removable chips.
 *
 * ```html
 * <dynamic-selector name="tags">
 *   <label>
 *     <input type="checkbox" value="a" checked>
 *     <span>a</span>
 *   </label>
 * </dynamic-selector>
 * ```
 *
 * @remarks
 * - Each chip is a direct child
 * `<label><input type="checkbox"><span>…</span></label>`; the selection is
 * the set of checked chips, and `value` is derived from them on every read.
 * The checkboxes carry the host's `name`, so the browser itself submits them
 * (repeated entries, as with any checkbox group), resets them and excludes
 * them inside a disabled `<fieldset>`: no `ElementInternals` involved.
 * How chips are read, created and removed lives in `./chips.ts`.
 *
 * - A mutation observer discards the ones without value or duplicated and keeps the rest
 * consistent. Chips with the `checked` attribute are the *defaults*, restored
 * by a form reset; the others are discarded by it.
 *
 * - Unchecking a chip (click, Space, Enter) removes
 * it. A default chip is hidden instead of deleted, so that a reset can bring
 * it back; at most as many chips as the markup declared linger this way.
 *
 * - The text input is part of the form but has no `name`, so it
 * is never submitted, and it carries the validity of the whole selection
 * through `setCustomValidity`, so that `form.checkValidity()` and the native
 * message bubble work. It gets no native constraints (`minlength`, `pattern`,
 * `required`): those are checked here, entry by entry.
 *
 * The `input` and `change` events are fired only for changes made by the
 * user (add, remove), never for programmatic ones, as with native controls.
 * The native events of the chips and of the draft input do not leak out.
 *
 * Values set through `value` or markup are never rejected for violating
 * `minlength`/`maxlength`/`pattern`: they are kept and reported through the
 * validity message (and `aria-invalid` on their chip). Only values typed in
 * by the user are refused.
 */
export class DynamicSelector extends HTMLElement {

    static get observedAttributes(): string[] {
        return [...DELEGATED_ATTRS, 'minlength', 'pattern', 'disabled', 'required', 'name', 'form'];
    }

    static #nextId = 0;

    // PRIVATE FIELDS ========================

    /** Row containing the draft input, the add button and the status message. */
    readonly #wrapper: HTMLDivElement;
    /** Triggers the addition of the value typed in the text input. */
    readonly #addButton: HTMLButtonElement;
    /** 'Draft' text input where a value is typed (and validated) before adding it. */
    readonly #input: HTMLInputElement;
    /** Live region where refused additions are reported. */
    readonly #status: HTMLDivElement;

    /** Last compiled `pattern`, to avoid recompiling it for every chip. */
    #patternCache: { source: string, regex: RegExp | null } | null = null;

    /** Form whose `reset` event is being listened to. */
    #boundForm: HTMLFormElement | null = null;

    /** Keeps the chips consistent with whatever is done to the DOM from outside. */
    readonly #childObserver = new MutationObserver(() => this.#reconcile());

    // SETUP ===========================================

    public constructor() {
        super();

        const wrapper = this.#wrapper = document.createElement('div');
        const addButton = this.#addButton = document.createElement('button');
        const input = this.#input = document.createElement('input');
        const status = this.#status = document.createElement('div');

        // no name so it is not submitted; 
        // its content is only a draft of a value
        input.type = 'text';

        addButton.type = 'button';
        addButton.textContent = 'Add';
        addButton.setAttribute('aria-label', 'Add new item');

        // The live region must exist (empty) before its text changes,
        // otherwise assistive technologies do not announce it.
        status.id = `dynamic-selector-status-${DynamicSelector.#nextId++}`;
        status.setAttribute('role', 'status');

        wrapper.append(input, addButton, status);

        addButton.addEventListener('click', this.#onAdd);
        input.addEventListener('keydown', this.#onInputKeydown);
        input.addEventListener('input', this.#onDraftInput);
        input.addEventListener('change', this.#stop);

        // One delegated listener for every chip, in the capture phase so that
        // their native events can be stopped before reaching anyone else.
        this.addEventListener('change', this.#onChipEvent, true);
        this.addEventListener('input', this.#onChipEvent, true);
        this.addEventListener('keydown', this.#onChipKeydown);

        // Observing works while disconnected too, so nothing is missed
        // between connections; the observer lives and dies with the node.
        this.#childObserver.observe(this, { childList: true });
    }

    public connectedCallback(): void {
        this.prepend(this.#wrapper);
        this.#syncDelegatedAttributes();
        this.#applyForm();
        this.#applyDisabled(this.disabled);
        // If the parser created this element, its children may not be there
        // yet: the observer registers them as they arrive.
        this.#reconcile();
        this.#bindForm();
    }

    public disconnectedCallback(): void {
        this.#boundForm?.removeEventListener('reset', this.#onFormReset);
        this.#boundForm = null;
    }

    // ACCESSORS =========================================

    /**
     * Values held by the selector, as an array of strings (derived from the
     * checked chips). This property has no corresponding attribute since
     * it is not representable as a string.
     *
     * Values are trimmed and blank ones dropped, but they are not checked
     * against the entry constraints: see class remarks ({@link DynamicSelector}).
     */
    public get value(): value[] {
        return selectedValues(this) as value[];
    }
    public set value(values: string[]) {
        setSelection(this, values, this.#chipOptions());
        this.#updateValidity();
    }

    public get name(): string { return this.getAttribute('name') ?? ''; }
    public set name(v: string) { this.setAttribute('name', v); }

    public get disabled(): boolean { return this.hasAttribute('disabled'); }
    public set disabled(v: boolean) { this.toggleAttribute('disabled', v); }

    public get required(): boolean { return this.hasAttribute('required'); }
    public set required(v: boolean) { this.toggleAttribute('required', v); }

    /** The form that owns the selector's controls; `null` if there is none. */
    public get form(): HTMLFormElement | null { return this.#input.form; }

    // The selection's validity lives on the text input: only `customError` is ever set.
    public get willValidate(): boolean { return this.#input.willValidate; }
    public get validity(): ValidityState { return this.#input.validity; }
    public get validationMessage(): string { return this.#input.validationMessage; }
    public checkValidity(): boolean { return this.#input.checkValidity(); }
    public reportValidity(): boolean { return this.#input.reportValidity(); }

    // ATTRIBUTES ================================================

    attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
        switch (name) {
            case 'disabled':
                this.#applyDisabled(newVal !== null);
                break;
            case 'required':
            case 'minlength':
            case 'pattern':
                // Existing values are kept, but their validity may have changed.
                this.#updateValidity();
                break;
            case 'name':
                this.#syncChips();
                break;
            case 'form':
                this.#applyForm();
                if (this.isConnected) this.#bindForm();
                break;
            default:
                this.#forwardAttribute(name, newVal);
                if (name === 'maxlength') this.#updateValidity();
        }
    }

    /** Forwards an attribute change to the text input. */
    #forwardAttribute(name: string, value: string | null) {
        if (value === null) this.#input.removeAttribute(name);
        else this.#input.setAttribute(name, value);
    }

    /** Verifies the delegated attributes held by the selector are
     *  all forwarded to the text input. */
    #syncDelegatedAttributes() {
        for (const attr of DELEGATED_ATTRS)
            this.#forwardAttribute(attr, this.getAttribute(attr));
    }

    /** What the chips take from the selector. */
    #chipOptions(): ChipOptions {
        return { name: this.getAttribute('name'), form: this.getAttribute('form'), disabled: this.disabled };
    }

    /** Gives every chip the selector's `name`, `form` and `disabled`. */
    #syncChips() {
        const options = this.#chipOptions();
        for (const box of chipBoxes(this)) decorateChip(box, options);
    }

    /** Makes the text input belong to the form the selector's `form` attribute points to
     *  (each control works out its owner by itself; without the attribute, it is the ancestor form),
     *  and does the same for the chips. */
    #applyForm() {
        const form = this.getAttribute('form');
        if (form === null) this.#input.removeAttribute('form');
        else this.#input.setAttribute('form', form);
        this.#syncChips();
    }

    /** Sets `disabled` on the controls the selector owns. Inside a disabled
     *  `<fieldset>` they are disabled by the browser regardless of this. */
    #applyDisabled(disabled: boolean) {
        this.#input.disabled = disabled;
        this.#addButton.disabled = disabled;
        this.#syncChips();
    }

    /** Aligns the chips with what is in the DOM, whoever put it there, and the validity with them. */
    #reconcile() {
        reconcileChips(this, this.#chipOptions());
        this.#updateValidity();
    }

    // VALIDITY ======================================

    /** @returns the attribute as a non-negative integer; `null` if absent or invalid (ignored, as natives do). */
    #num(attr: string): number | null {
        const n = Number.parseInt(this.getAttribute(attr) ?? '', 10);
        return Number.isInteger(n) && n >= 0 ? n : null;
    }

    /** @returns the `pattern` attribute compiled as the platform does (whole-value match); `null` if absent or not a valid regex. */
    #pattern(): RegExp | null {
        const source = this.getAttribute('pattern');
        if (!source) return null;
        if (this.#patternCache?.source === source) return this.#patternCache.regex;

        let regex: RegExp | null = null;
        for (const flags of ['v', 'u']) { // `v` is what the spec asks for; `u` for older engines
            try { regex = new RegExp(`^(?:${source})$`, flags); break; } catch { /* try next */ }
        }
        this.#patternCache = { source, regex };
        return regex;
    }

    /**
     * Checks a (trimmed) entry against `minlength`, `maxlength` and `pattern`.
     *
     * @returns the first violated constraint; `null` if the entry is valid.
     */
    #entryFlag(entry: string): EntryFlag | null {
        const min = this.#num('minlength'), max = this.#num('maxlength');
        if (min !== null && entry.length < min) return 'tooShort';
        if (max !== null && entry.length > max) return 'tooLong';
        const regex = this.#pattern();
        if (regex && !regex.test(entry)) return 'patternMismatch';
        return null;
    }

    /**
     * Recomputes the validity of the whole selection, reporting it on the
     * text input, and flags every invalid chip with `aria-invalid`.
     * A missing required selection takes precedence over invalid entries.
     */
    #updateValidity() {
        let selected = 0;
        let firstBad: { flag: EntryFlag, val: string } | null = null;

        for (const box of chipBoxes(this)) {
            const val = chipValue(box);
            const flag = box.checked && val ? this.#entryFlag(val) : null;
            if (box.checked) selected++;
            if (flag) {
                box.setAttribute('aria-invalid', 'true');
                firstBad ??= { flag, val };
            } else box.removeAttribute('aria-invalid');
        }

        let message = '';
        if (this.required && selected === 0) message = MESSAGES.valueMissing;
        else if (firstBad) message = `"${firstBad.val}": ${MESSAGES[firstBad.flag]}`;
        this.#input.setCustomValidity(message);
    }

    // FORM RESET =======================

    /** Follows the `reset` event of the form that owns the text input. */
    #bindForm() {
        const form = this.#input.form;
        if (form === this.#boundForm) return;
        this.#boundForm?.removeEventListener('reset', this.#onFormReset);
        this.#boundForm = form;
        form?.addEventListener('reset', this.#onFormReset);
    }

    /**
     * `reset` is fired *before* the controls are reset, and resetting fires no
     * `input`/`change`. A microtask would not do: for a reset started by the
     * user it would run before the browser resets the controls (the script
     * stack is empty after our listener), so the work waits for a task.
     * Syncing only reflects the state the DOM ends up in, so it needs not know
     * whether somebody cancelled the reset.
     */
    readonly #onFormReset = () => {
        setTimeout(() => {
            this.#clearError();
            this.#reconcile();
        }, 0);
    }

    // FEEDBACK =======================

    /** Reports why an addition was refused, next to the text input. */
    #showError(message: string) {
        this.#status.textContent = message;
        this.#input.setAttribute('aria-invalid', 'true');
        this.#input.setAttribute('aria-describedby', this.#status.id);
    }

    /** Removes invalid state from text input and clears status report. */
    #clearError() {
        this.#status.textContent = '';
        this.#input.removeAttribute('aria-invalid');
        this.#input.removeAttribute('aria-describedby');
    }

    // EVENTS =======================

    /** Notifies a change made by the user with a 'change' and 'input' event,
     *  like a native control does. */
    #emitChange() {
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    readonly #stop = (e: Event) => e.stopImmediatePropagation();

    /**
     * Native `input`/`change` of a chip never leave the selector (their target
     * would be the checkbox, not the selector). Unchecking is what removes
     * the chip, and it is the only change of the selector's value we announce.
     */
    readonly #onChipEvent = (e: Event) => {
        const box = e.target;
        if (!isChip(this, box)) return;
        e.stopImmediatePropagation();
        if (e.type !== 'change' || box.checked) return;

        const refocus = document.activeElement === box ? (neighborChip(box) ?? this.#addButton) : null;
        deselectChip(box);
        this.#updateValidity();
        refocus?.focus();
        this.#emitChange();
    }

    /** Enter on a chip works like Space: it removes it, and never submits the form. */
    readonly #onChipKeydown = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' || !isChip(this, e.target)) return;
        e.preventDefault();
        e.target.click();
    }

    // TEXT INPUT HANDLERS =======================

    /** Typing again dismisses the last error; the draft is not a change of the selector's value. */
    readonly #onDraftInput = (e: Event) => {
        e.stopImmediatePropagation();
        this.#clearError();
    }

    /**
     * When the add button is clicked, the value within the text input is
     * checked and, if acceptable, added to the selection; otherwise the
     * reason is reported to the user.
     */
    readonly #onAdd = () => {
        const input = this.#input;
        const entry = input.value.trim();

        if (entry) {
            const flag = this.#entryFlag(entry);
            if (flag) { this.#showError(MESSAGES[flag]); return; }
        }

        switch (addChip(this, entry, this.#chipOptions())) {
            case 'added':
                this.#updateValidity();
                input.value = '';
                this.#clearError();
                this.#emitChange();
                break;
            case 'blank':
                this.#showError(MESSAGES.blank);
                break;
            case 'duplicate':
                this.#showError(MESSAGES.duplicate);
                input.select(); // ready to be overwritten
                break;
        }
    }

    /**
     * When `Enter` is pressed while focusing the text input, the response
     * is the same as using the add button (and the form is not submitted).
     */
    readonly #onInputKeydown = (e: KeyboardEvent) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        this.#onAdd();
    }
}