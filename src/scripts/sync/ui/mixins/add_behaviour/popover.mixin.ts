import { assert } from "node:console";
import { ValidationError } from "../../../../../errors/common-errors.mjs";
import { _getPrivateProp, _initPrivateProp } from "../../../../../tools/encapsulation.js";
import { Expandable, expandableCloseTransition, expandableOpenTransition } from "./expandable.mixin.js";

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends object> = new (...args: any[]) => T;

// MIXIN PUBLIC INTERFACE ==============================================================
export interface Popover extends Expandable {
}

// PRIVATE FIELDS ======================================================================
/** Controller of events. */
const _controller = new WeakMap<Popover, AbortController>();
/** Closes element on pressing somewhere outside the element. */
function _closeWhenOutOfBounds(self: Popover, e: MouseEvent) {
    _assertBranded(self);
    if (e.target instanceof Node &&
        !self.contains(e.target)) self.close();
}
/** Closes element on pressing `Escape`. */
function _closeOnEscape(self: Popover, e: KeyboardEvent) {
    _assertBranded(self);
    if (e.key === 'Escape') self.close();
}

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
export function Popover<
    TBase extends Constructor<Expandable>
>(Base: TBase) {
    return class PopoverElement extends Base implements Popover {

        constructor(...args: any[]) {
            super(...args);
            _brand(this);
            _initPrivateProp(this, _controller, new AbortController());
        }

        override[expandableOpenTransition](): void {
            super[expandableOpenTransition]();
            const signal = _getPrivateProp(this, _controller).signal;
            document.addEventListener(
                'keydown',
                (e: KeyboardEvent) => _closeOnEscape(this, e),
                { signal: signal });
            document.addEventListener(
                'mousedown',
                (e: MouseEvent) => _closeWhenOutOfBounds(this, e),
                { signal: signal }
            );
        }
        override[expandableCloseTransition](): void {
            super[expandableCloseTransition]();
            _getPrivateProp(this, _controller).abort();
        }
    }
}


// EXPORTED NAMESPACE ==================================================================
export namespace Popover {
    /**
     * Validates an element as a `Popover`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `Popover`
     */
    export function getValidated(that: Expandable): Popover {
        if (branded.has(that)) return that as Popover;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${Popover.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `Popover`. */
const branded = new WeakSet();
function _assertBranded(instance: Popover): true {
    if (branded.has(instance)) return true;
    throw new TypeError("Cannot access private member");
}
/** Brands an element as an instance of `Popover`. */
function _brand(instance: Popover) {
    branded.add(instance);
}