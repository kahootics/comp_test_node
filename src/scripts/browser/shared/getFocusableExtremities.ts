// HELPERS =============================================================================
/** CSS selectors list of focusable elements. */
const FOCUSABLES = ':not(:disabled, [hidden]):where(a, button, input, textarea, select, [tabindex]:not([tabindex="-1"]))';
/* a[href], button, input, select, textarea, audio[controls], video[controls],
[contenteditable]:not([contenteditable="false"]), [tabindex],
iframe, embed, object, summary */
/**
 * Helper function to retrieve all focusable elements of a given one
 * @param element - The HTMLElement to search for focusable elements
 * @returns an array containing the HTMLElements that are focusable within the element
 */
export function getAllFocusables(element: HTMLElement): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLES));
}
/**
 * Helper function to retrieve the focusable first and last elements of a given one
 * @param element - The HTMLElement to search for focusable elements
 * @returns an object containing the first and last HTMLElement that is focusable within the element
 */
export function getFocusableExtremities(element: HTMLElement) {
    const focusables = getAllFocusables(element);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!(first && last))
        throw new Error('Element has no available focusable element');
    if (document.activeElement instanceof HTMLElement
        && !focusables.includes(document.activeElement)) {
        first.focus();
    }
    return { first, last };
}
