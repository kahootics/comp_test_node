/**
 * The chips of a `<dynamic-selector>`, as plain functions over the DOM.
 *
 * A chip is a direct child of the host, shaped as follows:
 * ```html
 * <label>
 *     <input type="checkbox" name="tags" value="a" checked>
 *     <span>a</span>
 * </label>
 * ```
 *
 * The selection is the set of *checked* chips. Checkboxes are used because
 * the browser itself then submits them (repeated entries, as with any
 * checkbox group), resets them and excludes them inside a disabled
 * `<fieldset>`: nothing here reimplements that. Since they are plain markup,
 * they also keep submitting when no script runs.
 *
 * Two kinds of chip exist, told apart by the `checked` *attribute* (the
 * checkbox's default, which a form reset restores) as opposed to the `checked`
 * *property* (its current state):
 * - **declared** chips have the attribute: they come from the markup, or from
 *   anybody who inserted them, and are what a form reset brings back;
 * - **created** chips are selected through the property only: a form reset
 *   unselects them, and they are then discarded.
 *
 * Removing a chip from the selection means unselecting it; a declared chip is
 * then hidden instead of deleted, so that a reset can bring it back (at most
 * as many chips linger as the markup declared), while a created one is deleted.
 *
 * Nothing here depends on the selector's class: `host` is any element.
 */

/** What the chips take from the selector that owns them. */
export interface ChipOptions {
    /** Name the chips are submitted under; without it they are not submitted. */
    name: string | null;
    /** Id of the form the chips belong to (the selector's `form` attribute); `null` for the ancestor form. */
    form: string | null;
    disabled: boolean;
}

/** Outcome of an attempt to add a value. */
export type AddResult = 'added' | 'blank' | 'duplicate';

const CHIP_BOXES = ':scope > label > input[type="checkbox"]';

// READING ====================================

/** @returns the checkbox of every chip of the host (hidden and unselected ones included), in DOM order. */
export function chipBoxes(host: Element): HTMLInputElement[] {
    return Array.from(host.querySelectorAll<HTMLInputElement>(CHIP_BOXES));
}

/** @returns the `<label>` that wraps the checkbox of a chip. */
export function chipLabel(box: HTMLInputElement): HTMLLabelElement {
    return box.parentElement as HTMLLabelElement;
}

/**
 * @returns the trimmed value of a chip; empty if it has none (a checkbox
 * without a `value` attribute would submit "on", which is never wanted).
 */
export function chipValue(box: HTMLInputElement): string {
    return box.hasAttribute('value') ? box.value.trim() : '';
}

/** Verifies that an event target is the checkbox of one of the host's chips. */
export function isChip(host: Element, target: EventTarget | null): target is HTMLInputElement {
    return target instanceof HTMLInputElement
        && target.type === 'checkbox'
        && target.parentElement instanceof HTMLLabelElement
        && target.parentElement.parentElement === host;
}

/** @returns the chip holding a value, selected or not; `undefined` if there is none. */
export function findChip(host: Element, val: string): HTMLInputElement | undefined {
    return chipBoxes(host).find(box => chipValue(box) === val);
}

/** @returns the values of the selected chips, in DOM order, without repetitions. */
export function selectedValues(host: Element): string[] {
    const values = new Set<string>();
    for (const box of chipBoxes(host)) {
        const val = chipValue(box);
        if (box.checked && val) values.add(val);
    }
    return Array.from(values);
}

/**
 * Finds the selected chip closest to the given one: the following ones are
 * looked at first, then the preceding ones.
 *
 * @returns that chip's checkbox; `null` if there is no other selected chip.
 */
export function neighborChip(box: HTMLInputElement): HTMLInputElement | null {
    const label = chipLabel(box);
    for (const step of ['nextElementSibling', 'previousElementSibling'] as const) {
        for (let el = label[step]; el; el = el[step]) {
            const other = el instanceof HTMLLabelElement
                ? el.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]')
                : null;
            if (other?.checked) return other;
        }
    }
    return null;
}

// CHANGING A CHIP ====================================

/** Gives a chip what it takes to be submitted and to follow the selector's state. */
export function decorateChip(box: HTMLInputElement, { name, form, disabled }: ChipOptions): void {
    if (name) box.setAttribute('name', name);
    else box.removeAttribute('name');

    if (form === null) box.removeAttribute('form');
    else box.setAttribute('form', form);

    box.disabled = disabled;
}

/** Selects a chip, bringing it back if it was hidden. */
export function selectChip(box: HTMLInputElement): void {
    box.checked = true;
    chipLabel(box).hidden = false;
}

/**
 * Unselects a chip: a declared one is hidden so that a form reset can
 * restore it; a created one is deleted.
 */
export function deselectChip(box: HTMLInputElement): void {
    box.checked = false;
    const label = chipLabel(box);
    if (box.defaultChecked) label.hidden = true;
    else label.remove();
}

/**
 * Creates a selected chip at the end of the host. It is selected through the
 * property only (no `checked` attribute), so it is a created chip, not a declared one.
 * The text is set as text: a value is never interpreted as markup.
 *
 * @returns the chip's checkbox.
 */
export function createChip(host: Element, val: string, options: ChipOptions): HTMLInputElement {
    const label = document.createElement('label');
    const box = document.createElement('input');
    const text = document.createElement('span');

    box.type = 'checkbox';
    box.value = val;
    box.checked = true;
    text.textContent = val;

    label.append(box, text);
    decorateChip(box, options);
    host.append(label);
    return box;
}

/**
 * Leaves exactly one chip per value, and none without a value. Both are
 * ill-formed (a duplicate would be submitted twice, one without value would
 * submit "on") and never legitimate, so they are deleted rather than hidden.
 *
 * Of the chips holding the same value the survivor is a declared one if there
 * is any (so that a form reset can still restore it), otherwise the first.
 * It is selected if any of them was: a value is not lost because the chip that
 * happened to come first was unselected.
 */
function collapseChips(host: Element): void {
    const groups = new Map<string, HTMLInputElement[]>();
    for (const box of chipBoxes(host)) {
        const val = chipValue(box);
        if (!val) { chipLabel(box).remove(); continue; }
        const group = groups.get(val);
        if (group) group.push(box);
        else groups.set(val, [box]);
    }
    for (const group of groups.values()) {
        if (group.length === 1) continue;
        const survivor = group.find(box => box.defaultChecked) ?? group[0]!;
        const selected = group.some(box => box.checked);
        for (const box of group) if (box !== survivor) chipLabel(box).remove();
        survivor.checked = selected;
    }
}

// CHANGING THE SELECTION ====================================

/**
 * Makes the selection exactly the given values: the chips holding them are
 * selected, the others unselected, and the missing values get a new chip.
 * Values are trimmed, and blank ones and repetitions dropped. Chips that are
 * ill-formed (see `collapseChips`) are deleted on the way.
 */
export function setSelection(host: Element, values: readonly string[], options: ChipOptions): void {
    const wanted = new Set(values.map(v => v.trim()).filter(Boolean));

    collapseChips(host);
    for (const box of chipBoxes(host)) {
        if (wanted.delete(chipValue(box))) selectChip(box);
        else deselectChip(box);
    }
    for (const val of wanted) createChip(host, val, options);
}

/**
 * Adds a value to the selection: a chip already holding it is selected again
 * (a declared one that had been hidden), otherwise a new chip is created.
 *
 * @returns the outcome:
 * - `'added'` if the value is now selected because of this call,
 * - `'blank'` if the value was empty or only whitespace,
 * - `'duplicate'` if the value was already selected.
 */
export function addChip(host: Element, raw: string, options: ChipOptions): AddResult {
    const val = raw.trim();
    if (!val) return 'blank';

    const existing = findChip(host, val);
    if (existing?.checked) return 'duplicate';
    if (existing) selectChip(existing);
    else createChip(host, val, options);
    return 'added';
}

/**
 * Aligns the chips with what is in the DOM, whoever put it there.
 * Idempotent: it looks at the whole state, so running it twice changes
 * nothing the second time.
 *
 * 1. leaves one chip per value and none without a value (see `collapseChips`),
 * 2. for each chip left, trims the value and gives it the selector's `name`,
 *    `form` and `disabled`,
 * 3. shows selected chips, hides unselected declared ones, deletes any other unselected.
 *
 * Step 3 is what a form reset needs afterwards: it unselects the created chips
 * (which are then deleted) and selects the declared ones again (shown again).
 */
export function reconcileChips(host: Element, options: ChipOptions): void {
    collapseChips(host);
    for (const box of chipBoxes(host)) {
        const label = chipLabel(box);
        const val = chipValue(box);
        if (box.value !== val) box.value = val;
        decorateChip(box, options);
        if (box.checked) label.hidden = false;
        else if (box.defaultChecked) label.hidden = true;
        else label.remove();
    }
}