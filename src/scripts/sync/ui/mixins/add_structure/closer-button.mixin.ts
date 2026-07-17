import { ValidationError } from "../../../../../errors/common-errors.js";
import type { Closeable } from "../../../../types/general-types.js";
import { ExtendibleElement } from "../../components/extendible-element.js";

// !! Globally change CloserButton, CloserButtonMixin and ExtendibleElementPlus before implementing !!

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends {}> = new (...args: any[]) => T; 
type ExtendibleElementPlus = ExtendibleElement & {
    connectedCallback(): void,
} & Closeable;

// MIXIN PUBLIC INTERFACE ==============================================================
export interface CloserButton extends ExtendibleElementPlus {}

// MIXIN FUNCTION ======================================================================
export function CloserButton<
    TBase extends Constructor<ExtendibleElementPlus>
> ( Base: TBase, ...CloserButtonClasses: string[] ) {
    return class CloserButtonMixin extends Base implements CloserButton {
        /** Close button of card. */
        private readonly CLOSER: HTMLButtonElement;

        constructor(...args: any[]) {
            super(...args);
            brand(this);
            this.CLOSER = document.createElement('button');
        }

        override connectedCallback() {
            super.connectedCallback();
            const target = super.querySelector('header');
            target ? target.appendChild(this.CLOSER) : super.prepend(this.CLOSER);
            this.CLOSER.addEventListener('click', () => this.close());
            this.CLOSER.classList.add(...CloserButtonClasses);
        }
    };
}


// EXPORTED NAMESPACE ==================================================================
export namespace CloserButton {
    /**
     * Validates an element as a `CloserButton`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `CloserButton`
     */
    export function getValidated(that: ExtendibleElementPlus): CloserButton {
        if(branded.has(that)) return that as CloserButton;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${CloserButton.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `CloserButton`. */
const branded = new WeakSet();
/** Brands an element as an instance of `CloserButton`. */
function brand(toBrand: CloserButton) {
    branded.add(toBrand);
}