import { ElementWithLock, Lockify, requestTransitionFrame, type Lockable } from "../../shared/utilities.js";
import companionSharedConstants from '../../../../config/companion-synced-constants.json' with { type: 'json' };
import type { Closeable, HasOpen, Showable } from "../../../types/general-types.js";
import type { ExpandibleElement, LockableElement } from "./expandible-element.js";

/** Methods `show` and `close` */
interface ExpandableToggles extends Closeable, Showable {
    /** 
     * - Element exits `hidden` state
     * - Adds `OPEN` constant class
     * - schedules callbacks for execution
     * - Applies lock to the transition playing on the element
     * 
     * @param callbacks - Allows scheduling any amount of callback functions
     * that will be called at end of transition
     * 
     * @throws {DOMException} If called while another opening/closing transition is in progress    
     * @throws {DOMException} If called with arguments while the element is already open
     * 
     * @remarks quietly fails if called with no arguments while the element is already open
     * 
     */
    show(...callback: (() => void)[]): void;
    /**  
     * - Removes `OPEN` constant class
     * - schedules callbacks for execution
     * - Element enters `hidden` state at end of transition
     * - Applies lock to the transition playing on the element
     * 
     * @param callbacks - Allows scheduling any amount of callback functions
     * that will be called at end of transition
     * 
     * @throws {DOMException} If called while another opening/closing transition is in progress    
     * @throws {DOMException} If called with arguments while the element is already closed
     * 
     * @remarks quietly fails if called with no arguments while the element is already closed
     */
    close(...callback: (() => void)[]): void;
}

/** Executes during opening transition. */
export const expandableOpenTransition: unique symbol = Symbol('expandableOpenTransition');
/** Executes during closing transition. */
export const expandableCloseTransition: unique symbol = Symbol('expandableCloseTransition');
/** Executes after transition has ended. */
export const expandableOnTransitionEnd: unique symbol = Symbol('expandableOnTransitionEnd');

const ExpandableSymbol: unique symbol = Symbol("Expandable");

export interface Expandable extends ExpandableToggles, HTMLElement {
    [ExpandableSymbol]: never;
    [expandableOpenTransition](): void;
    [expandableCloseTransition](): void;
    [expandableOnTransitionEnd](): void;

    /** 
     * Boolean value reflecting the `open` HTML attribute, 
     * indicating whether the element is available for interaction. 
     */
    open: boolean;

    /** 
     * Calls opening/closing method of element
     *  but safely returns `false` instead of throwing `Error` 
     */
    safeCall(
        call: keyof Expandable,
        ...callbacks: (() => void)[]
    ): boolean;

    /** 
     * Handles attribute changes. 
     * 
     * On change of `open`, 
     * if the attribute
     *  
     * @param name - name of the attribute
     * @param oldValue - pre-change value
     * @param newValue - after-change value
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
    /** On injection in DOM, align `hidden` and `open` attributes and class. */
    connectedCallback(): void;
}

const OPEN_ATTRIBUTE: keyof HasOpen = 'open';
/** CSS class utility to mark an open toggleable. */
export const OPEN = companionSharedConstants.classes.common.isOpen;
/**
 * Generic Expandable Element.
 * 
 * The class provides basic structure for handling an HTML element's
 * transition between hidden states; refer to the configurable `OPEN`
 * class for transitions.
 * 
 * States are switched by using **`close()`** and **`show()`** public methods;
 * an opening transition must complete to start a closing one and viceversa,
 * also, it is possible to schedule any amount of callbacks to be called
 * at the end of the transition.
 * 
 * @remarks
 * - It is not recommended to manually alter the `open` attribute to trigger
 * the transitions; use the provided methods instead.
 * - It is not recommended to manually alter the `hidden` attribute since hiding 
 * the element forcefully will not trigger any transition.
 * - `hidden` and `open` are kept aligned throughout the element's lifecycle, 
 * BUT, if the element is created via JS, the attribute will not be aligned 
 * until after the element is injected in the DOM
 * - *Requires a DOM environment* — not compatible with Node.js.
 * 
 * @see {@link TriggerElement} for associated controller class
 */
export function Expandable<
    TBase extends new (...args: any[]) => LockableElement
>(Base: TBase) {
    return class ExpandableElement extends Base implements Expandable {

        constructor(...args: any[]) {
            super(...args);
        }

        declare [ExpandableSymbol]: never;

        // OPEN ATTRIBUTE SETUP =============================================================
        
        public get open(): boolean {
            return this.hasAttribute(OPEN_ATTRIBUTE);
        }
        public set open(value: boolean) {
            if (value) {
                this.setAttribute(OPEN_ATTRIBUTE, '');
            } else {
                this.removeAttribute(OPEN_ATTRIBUTE);
            }
        }

        /** Element's observed attributes. */
        static get observedAttributes(): string[] {
            return [OPEN_ATTRIBUTE, 'hidden'];
        }

        /** Adds `OPEN` class in an AnimationFrame requested after setting `hidden` to `false`. */
        private handleOpening() {
            this.hidden = false;
            requestTransitionFrame(() => {
                this.classList.add(OPEN);
            });
            this[expandableOpenTransition]();
        }
        public [expandableOpenTransition](): void { }
        /** Removes `OPEN` class. */
        private handleClosing() {
            this.classList.remove(OPEN);
            this[expandableCloseTransition]();
        }
        public [expandableCloseTransition](): void { }

        // Attribute related callbacks ==================================================
        connectedCallback(): void {
            this.open ? this.classList.add(OPEN) : this.classList.remove(OPEN);
            this.hidden = !this.open;
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
            if (
                name === OPEN_ATTRIBUTE
                && typeof oldValue !== typeof newValue
            ) {
                this.lock();
                if (newValue !== null) {
                    // OPEN
                    this.handleOpening();
                } else {
                    // CLOSE
                    this.handleClosing();
                }
                this.setupOnTransitionEnd();

            } else if (
                name === 'hidden'
                && typeof oldValue !== typeof newValue
                && this.open === this.hidden
            ) {
                this.open = !this.hidden
            }
        }

        /** 
         * An array of functions that are to be called 
         * at the end of an opening/closing transition. 
         */
        private pendingCallbacks: (() => void)[] = [];
        /** Add one or more functions to callback schedule. */
        private scheduleCallbacks(callbacks: (() => void)[]): void {
            this.pendingCallbacks.push(...callbacks);
        }
        /** Flush all pending callbacks. */
        private clearCallbacks(): void { this.pendingCallbacks = []; }

        /**
         * Handles *end of transition* cleanup:
         * - hides the element if it doesn't have `open` attribute
         * - calls all pending callbacks safely
         * - empties pending callbacks
         * - releases transition lock
         */
        private onTransitionEnd = () => {
            this.hidden = !this.open; // only hide at end of transition
            this[expandableOnTransitionEnd]();
            this.pendingCallbacks.forEach(
                callback => {
                    try { callback(); }
                    catch (e) { console.error(e); }
                }
            );
            this.clearCallbacks();
            this.unlock();
        }
        public [expandableOnTransitionEnd](): void {}
        /** Activates the one-time listener for the end of transition operations. */
        private setupOnTransitionEnd(): void {
            this.addEventListener('transitionend',
                this.onTransitionEnd, { once: true });
        }

        // SHOW =========================================================================
        public show(...callbacks: (() => void)[]): void {
            if (this.isLocked)
                throw new DOMException(
                    "Cannot open the element while a transition is in progress",
                    "InvalidStateError"
                );
            if (this.open) {
                if (callbacks.length === 0) return; // second request without extra arguments quietly fails
                else throw new DOMException(
                    "Cannot schedule callbacks without a state change",
                    "InvalidStateError"
                );
            };
            this.scheduleCallbacks(callbacks);
            this.open = true;
        }
        // CLOSE ========================================================================
        public close(...callbacks: (() => void)[]): void {
            if (this.isLocked)
                throw new DOMException(
                    "Cannot close the element while a transition is in progress",
                    "InvalidStateError",
                );
            if (!this.open) {
                if (callbacks.length === 0) return; // second request without extra arguments quietly fails
                else throw new DOMException(
                    "Cannot schedule callbacks without a state change",
                    "InvalidStateError"
                );
            };
            this.scheduleCallbacks(callbacks);
            this.open = false;
        }

        // SAFE CALL ====================================================================
        public safeCall(
            call: keyof ExpandableToggles,
            ...callbacks: (() => void)[]
        ): boolean {
            try {
                this[call](...callbacks);
            } catch (e) {
                return false;
            } return true;
        }

    }

}

Expandable.isExpandable = (Base: any) => {
    if(Base[ExpandableSymbol] ?? Base[ExpandableSymbol] === ExpandableSymbol) {
        return true;
    }
}