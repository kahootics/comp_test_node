import { ValidationError } from "../../../../../errors/common-errors.js";
import { Expandable, expandableCloseTransition, expandableOpenTransition } from "./expandable.mixin.js";


// !! Globally change Popover, PopoverElement and Expandable before implementing !!

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends {}> = new (...args: any[]) => T;

// MIXIN PUBLIC INTERFACE ==============================================================
export interface Popover extends Expandable {
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
            brand(this);
        }

        /** Closes element on pressing `Escape`. */
        private closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.close();
        }

        /** Closes element on pressing somewhere outside the element. */
        private closeWhenOutOfBounds(e: MouseEvent) {
            if (e.target instanceof Node &&
                this.contains(e.target)) this.close();
        }

        override[expandableOpenTransition](): void {
            super[expandableOpenTransition]();
            document.addEventListener('keydown', this.closeOnEscape);
            document.addEventListener('mousedown', this.closeWhenOutOfBounds);
        }
        override[expandableCloseTransition](): void {
            super[expandableCloseTransition]();
            document.removeEventListener('keydown', this.closeOnEscape);
            document.removeEventListener('mousedown', this.closeWhenOutOfBounds)
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
/** Brands an element as an instance of `Popover`. */
function brand(toBrand: Popover) {
    branded.add(toBrand);
}