import { ValidationError } from "../../../../../errors/common-errors.mjs";
import { _getPrivateProp, _initPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.js";
import { ExtendibleElement } from "../../components/extendible-element.js";

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends object> = new (...args: any[]) => T;

// MIXIN PUBLIC INTERFACE ==============================================================
export interface Footer extends ExtendibleElement {
    appendToFooter<T extends Node>(node: T): T;
}

const _FOOTER = new SetOnceWeakMap<ExtendibleElement,HTMLElement>();

// MIXIN FUNCTION ======================================================================
export function Footer<
    TBase extends Constructor<ExtendibleElement>
>(Base: TBase, ...FooterClasses: string[]) {
    return class FooterClass extends Base implements Footer {

        /**
         * Inserts nodes after the last child of FOOTER, 
         * while replacing strings in nodes with equivalent Text nodes. 
         */
        public appendToFooter<T extends Node>(node: T): T {
            return _getPrivateProp(this,_FOOTER).appendChild(node);
        }

        constructor(...args: any[]) {
            super(...args);
            _brand(this);

            const FOOTER = document.createElement('footer');
            this.appendChild(FOOTER);
            FOOTER.classList.add(...FooterClasses);
            _initPrivateProp(this,_FOOTER,FOOTER);
        }
    }
}


// EXPORTED NAMESPACE ==================================================================
export namespace Footer {
    /**
     * Validates an element as a `Footer`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `Footer`
     */
    export function getValidated(that: ExtendibleElement): Footer {
        if (branded.has(that)) return that as Footer;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${Footer.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `Footer`. */
const branded = new WeakSet();
function _assertBranded(instance: Footer): true {
    if (branded.has(instance)) return true;
    throw new TypeError("Cannot access private member");
}
/** Brands an element as an instance of `Footer`. */
function _brand(instance: Footer) {
    branded.add(instance);
}