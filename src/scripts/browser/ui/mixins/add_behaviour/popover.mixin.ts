import { createMixin } from "../../../../../tools/create-mixin.mjs";
import { _getPrivateProp, _initPrivateProp, _setPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.mjs";
import { ContextStack } from "../../../utilities/context-stack.js";
import { Expandable } from "./expandable.mixin.js";
import type { Constructor } from "../../../../../tools/create-mixin.mjs";
import { getAllFocusables } from "../../../utilities/get-focusable-extremities.js";

// MIXIN PUBLIC INTERFACE ==============================================================
export interface Popover extends Expandable {
    /**
     * @override
     * @inheritdoc
     * 
     */
    _onExpandableOpen(): void
    /**
     * @override
     * @inheritdoc
     * 
     */
    _onExpandableClose(): void
}

// PRIVATE FIELDS ======================================================================
/** Controller of events. */
const _controller = new WeakMap<Popover, AbortController | null>();
/** 
 * Closes element on pressing somewhere outside the element.   
 * Inner popovers are closed on cascade.   
 * Controllers for the popover are considered out of bounds,
 * but they would close the popover naturally, so they are
 * ignored here.
 */
function _closeWhenOutOfBounds(self: Popover, e: MouseEvent) {
    Popover.assertBranded(self);
    if (
        e.target instanceof Node
        && !self.contains(e.target)
        && !self.isInController(e.target)
    ) {
        Popover.stack.above(self).forEach(
            inner => Popover.isInstance(inner) && inner.close()
        );
        self.close();
    }
}
/** Closes top element on pressing `Escape`. */
function _closeOnEscape(self: Popover, e: KeyboardEvent) {
    Popover.assertBranded(self);
    if (e.key === 'Escape' && Popover.stack.isTop(self)) self.close();
}
/** Last focused element before focus trap activation. */
const _lastFocus = new WeakMap<Popover, HTMLElement | null>();

function _firstFocusableChild(el: HTMLElement): HTMLElement {
    const children = getAllFocusables(el);
    for (const child of children) {
        if (child instanceof HTMLElement)
            return child;
    }
    return el;
}

const DEFAULT_STACK_VAR = '--popover-order';
const STACK = new ContextStack(DEFAULT_STACK_VAR);
// MIXIN FUNCTION ======================================================================
/**
 * Generic popover element.
 * 
 * When open:
 * - if `Escape` is pressed, it closes
 * - if somewhere out of the element is clicked, it closes
 * 
 * @see {@link Expandable} for base behaviour
 */
export const Popover = createMixin<
    Expandable, Popover, { stack: ContextStack, defaultVar: typeof DEFAULT_STACK_VAR }
>('Popover', (brand) => <
    TBase extends Constructor<Expandable>
>(Base: TBase) => {
    return class PopoverElement extends Base implements Popover {

        constructor(...args: any[]) {
            super(...args);
            brand.add(this);

            _initPrivateProp(this, _controller, null);
            _initPrivateProp(this, _lastFocus, null);
        }

        override connectedCallback(): void {
            super.connectedCallback?.();
            this.setAttribute('tabindex', '-1');
        }

        override _onExpandableOpen(): void {
            super._onExpandableOpen?.();
            // Register focus
            const element = document.activeElement;
            _setPrivateProp(this, _lastFocus,
                element instanceof HTMLElement
                    ? element : null
            );

            // Set own Stack order
            Popover.stack.push(this);

            // Setup listeners
            const signal = _setPrivateProp(this, _controller, new AbortController()).signal;
            document.addEventListener(
                'keydown',
                (e: KeyboardEvent) => _closeOnEscape(this, e),
                { signal: signal }
            );
            document.addEventListener(
                'mousedown',
                (e: MouseEvent) => _closeWhenOutOfBounds(this, e),
                { signal: signal }
            );
        }
        override _onExpandableClose(): void {
            super._onExpandableClose?.();
            // Stop listeners
            _getPrivateProp(this, _controller)?.abort();
            _setPrivateProp(this, _controller, null);
            // Give back focus
            const last = _getPrivateProp(this, _lastFocus);
            if (last) last.focus();
            _setPrivateProp(this, _lastFocus, null);
        }
        override _onExpandableTransitionEnd(): void {
            super._onExpandableTransitionEnd?.();
            if (!this.open)
                Popover.stack.remove(this)
            /* else { 
                const f= _firstFocusableChild(this);
                f.focus()
            } */
        }
    }
}, {
    get stack() { return STACK; },
    get defaultVar(): typeof DEFAULT_STACK_VAR { return DEFAULT_STACK_VAR }
});

/* 
* Stacking context to stack popovers on on the other when native popover is not implemented. 
* @remarks
* Assumes Popover has highest stacking context in document.
*/