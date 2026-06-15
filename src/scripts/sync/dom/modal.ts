import { getValidatedElement, requestTransitionFrame } from "../common/utilities.js";
import companionSharedConstants from '../../../config/companion-shared-constants.json' with { type: 'json' };
import { ToggleableElement } from "./expandable-pair.js";

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
const FOCUSABLES = 'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
/**
 * Modal Element.
 * @remarks 
 * - *Requires a DOM environment*.
 * - does NOT adapt to focusable elements added to the modal after object construction
 */
export default class Modal extends ToggleableElement<HTMLElement> {
    protected get modal() { return this.ELEMENT; }
    /** Backdrop of the modal. */
    protected readonly backdrop: Backdrop;
    /** Modal default close button element. */
    protected readonly closer: HTMLButtonElement;
    /** First focusable element within the modal. */
    private readonly firstFocusable: HTMLElement;
    /** Last focusable element within the modal. */
    private readonly lastFocusable: HTMLElement;
    /** Last focused element before focus trap activation. */
    private _lastFocus: HTMLElement | null = null;

    
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
        const focusables = this.modal.querySelectorAll<HTMLElement>(FOCUSABLES);
        const firstFocusable = focusables[0];
        const lastFocusable = focusables[focusables.length - 1]; 
        if(!(firstFocusable && lastFocusable)) throw new Error('Modal has no focusable element');;
        this.firstFocusable = firstFocusable;
        this.lastFocusable = lastFocusable;

        this.init();
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
     * - opens the modal and backdrop,
     * - traps the focus in the modal
     * - gives focus to the modal's focusable 
     * - locks the document's scrolling
     */
    override open(): void {
        this.backdrop.open();
        super.open();
        this.activateFocusTrap();
    }
    /**
     * - closes the modal and backdrop,
     * - returns the focus to the document
     * - gives focus to the document's last focused 
     * - unlocks the document's scrolling
     */
    override close(): void {
        this.backdrop.close();
        super.close();
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
     * @param e - Pressed key `Event` object
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
     * - Disables document scrolling
     * - Stores currently focused element
     * - Gives focus to modal
     * - Sets Focus Trap within the modal
     */
    protected activateFocusTrap() {
        document.documentElement.style.overflow = 'hidden';
        this.lastFocus = document.activeElement;
        this.firstFocusable.focus();
        this.modal.addEventListener('keydown',this.focusTrapEvent);
    }
    /**
     * - Re-enables document scrolling
     * - Gives focus back to stored focused element
     * - Gives focus to modal
     * - Removes Focus Trap
     */
    protected removeFocusTrap() {
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

