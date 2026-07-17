import { IllegalArgumentError, ValidationError } from "../../../../../errors/common-errors.js";
import type { Closeable, Showable } from "../../../../types/general-types.js";
import type { ExtendibleElement } from "../../components/extendible-element.js";
import { requestTransitionFrame } from "../../../shared/utilities.js";
import { Lock } from "../../../shared/lock.js";
import { _getPrivateProp, _initPrivateProp, _setPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.js";


// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends {}> = new (...args: any[]) => T;

// OBFUSCATED PROPERTIES ===============================================================
/** Executes during opening transition. */
export const expandableOpenTransition: unique symbol = Symbol('expandableOpenTransition');
/** Executes during closing transition. */
export const expandableCloseTransition: unique symbol = Symbol('expandableCloseTransition');
/** Executes after transition has ended. */
export const expandableOnTransitionEnd: unique symbol = Symbol('expandableOnTransitionEnd');

// MIXIN PUBLIC INTERFACE ==============================================================
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
export interface Expandable extends ExpandableToggles, ExtendibleElement {
    [expandableOpenTransition](): void;
    [expandableCloseTransition](): void;
    [expandableOnTransitionEnd](): void;

    /** Indicates whether the element is in an active transition. */
    isLocked: boolean;

    /** Indicates whether the element is in open state. */
    isOpen: boolean

    /** 
     * Calls opening/closing method of element
     * but safely returns `false` instead of throwing `Error` 
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

// PRIVATE FIELDS ======================================================================
const _lock = new SetOnceWeakMap<Expandable, Lock>();
const _scheduledCallbacks = new SetOnceWeakMap<Expandable, Set<() => void>>();
function _scheduleCallbacks(self: Expandable, callbacks: (() => void)[]) {
    const set = _getPrivateProp(self, _scheduledCallbacks);
    for (const callback of callbacks) {
        set.add(callback);
    }
}

/** Adds `OPEN` class in an AnimationFrame requested after setting `hidden` to `false`. */
function _handleOpening(self: Expandable, OpenClass: string): void {
    self.hidden = false;
    requestTransitionFrame(() => {
        self.classList.add(OpenClass);
    });
    self[expandableOpenTransition]();
}
/** Removes `OPEN` class. */
function _handleClosing(self: Expandable, OpenClass: string): void {
    self.classList.remove(OpenClass);
    self[expandableCloseTransition]();
}
const _pendingOnTransitionEnd = new WeakMap<Expandable, boolean>();
/**
 * @inner
 * Handles *end of transition* cleanup:
 * - hides the element if it doesn't have `open` attribute
 * - calls all pending callbacks safely
 * - empties pending callbacks
 * - releases transition lock
 */
function _onTransitionEnd(self: Expandable) {
    self.hidden = !self.isOpen; // only hide at end of transition
    self[expandableOnTransitionEnd]();
    const callbacks = _getPrivateProp(self, _scheduledCallbacks);
    callbacks.forEach(
        callback => {
            try { callback(); }
            catch (e) { console.error(e); }
        }
    );
    (self as any).onTransitionEnd() // remove
    // Release resources:
    callbacks.clear();
    _setPrivateProp(self, _pendingOnTransitionEnd, false);
    _getPrivateProp(self, _lock).unlock();
}

/** Activates the one-time listener for the end of transition operations. */
function _setupOnTransitionEnd(self: Expandable) {
    if (_getPrivateProp(self, _pendingOnTransitionEnd)) return;
    _setPrivateProp(self, _pendingOnTransitionEnd, true);
    self.addEventListener('transitionend', () => _onTransitionEnd(self), { once: true });
}

// MIXIN FUNCTION ======================================================================
/**
 * Generic Expandable Element.
 * 
 * The class provides basic structure for handling an HTML element's
 * transition between hidden states; refer to the configurable `OPEN`
 * class for transitions.
 * 
 * @param Base - Base class on which the mixin will be implemented
 * @param OpenClass - Class that handles the states transition
 * @returns an extension of the Base class implementing the interface `Expandable`
 * @see {@link Expandable} for full documentation on the available methods
 * 
 * States are switched by using **`close()`** and **`show()`** public methods;
 * an opening transition must complete to start a closing one and viceversa,
 * also, it is possible to schedule any amount of callbacks to be called
 * at the end of the transition.
 * 
 * @remarks
 * - It is *not* recommended to manually alter the `open` attribute to trigger
 * the transitions; use the provided methods instead.
 * - It is *not* recommended to manually alter the `hidden` attribute since hiding 
 * the element forcefully will not trigger any transition.
 * - `hidden` and `open` are kept aligned throughout the element's lifecycle, 
 * BUT, if the element is created via JS, the attribute will not be aligned 
 * until after the element is injected into the DOM
 * - *Requires a DOM environment* — not compatible with Node.js.
 * 
 */
export function Expandable<
    TBase extends Constructor<ExtendibleElement>
>(Base: TBase, OpenAttribute: string, OpenClass: string) {
    if (OpenAttribute in Base.prototype)
        throw new IllegalArgumentError("Cannot overwrite existing attribute " + OpenAttribute);
    return class ExpandableElement extends Base implements Expandable {

        constructor(...args: any[]) {
            super(...args);
            brand(this);
            _initPrivateProp(this, _lock, new Lock());
            _initPrivateProp(this, _scheduledCallbacks, new Set());
            _initPrivateProp(this, _pendingOnTransitionEnd, false);
        }
        get isLocked(): boolean { return _getPrivateProp(this, _lock).isLocked; };

        // OPEN ATTRIBUTE SETUP =============================================================

        public get [OpenAttribute](): boolean {
            return this.hasAttribute(OpenAttribute);
        }
        public set [OpenAttribute](value: boolean) {
            if (value) {
                this.setAttribute(OpenAttribute, '');
            } else {
                this.removeAttribute(OpenAttribute);
            }
        }
        public get isOpen(): boolean { return this[OpenAttribute]; }

        /** Element's observed attributes. */
        static get observedAttributes(): string[] {
            return [OpenAttribute, 'hidden'];
        }

        
        public [expandableOpenTransition](): void { }
        
        public [expandableCloseTransition](): void { }

        // Attribute related callbacks ==================================================
        connectedCallback(): void {
            this[OpenAttribute] ? this.classList.add(OpenClass) : this.classList.remove(OpenClass);
            this.hidden = !this[OpenAttribute];
        }
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
            if (
                name === OpenAttribute
                && typeof oldValue !== typeof newValue
            ) {
                _getPrivateProp(this, _lock).lock();
                if (newValue !== null) {
                    // OPEN
                    _handleOpening(this, OpenClass);
                    // this.handleOpening();
                } else {
                    // CLOSE
                    //this.handleClosing();
                    _handleClosing(this, OpenClass);
                }
                // LOCK RELEASE
                this.setupOnTransitionEnd();
                _setupOnTransitionEnd(this);

            } else if (
                name === 'hidden'
                && typeof oldValue !== typeof newValue
                && this[OpenAttribute] === this.hidden
            ) {
                this[OpenAttribute] = !this.hidden
            }
        }

        onTransitionEnd = () => null;
        public [expandableOnTransitionEnd](): void { }
        private setupOnTransitionEnd(): void {
        }

        // SHOW =========================================================================
        public show(...callbacks: (() => void)[]): void {
            if (_getPrivateProp(this, _lock).isLocked)
                throw new DOMException(
                    "Cannot open the element while a transition is in progress",
                    "InvalidStateError"
                );
            if (this[OpenAttribute]) {
                if (callbacks.length === 0) return; // second request without extra arguments quietly fails
                else throw new DOMException(
                    "Cannot schedule callbacks without a state change",
                    "InvalidStateError"
                );
            };
            _scheduleCallbacks(this, callbacks);
            this[OpenAttribute] = true;
        }
        // CLOSE ========================================================================
        public close(...callbacks: (() => void)[]): void {
            if (_getPrivateProp(this, _lock).isLocked)
                throw new DOMException(
                    "Cannot close the element while a transition is in progress",
                    "InvalidStateError",
                );
            if (!this[OpenAttribute]) {
                if (callbacks.length === 0) return; // second request without extra arguments quietly fails
                else throw new DOMException(
                    "Cannot schedule callbacks without a state change",
                    "InvalidStateError"
                );
            };
            _scheduleCallbacks(this, callbacks);
            this[OpenAttribute] = false;
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



// EXPORTED NAMESPACE ==================================================================
export namespace Expandable {
    /**
     * Validates an element as a `Expandable`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `Expandable`
     */
    export function getValidated(that: ExtendibleElement): Expandable {
        if (branded.has(that)) return that as Expandable;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${Expandable.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `Expandable`. */
const branded = new WeakSet();
/** Brands an element as an instance of `Expandable`. */
function brand(toBrand: Expandable) {
    branded.add(toBrand);
}