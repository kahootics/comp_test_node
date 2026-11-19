
interface ExpandableChangeEventInit extends EventInit {
    open: boolean;
    stage: 'start' | 'end';
}
export const expandableChangeEvent: 'expandableChangeEvent' = 'expandableChangeEvent';
/**
 * Event emitted by an instance of `Expandable` that has changed between 
 * open to closed state or viceversa.
 */
export class ExpandableChangeEvent extends Event implements ExpandableChangeEventInit {
    readonly #open: ExpandableChangeEventInit['open'];
    readonly #stage: ExpandableChangeEventInit['stage'];
    get open() { return this.#open; }
    get stage() { return this.#stage; }
    constructor(type: typeof expandableChangeEvent, eventInitDict: ExpandableChangeEventInit) {
        super(type, eventInitDict);
        this.#open = eventInitDict.open;
        this.#stage = eventInitDict.stage;
    }
}

declare global {
    interface HTMLElementEventMap {
        [expandableChangeEvent]: ExpandableChangeEvent;
    }
}