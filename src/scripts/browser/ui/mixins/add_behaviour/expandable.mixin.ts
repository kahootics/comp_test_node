import { IllegalArgumentError, ValidationError } from "../../../../../errors/common-errors.mjs";
import { createMixin } from "../../../../../tools/create-mixin.mjs";
import type { Constructor } from "../../../../../tools/create-mixin.mjs";
import { _getPrivateProp, _initPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.mjs";
import { ExpandableChangeEvent, expandableChangeEvent } from "./expandable-change-event.js";

// EXTENDED CONSTRUCTOR ================================================================
type Constructed = HTMLElement & {
    connectedCallback?(): void;
    attributeChangedCallback?(n: string, o: string | null, v: string | null): void;
}
// CONTROLLER OPTIONS ==================================================================

// NOTE: 
// implement aria behaviour and roles according to listeners (?)
// Tooltip closes if external to controller (should not close when hovering on expandable)
/* Overload types to prevent toggle and forceshow on hover/focus events. */
export interface ControllerOptions {
    /** Toggles the expandable on click of the controller. */
    toggleOnClick?: boolean;
    /** Shows the expandable while pointer is hovering the controller. */
    showOnHover?: boolean;
    /** 
     * Shows the expandable while the controller is focused. 
     * 
     * @remarks
     * The controller element must be focusable for this setting to work.
     */
    showOnFocus?: boolean;
}
interface ControllerListeners {
    abortController: AbortController | null;
}
// MIXIN PUBLIC INTERFACE ==============================================================
export interface Expandable extends HTMLElement {
    // Hooks for derived classes to add class-scoped 
    // behaviour to the three moments of the transition
    /** 
     * @protected 
     * Hook method for derivate mixin and classes to append 
     * behaviour to the opening process.
     * 
     * The function is called synchronously after the beginning of 
     * the state change transition, right after 'open' attribute and class have mutated.
     * 
     * @remarks
     * If any changes to style properties with associated 
     * transition animations are made by this function,
     * those transitions will play.   
     * The function is not called: 
     * - if the state change is immediately reverted 
     * as a response to the 'change(open,start)' event,
     * - on connect.
     */
    _onExpandableOpen?(): void;
    /** @protected */
    _onExpandableClose?(): void;
    /** @protected */
    _onExpandableTransitionEnd?(): void;

    /** Indicates whether the element is in open logical state. */
    open: boolean;
    /** Indicates the visual state of the expandable element. */
    readonly expanded: boolean;

    /** 
     * - Element exits `hidden` state,
     * - Adds `OPEN` css class (separated moment from exiting `hidden`)
     * - The hook protected method `_onExpandableOpen` is called.
     * - At the end of the transition, the hook protected method 
     * {@link _onExpandableTransitionEnd} is called.
     * 
     * @returns a promise containing 
     * `true` if the transition completed successfully, 
     * `false` if the transition was reversed.
     * 
     * @remarks 
     * - If called while the element is already open it will 
     * resolve immediately (and change nothing).
     * - If called while the element is in an opening transition:
     * no new 'start' event will be fired and that transition's
     * promise will be returned,
     * - If called while the element is in a closing transition:
     * a new 'start' event will be fired and the old transition's
     * promise will resolve (as `false`) and a new one will be returned.
     */
    show(): Promise<boolean>;
    /**  
     * - Removes `OPEN` css class,
     * - The hook protected method `_onExpandableClose`} is called.
     * - Element enters `hidden` state at end of transition(s) if any (immediately if none),
     * - At the end of the transition, the hook protected method 
     * `_onExpandableTransitionEnd` is called.
     * 
     * @returns a promise containing 
     * `true` if the transition completed successfully, 
     * `false` if the transition was reversed
     * 
     * @remarks 
     * - If called while the element is already closed it will 
     * resolve immediately (and change nothing).
     * - If called while the element is in a closing transition:
     * no new 'start' event will be fired and that transition's
     * promise will be returned,
     * - If called while the element is in an opening transition:
     * a new 'start' event will be fired and the old transition's
     * promise will resolve (as `false`) and a new one will be returned.
     */
    close(): Promise<boolean>;
    /**
     * Calls either `show` or `close` on the element
     * depending on its current state.
     * 
     * @remarks 
     * This is an arrow function, so it can be safely used in place of a callback.
     */
    readonly toggle: () => Promise<boolean>;

    /** 
     * @internal
     * Handles attribute changes. 
     * 
     * Triggers a change in the expandable state when
     * either `open` or `hidden` attribute are changed.
     *  
     * @param name - Name of the attribute.
     * @param oldValue - Pre-change value.
     * @param newValue - After-change value.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
    /** 
     * @internal 
     * On injection in DOM, aligns `hidden` and `open` attributes and class (css). 
     */
    connectedCallback(): void;

    /**
     * Sets an element as controller for the expandable; also gives
     * the option to initialize an event listner to toggle it on a
     * click of any of its controllers.
     * 
     * @remarks 
     * - The `aria-controls` and `aria-expanded` attributes of the 
     * controllers are handled automatically.
     * - This method doesn't read any attribute from the controller;
     * changing `aria-expanded` on it won't trigger a transition.
     * 
     * @param newController - HTMLElement to set as a controller for the expandable element.
     * @param options.addListener - Option to automatically add an event listener (for `click` events) on the specified controller to toggle the expandable.
     */
    addController(newController: HTMLElement, options?: ControllerOptions): void;
    /**
     * Removes an element from the expandable's controllers list 
     * and outputs the result of such operation.
     * 
     * @remarks
     * - If the controller has a registered listener (set from `addController`),
     * it will be removed by this operation.
     * - If the controller has a listener, but it was set manually outside of `addController`,
     * it will *NOT* be removed by this operation.
     * 
     * @param controller - HTMLElement to remove from the expandable's controllers list.
     * @returns a boolean value representing the outcome of the operation (`true` if successful, `false` if the controller could not be removed, because it was never set as one).
     */
    removeController(controller: HTMLElement): boolean;
    /**
     * @returns `true` if the specified element is registered 
     * as a controller for this expandable.
     */
    isController(controller: HTMLElement): boolean;
    /**
     * @returns `true` if the specified node is a controller
     * for this expandable or one of its descendants.
     */
    isInController(n: Node): boolean;
}

// PRIVATE PROPERTIES ==================================================================
type isListening = boolean & {
    readonly __brand: 'is-listening'
};
/** 
 * Map of registered controllers for the expandable; 
 * each one has an associated boolean indicating whether 
 * a listener was registered for them during initialization. 
 */
const _controllers = new SetOnceWeakMap<Expandable, Map<HTMLElement, ControllerListeners>>();

interface Transition { readonly finished: Promise<boolean> }
/**
 * Ongoing transition object of the expandable; it only
 * has a `finished` property that indicates its state.
 * 
 * This object is `undefined` if no transition from
 * an expandable change has been triggered.
 */
const _currentTransition = new WeakMap<Expandable, Transition>();

// INNER PRIVATE METHODS ===============================================================
/**
 * @unchecked
 * Dispatches an `ExpandableChangeEvent` from `self` 
 * using the given `open` and `stage` parameters.
 */
function _dispatchChangeEvent(
    self: Expandable,
    open: ExpandableChangeEvent['open'],
    stage: ExpandableChangeEvent['stage']
): boolean {
    return self.dispatchEvent(
        new ExpandableChangeEvent(expandableChangeEvent, { open, stage })
    );
}

/**
 * @unchecked
 * Concludes the transition (early exit if the transition is not the current one)
 * by setting the `hidden` attribute to the opposite of `open`,   
 * calling the hook function and dispatching the 'end' event.
 * @returns `true` if the transition it was given has come to an end;
 * `false` if it did not finish.
 */
function _endTransition(self: Expandable, transition: Transition): boolean {
    if (_currentTransition.get(self) !== transition) return false;
    _currentTransition.delete(self);
    const open = self.open;
    self.hidden = !open;
    self._onExpandableTransitionEnd?.();
    _dispatchChangeEvent(self, open, 'end');
    return true;
}

/**
 * @unchecked
 * Updates all the registered controllers'
 * `aria-expanded` attributes to the element's
 * `open` state.
 */
function _updateControllers(self: Expandable) {
    const controllers = _getPrivateProp(self, _controllers);
    const expanded = String(self.open);
    controllers.forEach((_, c) => c.setAttribute('aria-expanded', expanded));
}

// PRIVATE METHODS =====================================================================
/**
 * Transition is handled as follows:
 * 1. the current transition promise is created and deferred,
 * 2. all the ongoing animations are registered (to make 
 * sure the transitions happening after the change only include new ones),
 * 3. 'start' event is dispatched; should the event trigger another change in response,
 * an early exit (1), that will immediately resolve the transition promise 
 * to `false`, is in place to defend against such behaviour, 
 * 4. `hidden` and the class 'OpenClass' are handled to begin 
 * an opening/closing transition as estabilished by the class,
 * 5. the expandable hook functions are called 
 * (which one is called depends on the type of change),
 * 6. all registered controllers are updated (@see {@link _updateControllers}),
 * 7. all *now* ongoing transitions are stored; any transition
 * that was happening before the change of state is filtered out,
 * 8. if no transition remains, an early exit (2) closes the operation
 * and resolves the transition promise to `true`,
 * 9. once all transitions have settled,the method {@link _endTransition}
 * is called, it will resolve the transition promise and set
 * the expandable to its destination state.
 */
function _startTransition(self: Expandable): void {
    Expandable.assertBranded(self);

    // INITIAL STATE READING ============================================
    let defer: (value: boolean | PromiseLike<boolean>) => void;
    const promise = new Promise<boolean>((resolve) => defer = resolve);
    const transition: Transition = {
        finished: promise
    };
    _currentTransition.set(self, transition);
    const open = self.open;
    const before = new Set(self.getAnimations());

    // INITIATE =====================================================
    _dispatchChangeEvent(self, !open, 'start'); // gives old 'open'
    // Defense against transitions started in response to 'start' event
    if (_currentTransition.get(self) !== transition) {
        defer!(false);
        return; // Early exit (1)
    };

    // TRANSITION ==================================================
    if (open) {
        self.hidden = false;
        void getComputedStyle(self).opacity;
        self.toggleAttribute('expanded', true);
        self._onExpandableOpen?.();
    } else {
        self.toggleAttribute('expanded', false);
        self._onExpandableClose?.();
    }
    _updateControllers(self);

    // DETERMINE END OF TRANSITION ==================================
    const running = self.getAnimations()
        .filter(a => a instanceof CSSTransition && !before.has(a));
    if (running.length === 0) {
        defer!(_endTransition(self, transition));
        return; // Early exit (2)
    }

    Promise.allSettled(running.map(t => t.finished))
        .then(() => defer(_endTransition(self, transition)));
}

/**
 * @returns the promise of the current transition; 
 * `true` once it has completed running,
 * `false` if it was reverted.
 */
function _getCurrentTransitionState(self: Expandable): Promise<boolean> {
    Expandable.assertBranded(self);
    return _currentTransition.get(self)?.finished ?? Promise.resolve(true);
}

/**
 * Ensures the element has a non-blank id attribute.
 */
function _ensureId(self: Expandable): void {
    Expandable.assertBranded(self);
    if (self.id) return;
    self.id = `expandable-${(Math.random() * 5).toFixed(0)}`;
}

// HELPERS FUNCTIONS ===================================================================
/**
 * 
 * @returns an array containing all the ids of the element's 'aria-controls' attribute.
 */
function getControlledIds(el: Element): string[] {
    return el.getAttribute('aria-controls')?.split(/\s+/).filter(Boolean) ?? [];
}
/**
 * Sets the element's 'aria-controls' attribute to be the list of specified ids.
 */
function setControlledIds(el: Element, ids: string[]): void {
    if (ids.length) el.setAttribute('aria-controls', ids.join(' '));
    else el.removeAttribute('aria-controls');
}

// NOTE: make abort controller optional (nothing to abort)
/**
 * Implements the events listeners from the given options for the controller 
 * and binds an abort signal to each.
 * @returns the abort controller that holds the signal of all the added events.
 */
function _implementControllerOptions(
    self: Expandable,
    controller: HTMLElement,
    options: ControllerOptions
): AbortController | null {
    Expandable.assertBranded(self);
    const { toggleOnClick, showOnFocus, showOnHover } = options;

    let abortController: AbortController | null = null;

    if (toggleOnClick) {
        const { signal } = abortController ?? (abortController = new AbortController());
        controller.addEventListener('click', (e: Event) => {
            if (e.target instanceof Node && self.contains(e.target)) return;
            self.toggle();
        }, { signal });
    }
    if (showOnFocus) {
        const { signal } = abortController ?? (abortController = new AbortController());
        implementShowOnFocus(self, controller, signal);
    }
    if (showOnHover) {
        const { signal } = abortController ?? (abortController = new AbortController());
        implementShowOnHover(self, controller, signal);
    }

    return abortController;
}

function implementShowOnFocus(self: Expandable, controller: HTMLElement, signal: AbortSignal) {
    controller.addEventListener('focusin', () => {
        if (controller.contains(document.activeElement)) {
            self.show();
            controller.addEventListener('focusout',
                () => self.close(), { once: true, signal });
        }
    }, { signal });
}

function implementShowOnHover(self: Expandable, controller: HTMLElement, signal: AbortSignal) {
    controller.addEventListener('mouseenter', () => {
        self.show();
    }, { signal });
    controller.addEventListener('mouseleave', () => self.close(), { signal });
}

// MIXIN FUNCTION ======================================================================
// Add usage baseline 
// (min 2021 as per signal in addListener options; 2020 for custom elements)
// Add component general desc
/**
 * 
 * Generic branded Expandable Element.
 * 
 * The class provides basic structure for handling an HTML element's
 * transition between hidden and visible states; 
 * refer to the configurable `OPEN` class (css) for transitions.
 * 
 * @param Base - Base class on which the mixin will be implemented.
 * @param OpenClass - Class that handles the states transition (defaults to `'is-open'`).
 * @returns an extension of the Base class implementing the interface `Expandable`.
 * @see {@link Expandable} for full documentation on the available methods.
 * 
 * @remarks
 * State can be changed by using **`close()`**, **`show()`** or **`toggle()`** public methods
 * or by changing the `open` attribute (changing the attribute will not provide feedback on the results);
 * - "transitions" include any css transition happening after the change has triggered,
 * - any transition will be reverted if the opposite one is called while it is still occurring,
 * - an {@link ExpandableChangeEvent} is dispatched at the beginning 
 * and end of each transition carrying the state of the element at the 
 * moment the attribute change/method call happened/resolved, 
 * but note that a transition that is reverted won't fire any 'end' event.
 * - `hidden` and `open` are kept aligned throughout the element's lifecycle, 
 * *BUT*, if the element is created via script, the attributes will not be aligned 
 * until *after* the element has been injected into the DOM.
 * - *Requires a DOM environment* — not compatible with Node.js.
 * 
 */
export const Expandable = createMixin<
    Constructed, Expandable
>('Expandable', (brand) => <
    TBase extends Constructor<Constructed> & {
        observedAttributes?: readonly string[]
    }
>(Base: TBase) => {
    if ('open' in Base.prototype)
        throw new IllegalArgumentError(
            `Cannot overwrite existing attribute "open" in class ${Base.name}`
        );

    return class ExpandableElement extends Base implements Expandable {

        constructor(...args: any[]) {
            super(...args);
            brand.add(this);
            _initPrivateProp(this, _controllers, new Map());
        }

        // OPEN ATTRIBUTE SETUP =============================================================
        public get open(): boolean {
            return this.hasAttribute('open');
        }
        public set open(v: boolean) {
            this.toggleAttribute('open', v);
        }

        public get expanded(): boolean {
            return this.hasAttribute('expanded');
        }

        public get controlledby(): string[] {
            return this.getAttribute('controlledby')?.split(' ') ?? [];
        }

        /** Element's observed attributes. */
        static override get observedAttributes(): string[] {
            return [
                ...(super.observedAttributes ?? []),
                'open', 'hidden', 'controlledby'
            ];
        }

        // ATTRIBUTE RELATED CALLBACKS ==================================================
        override connectedCallback(): void {
            super.connectedCallback?.();
            _ensureId(this);
            this.toggleAttribute('expanded', this.open);
            this.hidden = !this.open;
            if (this.controlledby.length > 0)
                this.controlledby.forEach((cI) => {
                    const el = document.getElementById(cI);
                    //if (el) console.log(el)
                    if (el) this.addController(el, { toggleOnClick: true });
                });
            _updateControllers(this);
        }
        override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
            super.attributeChangedCallback?.(name, oldValue, newValue);
            if (
                name === 'open' &&
                (oldValue === null) !== (newValue === null)
            ) {
                if (!this.isConnected) return;
                _startTransition(this);
            } else if (
                name === 'hidden'
                && (oldValue === null) !== (newValue === null)
                && this.open === this.hidden
            ) {
                this.open = !this.hidden
            } else if (
                name === 'controlledby'
            ) {
                const remove = oldValue?.split(' ') ?? [];
                this.controlledby.forEach((cI) => {
                    const el = document.getElementById(cI);
                    if (el) {
                        this.addController(el, { toggleOnClick: true });
                        const I = remove.indexOf(cI);
                        if (I > 0) remove.splice(I, 1);
                    }
                });
                remove.forEach((rI) => {
                    const el = document.getElementById(rI);
                    if (el)
                        this.removeController(el)
                })
            }
        }

        // SHOW =========================================================================
        public show(): Promise<boolean> {
            this.open = true;
            return _getCurrentTransitionState(this);
        }

        // CLOSE ========================================================================
        public close(): Promise<boolean> {
            this.open = false;
            return _getCurrentTransitionState(this);
        }

        // TOGGLE =======================================================================
        public readonly toggle = (): Promise<boolean> => {
            this.open = !this.open;
            return _getCurrentTransitionState(this);
        }

        // CONTROLLER SETUP ==============================================================
        public addController(newController: HTMLElement, options: ControllerOptions = {}): void {

            // Hard Unallow auto controlling
            if (this === newController)
                throw new IllegalArgumentError(`An expandable cannot connot control itself`);

            const controllers = _getPrivateProp(this, _controllers);
            // Reset
            if (controllers.has(newController)) this.removeController(newController);

            // Add expandable's Id to aria-controls controller's list
            const controlsIds = getControlledIds(newController);
            if (!controlsIds.includes(this.id)) controlsIds.push(this.id);
            setControlledIds(newController, controlsIds);
            // Init aria expanded
            newController.setAttribute('aria-expanded', String(this.open));

            // Setup listener options
            const abortController = _implementControllerOptions(this, newController, options);

            // Finally register the controller
            controllers.set(newController, { abortController });
        }

        public removeController(controller: HTMLElement): boolean {
            const controllers = _getPrivateProp(this, _controllers);
            const { abortController } = controllers.get(controller) ?? {};

            if (abortController !== undefined) {

                // Abort all listeners on the controller
                abortController?.abort();

                // Remove expandable from aria-controls list
                const controlsIds = getControlledIds(controller);
                const i = controlsIds.indexOf(this.id)
                if (i >= 0) {
                    controlsIds.splice(i, 1);
                    setControlledIds(controller, controlsIds);
                    controller.removeAttribute('aria-expanded');
                }
            }
            return controllers.delete(controller);
        }

        public isController(controller: HTMLElement): boolean {
            return _getPrivateProp(this, _controllers).has(controller)
        }
        public isInController(n: Node): boolean {
            const controllers = _getPrivateProp(this, _controllers).keys();
            for (const controller of controllers) {
                if (controller.contains(n)) return true;
            }
            return false;
        }
    }
});