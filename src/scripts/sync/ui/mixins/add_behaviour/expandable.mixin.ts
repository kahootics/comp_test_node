import { IllegalArgumentError, ValidationError } from "../../../../../errors/common-errors.mjs";
import type { Brand, Closeable, Showable } from "../../../../types/general-types.js";
import type { ExtendibleElement } from "../../components/extendible-element.js";
import { requestTransitionFrame } from "../../../shared/utilities.js";
import { Lock } from "../../../shared/lock.js";
import { _getPrivateProp, _initPrivateProp, _setPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.js";


// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends object> = new (...args: any[]) => T;

// OBFUSCATED PROPERTIES ===============================================================
/** Executes during opening transition. */
export const expandableOpenTransition: unique symbol = Symbol('expandableOpenTransition');
/** Executes during closing transition. */
export const expandableCloseTransition: unique symbol = Symbol('expandableCloseTransition');
/** Executes after transition has ended. */
export const expandableOnTransitionEnd: unique symbol = Symbol('expandableOnTransitionEnd');

// MIXIN PUBLIC INTERFACE ==============================================================
/** Methods `show` and `close`. */
export interface ExpandableToggles extends Closeable, Showable {
    /** 
     * - Element exits `hidden` state,
     * - Adds `OPEN` constant class,
     * - schedules callbacks for execution,
     * - Applies lock to the transition playing on the element.
     * 
     * @param callbacks - Allows scheduling any amount of callback functions
     * that will be called at end of transition.
     * 
     * @throws {DOMException} If called while another opening/closing transition is in progress.
     * @throws {DOMException} If called with arguments while the element is already open.
     * 
     * @remarks quietly fails if called with no arguments while the element is already open.
     * 
     */
    show(...callback: (() => void)[]): void;
    /**  
     * - Removes `OPEN` constant class,
     * - schedules callbacks for execution,
     * - Element enters `hidden` state at end of transition,
     * - Applies lock to the transition playing on the element.
     * 
     * @param callbacks - Allows scheduling any amount of callback functions
     * that will be called at end of transition.
     * 
     * @throws {DOMException} If called while another opening/closing transition is in progress. 
     * @throws {DOMException} If called with arguments while the element is already closed.
     * 
     * @remarks quietly fails if called with no arguments while the element is already closed.
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
     * but safely returns `false` instead of throwing `Error`.
     */
    safeCall(
        call: keyof Expandable,
        ...callbacks: (() => void)[]
    ): boolean;

    /**
     * Calls either `show` or `close` on the element
     * depending on its current state.
     * 
     * @throws {DOMException} If called while another opening/closing transition is in progress.
     * 
     * @remarks 
     * This is an arrow function, so it can be safely used in place of a callback.
     */
    toggle: () => void;

    /** 
     * Handles attribute changes. 
     * 
     * On change of `open`, 
     * if the attribute
     *  
     * @param name - Name of the attribute.
     * @param oldValue - Pre-change value.
     * @param newValue - After-change value.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
    /** On injection in DOM, align `hidden` and `open` attributes and class. */
    connectedCallback(): void;
}

// HELPERS =============================================================================
function throwDOMException(message: string): never {
    throw new DOMException(
        message,
        "InvalidStateError");
}

// PRIVATE FIELDS ======================================================================
const _lock = new SetOnceWeakMap<Expandable, Lock>();
const _scheduledCallbacks = new SetOnceWeakMap<Expandable, Set<() => void>>();

/* Schedules a set of callback functions to be executed at the end of the transition. */
function _scheduleCallbacks(self: Expandable, callbacks: (() => void)[]) {
    _assertBranded(self);
    const set = _getPrivateProp(self, _scheduledCallbacks);
    for (const callback of callbacks) {
        set.add(callback);
    }
}

/** 
 * Adds `OPEN` class in an AnimationFrame requested after setting `hidden` to `false`.
 * 
 * @remarks
 * Extra behaviour can be added by using the symbol public method keyed with `expandableOpenTransition`.
 */
function _handleOpening(self: Expandable, OpenClass: string): void {
    _assertBranded(self);
    self.hidden = false;
    requestTransitionFrame(() => {
        self.classList.add(OpenClass);
    });
    self[expandableOpenTransition]();
}
/** 
 * Removes `OPEN` class. 
 * 
 * @remarks
 * Extra behaviour can be added by using the symbol public method keyed with `expandableCloseTransition`.
 */
function _handleClosing(self: Expandable, OpenClass: string): void {
    _assertBranded(self);
    self.classList.remove(OpenClass);
    self[expandableCloseTransition]();
}

/** Indicates whether a 'ontransitionend' handler is already set. */
const _pendingOnTransitionEnd = new WeakMap<Expandable, boolean>();
/**
 * @unchecked
 * Handles *end of transition* cleanup:
 * - hides the element if it doesn't have `open` attribute,
 * - calls all pending callbacks safely,
 * - empties pending callbacks,
 * - releases transition lock.
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
    // Release resources:
    callbacks.clear();
    _setPrivateProp(self, _pendingOnTransitionEnd, false);
    _getPrivateProp(self, _lock).unlock();
}

/** Activates a one-time listener for the end of transition operations. */
function _setupOnTransitionEnd(self: Expandable) {
    _assertBranded(self);
    _updateControllers(self);
    if (_getPrivateProp(self, _pendingOnTransitionEnd)) return;
    _setPrivateProp(self, _pendingOnTransitionEnd, true);
    self.addEventListener('transitionend', () => _onTransitionEnd(self), { once: true });
}

type isListening = Brand<boolean, 'is-listening'>;
const _controllers = new WeakMap<Expandable, Map<HTMLElement, isListening>>();

/**
 * @unchecked
 * Updates all the registered controllers'
 * `aria-expanded` attribute to the element's
 * `isOpen` state
 */
function _updateControllers(self: Expandable) {
    const controllers = _getPrivateProp(self, _controllers);
    const expanded = String(self.isOpen);
    controllers.forEach((_, c) => c.setAttribute('aria-expanded', expanded));
}

// MIXIN FUNCTION ======================================================================
/**
 * Generic branded Expandable Element.
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
            _brand(this);
            _initPrivateProp(this, _lock, new Lock());
            _initPrivateProp(this, _scheduledCallbacks, new Set());
            _initPrivateProp(this, _pendingOnTransitionEnd, false);
            _initPrivateProp(this, _controllers, new Map());
        }
        public get isLocked(): boolean { return _getPrivateProp(this, _lock).isLocked; };

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

        // Hooks for derivate classes
        public [expandableOpenTransition](): void { }
        public [expandableCloseTransition](): void { }
        public [expandableOnTransitionEnd](): void { }

        // Attribute related callbacks ==================================================
        connectedCallback(): void {
            this.isOpen ? this.classList.add(OpenClass) : this.classList.remove(OpenClass);
            this.hidden = !this.isOpen;
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
                } else {
                    // CLOSE
                    _handleClosing(this, OpenClass);
                }
                // LOCK RELEASE
                _setupOnTransitionEnd(this);

            } else if (
                name === 'hidden'
                && typeof oldValue !== typeof newValue
                && this.isOpen === this.hidden
            ) {
                this[OpenAttribute] = !this.hidden
            }
        }

        // SHOW =========================================================================
        public show(...callbacks: (() => void)[]): void {
            if (_getPrivateProp(this, _lock).isLocked)
                throwDOMException("Cannot open the element while a transition is in progress");
            if (this.isOpen) {
                if (callbacks.length === 0) return; // second request without extra arguments quietly fails
                throwDOMException("Cannot schedule callbacks without a state change");
            };
            _scheduleCallbacks(this, callbacks);
            this[OpenAttribute] = true;
        }

        // CLOSE ========================================================================
        public close(...callbacks: (() => void)[]): void {
            if (_getPrivateProp(this, _lock).isLocked)
                throwDOMException("Cannot close the element while a transition is in progress");
            if (!this.isOpen) {
                if (callbacks.length === 0) return; // second request without extra arguments quietly fails
                throwDOMException("Cannot schedule callbacks without a state change");
            };
            _scheduleCallbacks(this, callbacks);
            this[OpenAttribute] = false;
        }

        // TOGGLE =======================================================================
        public toggle = (): void => {
            if (this.isOpen) this.close();
            else this.show();
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

        // CONTROLLER SETUP ==============================================================
        public addController(newController: HTMLElement, addListener?: boolean): void {
            const controllers = _getPrivateProp(this, _controllers)
            const isListening = (addListener ?? false) as isListening;
            if (!controllers.has(newController))
                controllers.set(newController, isListening);

            newController.setAttribute('aria-controls', this.id);
            newController.setAttribute('aria-expanded', String(this.isOpen));
            if (isListening) newController.addEventListener('click', this.toggle);
        }
        public removeController(controller: HTMLElement): boolean {
            const controllers = _getPrivateProp(this, _controllers);
            const isListening = controllers.get(controller);
            if (isListening) controller.removeEventListener('click', this.toggle);
            return controllers.delete(controller);
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
function _assertBranded(instance: Expandable): true {
    if (branded.has(instance)) return true;
    throw new TypeError("Cannot access private member");
}
/** Brands an element as an instance of `Expandable`. */
function _brand(instance: Expandable) {
    branded.add(instance);
}