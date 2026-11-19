import { FalseSelect } from '../../../src/scripts/browser/ui/components/false/false-select.js';
import { FalseSelectDropdown } from '../../../src/scripts/browser/ui/components/false/false-select-dropdown.js';

export const DROPDOWN_TAG = 'false-select-dropdown-test';
export const SELECT_TAG = 'false-select-test';

// FalseSelect builds a dropdown when it is constructed, so the dropdown goes first.
if (!customElements.get(DROPDOWN_TAG)) customElements.define(DROPDOWN_TAG, FalseSelectDropdown);
if (!customElements.get(SELECT_TAG)) customElements.define(SELECT_TAG, FalseSelect);

/** Waits for a task: enough for the mutation observer and for the timeout that follows a reset. */
export const tick = () => new Promise<void>(r => setTimeout(r, 0));

export const entries = (form: HTMLFormElement) => Array.from(new FormData(form).entries());

/** The user changes an option: a real click, which fires the browser's own `input` and `change`. */
export const click = (el: HTMLElement) => el.click();

/** Records `input` / `change` events as seen at each target, as `type@label:origin`. */
export function record(targets: [string, EventTarget][]) {
    const log: string[] = [];
    for (const [label, target] of targets)
        for (const type of ['input', 'change'])
            target.addEventListener(type, e => log.push(`${type}@${label}:${(e.target as Element).localName}`));
    return log;
}

