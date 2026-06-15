
import companionSharedConstants from '../../../config/companion-shared-constants.json' with { type: 'json' };
import { ElementWithLock, getValidatedElement, requestTransitionFrame } from '../common/utilities.js';

// TOGGLEABLE ELEMENT ===================================================================
/** CSS class utility to mark an open toggleable. */
const OPEN = companionSharedConstants.classes.common.isOpen;
/**
 * Generic Toggleable Element.
 * 
 * The class provides basic structure for handling an HTML element's
 * transition between hidden states.
 * 
 * States are switched by using `close()` and `open()` public methods;
 * an opening transition must complete to start a closing one and viceversa.
 * 
 * @remarks
 * - *Requires a DOM environment* — not compatible with Node.js.
 * - Must be instantiated after DOM is ready (`DOMContentLoaded`).
 * - create a custom getter for `this.ELEMENT` to use a different name for the element.
 * @example
 * class Modal extends ToggleableElement<HTMLDialogElement> {
 *    constructor(modalId, HTMLDialogElement) {
 *        super(modalId, 'modal', HTMLDialogElement)
 *    }
 * }
 * 
 * @see {@link TriggerElement} for associated controller class
 * @see {@link pairTriggerAndToggleable} for function to pair trigger and toggle 
 * (**the function expects derived classes to have resolved the generics**)
 */
export class ToggleableElement<
    H extends HTMLElement = HTMLElement
> extends ElementWithLock {
    /** Animated element. */
    protected readonly ELEMENT: H;
    private readonly _ID: string;
    
    /**
     * @param idOrEl - Id attribute or the element itself
     * @param elType - Type of the element (defaults to HTMLElement)
     * @see {@link getValidatedElement} for the function used for obtaining the element
     * @see {@link ElementWithLock} for the base class that provides the lock methods
     */
    constructor(
        idOrEl: string | H, 
        elType: new (...args: unknown[]) => H
    ) {
        super();
        this.ELEMENT = getValidatedElement(elType, idOrEl);
        this._ID = this.ELEMENT.id;
    }
    /** 
     * Sets `hidden` attribute of the element. 
     * @param hide - The new value for `hidden`
    */
    protected set hidden(hide: boolean) {
        this.ELEMENT.hidden = hide;
    }
    /**
     * Handles *end of transition* cleanup:
     * - hides the element if it doesn't have `OPEN` constant class
     * - releases transition lock
     */
    protected onTransitionEnd = (): void => {
        this.hidden = !this.ELEMENT.classList.contains(OPEN);
        this.unlock();
    }
    /** 
     * - Element exits `hidden` state
     * - Adds `OPEN` constant class
     * - Applies lock to the transition playing on the element
     */
    open() {
        if(this.isLocked) return;
        this.lock();
        this.hidden = false;
        requestTransitionFrame(() => this.ELEMENT.classList.add(OPEN));        
        this.ELEMENT.addEventListener('transitionend', this.onTransitionEnd, { once: true });
    }
    /** 
     * - Removes `OPEN` constant class
     * - Element enters `hidden` state at end of transition
     * - Applies lock to the transition playing on the element
     */
    close() {
        if(this.isLocked) return;
        this.lock();
        this.ELEMENT.classList.remove(OPEN);
        this.ELEMENT.addEventListener('transitionend', this.onTransitionEnd, { once: true });
    }   
    /** @returns element's id attribute. */
    get id() { return this._ID; }
}

/**Any HTMLElement that supports the `disabled` attribute */
interface HTMLDisableableElement extends HTMLElement {
    disabled: boolean
}

// TRIGGER ELEMENT ======================================================================
/**
 * Generic Trigger Element for a ToggleableElement.
 * 
 * The class provides basic structure for piloting a disclosing HTML element with transitions.
 * 
 * *Instantiating an object of this class or derivates will also initialize the trigger
 * to automatically toggle open/close on a `click` event.*
 * 
 * States can be switched manually by using `close()` and `open()` public methods;
 * an opening transition must complete to start a closing one and viceversa.
 * 
 * @remarks
 * - *Requires a DOM environment* — not compatible with Node.js.
 * - Must be instantiated after DOM is ready (`DOMContentLoaded`).
 * - create a custom getter for `this.trigger` to use a different name for the element.
 * @example
 * ```ts
 * class ModalTrigger extends TriggerElement<HTMLButtonElement> {
 *    constructor(id: string) {
 *        super(id, HTMLButtonElement, ModalElement);
 *    }
 * }
 * ```
 */
export class TriggerElement<
    D extends HTMLDisableableElement = HTMLDisableableElement,
    H extends ToggleableElement = ToggleableElement> {
    protected readonly trigger: D;
    protected readonly controlled: H;

    /**
     * @param idOrEl - Id attribute or the element itself.   
     * Requires an element with `diabled` attribute.
     * @param elType - Type of the trigger element.   
     * Defaults to HTMLElement.
     * @param ctrlObj - (optional) Controlled element (obtained from trigger's`aria-controls` otherwise)
     * @see {@link ToggleableElement} for full specifications on the controlled element
    */
    constructor(
        idOrEl: string | D, 
        elType: new (...args: unknown[]) => D,
        ctrlObj: H
    ) {
        this.trigger = getValidatedElement(elType, idOrEl);

        const controlledId = this.trigger.getAttribute('aria-controls');
        if(!controlledId) 
            throw new Error(`Trigger with id "${this.trigger.id}" does not have associated controlled element.`);
        if(ctrlObj && controlledId !== ctrlObj.id) 
            throw new Error(`Trigger's references different element than the one passed: ${controlledId} !== ${ctrlObj.id}`)
        
        this.controlled = ctrlObj;

        this.init();
    }
    /** 
     * sets trigger element's `aria-expanded` attribute (private; used by `open` and `close` methods)
     * @returns trigger element's `aria-expanded` attribute 
     */
    get expanded() { return this.trigger.getAttribute('aria-expanded') === 'true'; }
    private set expanded(isExpanded: boolean) {
        this.trigger.setAttribute('aria-expanded', String(isExpanded));
    }
    /** 
     * sets trigger element's `disabled` attribute (private; used by `disable` and `init` methods)
     * @returns trigger element's `disabled` attribute 
     */
    get disabled() { return this.trigger.disabled; }
    private set disabled(disable: boolean) { this.trigger.disabled = disable; }
    /**
     * - sets trigger's `aria-expanded` to `true`
     * - opens ToggleableElement
     */
    open(): void {
        if(this.controlled.isLocked) return;
        this.expanded = true;
        this.controlled.open();
    }
    /**
     * - sets trigger's `aria-expanded` to `false`
     * - closes ToggleableElement
     * @remarks leverages controlled's *lock*
     */
    close(): void {
        if(this.controlled.isLocked) return;
        this.expanded = false;
        this.controlled.close();
    }
    /**
     * Calls `open` or `close` methods depending on the `aria-expanded` attribute
     * @remarks
     * `this` refers to the `TriggerElement` intantiated object 
     * (arrow function is required to
     * mantain `this` as the object and not as an `Event`
     * when passed as callback)
     */
    toggle = (): void => this.expanded ? this.close() : this.open(); 
    /** Enable element and adds event listener for clicks. */
    private init() {
        this.disabled = false;
        this.trigger.addEventListener('click', this.toggle);
    }
    /** Disables the element and removes the event listener. */
    disable() {
        if(this.disabled) return;
        this.disabled = true;
        this.trigger.removeEventListener('click', this.toggle);
    }
}

// TOGGLEABLE + TRIGGER PAIRING FUNCTION ================================================
/**
 * Pairs a `TriggerElement` with compatible `ToggleableElement` using the trigger's `aria-controls` attribute
 * 
 * @param triggerIdOrEl - Id attribute of the trigger element or trigger element itself
 * @param triggerElType - Class of the trigger element (needed for type safety)
 * @param triggerChildClass - Child class of `TriggerElement` with estabilished `elType` and `ToggleableElement` derivate
 * @param ctrlChildClass - Child class of `ToggleableElement` with estabilished `elType`
 * @param ctrlChildClassInstance - (optional) Instance of the derived `ToggleableElement` to pair
 * @returns `TriggerElement` derived class instance with estabilished types
 * 
 * @remarks 
 * - *Expects derived classes of TriggerElement and ToggleableElement to no longer require type argument*
 * - *Optional parameter (if passed) MUST have `id` equal to `aria-controls` attribute of the trigger!*
 * 
 * @throws {Error} If `triggerIdOrEl` does not point to any element in the document
 * @throws {Error} If `triggerEl` is not an instance of `triggerElType` as requested
 * @throws {Error} If trigger has no `aria-controls`
 * @throws {Error} If optional parameter is passed but does not match trigger's `aria-controls`
 * 
 * @example
 * ```ts
 * const trigger = pairTriggerAndToggleable(
 *     'toggle-dropdown-btn-id',
 *     HTMLButtonElement,
 *     DropdownTrigger,
 *     Dropdown
 * );
 * ```
 * @example
 * ```ts
 * const but = document.getElementById('btn-el');
 * if(!(but instanceof HTMLButtonElement)) throw new Error;
 * // DropdownTrigger< HTMLButtonElement, Dropdown >
 * const trigger = pairTriggerAndToggleable(
 *     but,
 *     HTMLButtonElement,
 *     DropdownTrigger,
 *     Dropdown
 * );
 * ```
 * 
 * @see {@link TriggerElement} for specifics about trigger's class and how to properly extend it
 * @see {@link ToggleableElement} for specifics about toggleable's class and how to properly extend it
 */
export default function pairTriggerAndToggleable<
    D extends HTMLDisableableElement,
    H extends ToggleableElement,
    T extends TriggerElement<D, H>
>(
    triggerIdOrEl: string | D,
    triggerElType: new (...args: unknown[]) => D,
    triggerChildClass: new (idOrEl: string | D, controlled: H) => T,
    ctrlChildClass: new (idOrEl: string) => H,
    ctrlChildClassInstance?: H
): T {

    const triggerEl = typeof triggerIdOrEl === 'string' 
        ? document.getElementById(triggerIdOrEl)
        : triggerIdOrEl;
    if (!(triggerEl instanceof triggerElType)) 
        throw new Error(`Trigger "${triggerIdOrEl}" ${triggerEl ? 'is not of required type' : 'not found'}.`);

    const controlledId = triggerEl.getAttribute('aria-controls');
    if (!controlledId) throw new Error(`Trigger "${triggerIdOrEl}" has no aria-controls.`);

    if(ctrlChildClassInstance) {
        if(ctrlChildClassInstance.id !== controlledId)
            throw new Error(`Instance of ${ctrlChildClass.name} does not match trigger's "aria-controls" attribute.`);
    }

    const controlled = ctrlChildClassInstance ?? new ctrlChildClass(controlledId);
    return new triggerChildClass(triggerIdOrEl, controlled);
}