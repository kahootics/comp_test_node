import { getValidatedElement, requestTransitionFrame } from "../shared/utilities.js";
import companionSharedConstants from '../../../config/companion-synced-constants.json' with { type: 'json' };
import { ToggleableElement } from "./expandables/expandable-pair.js";

// BACKDROP =============================================================================
/** Backdrop specific css class name. */
const CLASS: string = companionSharedConstants.classes.modals.backdrop;
/**
 * Backdrop component for modals.
 * @remarks
 * - *Requires a DOM environment* — not compatible with Node.js.
 * - Must be instantiated after DOM is ready (`DOMContentLoaded`).
 * @example
 * const backdrop = new Backdrop(closeMyModalFunc);
 */
export class Backdrop extends ToggleableElement {
    /** Backdrop element (created from scratch). */
    get BACKDROP() { return this.ELEMENT; }
    /**
     * @param modalCloserFunction - Function that closes the modal; 
     * required for closing it when backdrop is clicked
     */
    constructor(modalCloserFunction: () => void) {
        super(document.createElement('div'),HTMLElement);
        this.BACKDROP.className = CLASS;
        document.body.appendChild(this.BACKDROP);
        this.BACKDROP.addEventListener('click', modalCloserFunction);
    }
    /** Removes backdrop from document. */
    destroy() {
        this.BACKDROP.remove();
    }
}

// MODAL ================================================================================
/** CSS selectors list of focusable elements. */
const FOCUSABLES = ':not(:disabled, [hidden]):where(a, button, input, textarea, select, [tabindex]:not([tabindex="-1"]))';
/**
 * Helper function to retrieve the focusable first and last elements of a given one
 * @param element - The HTMLElement to search for focusable elements
 * @returns an object containing the first and last HTMLElement that is focusable within the element
 */
function getFocusableExtremities(element: HTMLElement) {
    const focusables: HTMLElement[] = Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLES));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if(!(first && last)) 
        throw new Error('Element has no available focusable element');
    if(document.activeElement instanceof HTMLElement 
        && !focusables.includes(document.activeElement)) {
            first.focus();
        }
    return { first, last };
}
/**
 * Custom Modal Element.
 * @remarks 
 * - *Requires a DOM environment*.
 * - The Focus Trap dinamically adapts to changes in the modal's subtree
 */
export default class Modal extends ToggleableElement<HTMLElement> {
    /** Modal element. */
    protected get modal() { return this.ELEMENT; }
    /** Backdrop of the modal. */
    protected readonly backdrop: Backdrop;
    /** Modal default close button element. */
    protected readonly closer: HTMLButtonElement;
    /** First focusable element within the modal. */
    private firstFocusable: HTMLElement;
    /** Last focusable element within the modal. */
    private lastFocusable: HTMLElement;
    /** Last focused element before focus trap activation. */
    private _lastFocus: HTMLElement | null = null;
    /** Mutation Observer to refresh focusables if needed. */
    private readonly observer: MutationObserver;
    
    
    constructor(modal: string | HTMLElement, modalCloser: string | HTMLButtonElement) {
        super(modal, HTMLElement);
        // Modal element
        if(!(this.modal.getAttribute('role') === 'dialog'
            && this.modal.getAttribute('aria-modal') === 'true')
        ) throw new Error(`Id:"${modal}" does not have required attributed to be a dialog.`);
        // Modal default close button
        this.closer = getValidatedElement(HTMLButtonElement, modalCloser);
        // Backdrop
        this.backdrop = new Backdrop(() => this.close());
        // Focusable extremities
        this.firstFocusable = getFocusableExtremities(this.modal).first;
        this.lastFocusable = getFocusableExtremities(this.modal).last;
        // Observer for focusables mutations
        this.observer = new MutationObserver(() => this.updateFocusables());
        // Initializer
        this.init();
    }

    /** Updates focusable elements contained within the modal */
    private updateFocusables(): void {
        this.firstFocusable = getFocusableExtremities(this.modal).first;
        this.lastFocusable = getFocusableExtremities(this.modal).last;
    }
    /** Activates the observer */
    private beginObserveFocusables() {
        this.updateFocusables();
        this.observer.observe(this.modal, { childList: true, subtree: true });
    }
    /** Stops the observer */
    private stopObserveFocusables() {
        this.observer.disconnect();
    }

    /** Sets last focused element only if it is HTMLElement type */
    private set lastFocus(element: any) {
        this._lastFocus = element instanceof HTMLElement
            ? element : null;
    }
    /** @returns last focused element in the document before opening the modal */
    get lastFocus() {
        return this._lastFocus;
    }
    
    /**
     * - opens the modal and backdrop
     * - traps the focus in the modal
     * - gives focus to the modal's focusable
     * - locks the document's scrolling
     */
    override open(...callbacks: (() => void)[]): void {
        this.backdrop.open();
        super.open(...callbacks);
        this.activateFocusTrap();
    }
    /**
     * - closes the modal and backdrop
     * - returns the focus to the document
     * - gives focus to the document's last focused
     * - unlocks the document's scrolling
     */
    override close(...callbacks: (() => void)[]): void {
        this.backdrop.close();
        super.close(...callbacks);
        this.removeFocusTrap();
    }

    /** 
     * - **Traps focus** within an element's focusable children
     * - *When `Escape` key is pressed*:   
     * closes the modal
     * - *When `Tab` key is pressed*:   
     * if focus is on the lastFocusable element, moves it to the firstFocusable one within the modal
     * - *When `Tab` + `Shift` is pressed*:    
     * if focus is on the firstFocusable element, moves it to the lastFocusable one within the modal
     * @param {KeyboardEvent} e - Pressed key 
     */
    private focusTrapEvent = (e: KeyboardEvent): void => {

        if(e.key === 'Escape') this.close();
        if (e.key !== 'Tab') return;

        if (e.shiftKey && document.activeElement === this.firstFocusable) {
            e.preventDefault();
            this.lastFocusable.focus();
        } else if (!e.shiftKey && document.activeElement === this.lastFocusable) {
            e.preventDefault();
            this.firstFocusable.focus();
        }
    }

    /**
     * - Start observing for changes to focusable elements
     * - Disables document scrolling
     * - Stores currently focused element
     * - Gives focus to modal
     * - Sets Focus Trap within the modal
     */
    protected activateFocusTrap() {
        this.beginObserveFocusables();
        document.documentElement.style.overflow = 'hidden';
        this.lastFocus = document.activeElement;
        this.firstFocusable.focus();
        this.modal.addEventListener('keydown',this.focusTrapEvent);
    }
    /**
     * - Stop observing for changes to focusable elements
     * - Re-enables document scrolling
     * - Gives focus back to stored focused element
     * - Gives focus to modal
     * - Removes Focus Trap
     */
    protected removeFocusTrap() {
        this.stopObserveFocusables();
        document.documentElement.style.removeProperty('overflow');
        if(this.lastFocus) this.lastFocus.focus();
        this.lastFocus = null;
        this.modal.removeEventListener('keydown', this.focusTrapEvent);
    }

    /**
     * - adds listener for Closer button
     */
    protected init() {
        this.closer.addEventListener('click', () => this.close());
    }   
}

// MODAL CONTROL ========================================================================

