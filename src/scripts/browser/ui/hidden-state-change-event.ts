

interface HiddenStateChangeEventInit extends EventInit {
    old: HTMLElement['hidden']
    new: HTMLElement['hidden']
}
export const hiddenStateChangeEvent: 'hiddenStateChangeEvent' = 'hiddenStateChangeEvent';
/**
 * Event emitted by an instance of `Expandable` that has changed between 
 * open to closed state or viceversa.
 */
export class HiddenStateChangeEvent extends Event implements HiddenStateChangeEventInit {
    readonly #old: HTMLElement['hidden']
    readonly #new: HTMLElement['hidden']
    get old() { return this.#old; }
    get new() { return this.#new; }
    constructor(type: typeof hiddenStateChangeEvent, eventInitDict: HiddenStateChangeEventInit) {
        super(type, eventInitDict);
        this.#old = eventInitDict.old;
        this.#new = eventInitDict.new;
    }
}

declare global {
    interface HTMLElementEventMap {
        [hiddenStateChangeEvent]: HiddenStateChangeEvent;
    }
}