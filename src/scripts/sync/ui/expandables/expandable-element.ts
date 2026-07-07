import { ElementWithLock, requestTransitionFrame } from "../../shared/utilities.js";
import companionSharedConstants from '../../../../config/companion-synced-constants.json' with { type: 'json' };
import type { Closeable, HasOpen, Showable } from "../../../types/general-types.js";

interface ExpandableElementInterface extends Closeable, Showable{
    show(...callback: (() => void)[]): void;
    close(...callback: (() => void)[]): void;
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
export default class ExpandableElement extends ElementWithLock 
implements ExpandableElementInterface, HasOpen {

    // OPEN ATTRIBUTE SETUP =============================================================
    /** 
     * Boolean value reflecting the `open` HTML attribute, 
     * indicating whether the element is available for interaction. 
     */
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
    }
    /** Removes `OPEN` class. */
    private handleClosing() {
        this.classList.remove(OPEN);
    }

    /** On injection in DOM, align `hidden` and `open` attributes and class. */
    connectedCallback() {
        this.open ? this.classList.add(OPEN) : this.classList.remove(OPEN);
        this.hidden = !this.open;
    }

    /** Handles attribute changes. */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (
            name === OPEN_ATTRIBUTE
            && typeof oldValue !== typeof newValue
        ) {
            this.lock();
            if( newValue !== null ) {
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
        this.pendingCallbacks.forEach(
            callback => {
                try { callback(); } 
                catch(e) { console.error(e); }
            }
        );
        this.clearCallbacks();
        this.unlock();
    }
    /** Activates the one-time listener for the end of transition operations. */
    private setupOnTransitionEnd(): void {
        this.addEventListener('transitionend', 
            this.onTransitionEnd, { once: true });
    }

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
    public show(...callbacks: (() => void)[]): void {
        if(this.isLocked) 
            throw new DOMException(
                "Cannot open the element while a transition is in progress", 
                "InvalidStateError"
            );
        if(this.open) {
            if(callbacks.length === 0) return; // second request without extra arguments quietly fails
            else throw new DOMException(
                "Cannot schedule callbacks without a state change", 
                "InvalidStateError"
            );
        };
        this.scheduleCallbacks(callbacks);
        this.open = true;
    }
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
    public close(...callbacks: (() => void)[]): void {
        if(this.isLocked) 
            throw new DOMException(
                "Cannot close the element while a transition is in progress", 
                "InvalidStateError",
            );
        if(!this.open) {
            if(callbacks.length === 0) return; // second request without extra arguments quietly fails
            else throw new DOMException(
                "Cannot schedule callbacks without a state change", 
                "InvalidStateError"
            );
        };
        this.scheduleCallbacks(callbacks);
        this.open = false;
    }

    /** Calls opening/closing method of element but safely returns `false` instead of throwing `Error` */
    public safeCall(
        call: keyof ExpandableElementInterface, 
        ...callbacks: (() => void)[]
    ): boolean {
        try {           
            this[call](...callbacks);
        } catch(e) {
            return false;
        } return true;
    }
    
}

customElements.define("expandable-element",ExpandableElement);
