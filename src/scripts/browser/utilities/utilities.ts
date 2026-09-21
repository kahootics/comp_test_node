
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

