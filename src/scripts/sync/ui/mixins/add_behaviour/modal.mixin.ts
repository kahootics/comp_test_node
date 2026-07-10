import { ValidationError } from "../../../../../errors/common-errors.js";
import { Backdrop } from "../../components/backdrop.js";
import { expandableCloseTransition, expandableOpenTransition } from "./expandable.mixin.js";
import type { Popover } from "./popover.mixin.js";

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends {}> = new (...args: any[]) => T;

// OBFUSCATED PROPERTIES ===============================================================

// MIXIN PUBLIC INTERFACE ==============================================================
interface Modal extends Popover {
    /** last focused element in the document before opening the modal */
    lastFocus: HTMLElement;
}

// HELPERS =============================================================================

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
    if (!(first && last))
        throw new Error('Element has no available focusable element');
    if (document.activeElement instanceof HTMLElement
        && !focusables.includes(document.activeElement)) {
        first.focus();
    }
    return { first, last };
}


// MIXIN FUNCTION ======================================================================
/**
 * Custom Modal Element.
 * 
 * Adds a focus trap to the element while it is open
 * 
 * @remarks 
 * - *Requires a DOM environment*.
 * - The Focus Trap dinamically adapts to changes in the modal's subtree
 * 
 * {@link Modal}
 */
export function Modal<
    TBase extends Constructor<Popover>
>(Base: TBase) {
    return class ModalElement extends Base implements Modal {

        /** Backdrop of the modal. */
        private readonly backdrop: Backdrop;
        /** First focusable element within the modal. */
        private firstFocusable!: HTMLElement;
        /** Last focusable element within the modal. */
        private lastFocusable!: HTMLElement;
        /** Last focused element before focus trap activation. */
        private _lastFocus: HTMLElement | null = null;
        /** Mutation Observer to refresh focusables if needed. */
        private readonly observer: MutationObserver;

        constructor(...args: any[]) {
            super(...args);
            brand(this);

            this.backdrop = new Backdrop('placeholder', () => this.close());
            this.setAttribute('role', 'dialog');
            this.setAttribute('aria-haspopup', 'dialog');
            this.setAttribute('aria-modal', 'true');
            // Observer for focusables mutations
            this.observer = new MutationObserver(() => this.updateFocusables());
        }

        // DOM Insertion Callback =======================================================
        /**
         * Sets `role` to `dialog` and `aria-modal` to `true`
         * 
         * Updates focusable extremities
         * @inheritdoc
         */
        override connectedCallback(): void {
            super.connectedCallback();
            this.updateFocusables();
        }

        /** Updates focusable elements contained within the modal */
        private updateFocusables(): void {
            const { first, last } = getFocusableExtremities(this);
            this.firstFocusable = first;
            this.lastFocusable = last;
        }
        /** Activates the observer */
        private beginObserveFocusables() {
            this.updateFocusables();
            this.observer.observe(this, { childList: true, subtree: true });
        }
        /** Stops the observer */
        private stopObserveFocusables() {
            this.observer.disconnect();
        }

        // Last Focus ===================================================================
        private set lastFocus(element: any) {
            this._lastFocus = element instanceof HTMLElement
                ? element : null;
        }
        get lastFocus() {
            return this._lastFocus;
        }

        // OPEN & CLOSE EXPANSION =======================================================
        override[expandableOpenTransition](): void {
            super[expandableOpenTransition]();
            this.backdrop.show();
            this.activateFocusTrap();
        }
        override[expandableCloseTransition](): void {
            super[expandableCloseTransition]();
            this.backdrop.close();
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
        private activateFocusTrap() {
            this.beginObserveFocusables();
            document.documentElement.style.overflow = 'hidden';
            this.lastFocus = document.activeElement;
            this.firstFocusable.focus();
            this.addEventListener('keydown', this.focusTrapEvent);
        }
        /**
         * - Stop observing for changes to focusable elements
         * - Re-enables document scrolling
         * - Gives focus back to stored focused element
         * - Gives focus to modal
         * - Removes Focus Trap
         */
        private removeFocusTrap() {
            this.stopObserveFocusables();
            document.documentElement.style.removeProperty('overflow');
            if (this.lastFocus) this.lastFocus.focus();
            this.lastFocus = null;
            this.removeEventListener('keydown', this.focusTrapEvent);
        }

        /**     
         * - opens the modal and backdrop
         * - traps the focus in the modal
         * - gives focus to the modal's focusable
         * - locks the document's scrolling
         * @inheritdoc
         */
        override show(...callbacks: (() => void)[]) {
            super.show(...callbacks);
        }
        /** 
         * - closes the modal and backdrop
         * - returns the focus to the document
         * - gives focus to the document's last focused
         * - unlocks the document's scrolling
         * @inheritdoc
         */
        override close(...callbacks: (() => void)[]) {
            super.close(...callbacks);
        }
    }
}

// EXPORTED NAMESPACE ==================================================================
export namespace Modal {
    /**
     * Validates an element as a `Modal`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `Modal`
     */
    export function getValidated(that: Popover): Modal {
        if (branded.has(that)) return that as Modal;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${Modal.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `Modal`. */
const branded = new WeakSet();
/** Brands an element as an instance of `Modal`. */
function brand(toBrand: Modal) {
    branded.add(toBrand);
}