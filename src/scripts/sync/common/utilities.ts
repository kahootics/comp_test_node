
/**
 * Schedules a callback to run after two animation frames,
 * ensuring CSS transitions trigger correctly.
 * 
 * @param callback - Function to execute after the two frames
 * @remarks
 * *Requires a DOM environment*.
 * 
 * @example
 * requestTransitionFrames(() => {
 *     element.style.setProperty('height', '100px');
 * });
 */
export function requestTransitionFrame(callback: () => void): void {
    requestAnimationFrame(() => requestAnimationFrame(callback));
}

/**
 * Checks whether all provided values are instances of the given constructor.
 *
 * @typeParam T - Expected instance type
 * @param type - Constructor to check against
 * @param elements - Values to check
 * @returns `true` if all elements are instances of T
 * @remarks 
 * - does NOT validate elements for Typescript
 * - *Requires a DOM environment*.
 *
 * @example
 * ```typescript
 * const btn = document.getElementById('btn');
 * const div = document.getElementById('div');
 *
 * if (areInstancesOf(HTMLButtonElement, btn, div)) {
 *     // btn e div sono entrambi HTMLButtonElement
 * }
 * ```
 */
export function areInstancesOf<T>(
    type: new (...args: unknown[]) => T,
    ...elements: unknown[]
): boolean {
    return elements.every(el => el instanceof type);
}

/**
 * Retrieves HTML element of specified type from 
 * string or validates type of element.
 * 
 * @param type - type to get the element validated for (must be HTMLElement or extension)
 * @param idOrEl - either id attribute of element or the element itself
 * @returns the element with validated type
 * @throws an error If element is not of requested type
 * @throws an error If element does not exist (id references nothing)
 * @remarks *Requires a DOM environment*.
 */
export function getValidatedElement<H extends HTMLElement>(
    type: new (...args: unknown[]) => H,
    idOrEl: string | H
): H {
    if (typeof idOrEl === 'string') {
        const el = document.getElementById(idOrEl);
        if (!el) throw new Error(`Element with id "${idOrEl}" not found.`);
        if (!(el instanceof type)) throw new Error(`Element "${idOrEl}" is not ${type.name}.`);
        return el;
    }
    return idOrEl;
}

/**
 * Template element with lock methods to prevent multiple actions for the same object
 */
export class ElementWithLock {
    /** Whether an action is in play. */
    private _lock: boolean = false;
    /** 
     * Activates lock. 
     * @remarks only available to descendants */
    protected lock(): void { this._lock = true; }
    /** 
     * Deactivates lock. 
     * @remarks only available to descendants */
    protected unlock(): void { this._lock = false; }
    /** @returns lock state */
    get isLocked(): boolean { return this._lock; }
}

