// import { _getPrivateProp, _initPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.js";
import { ValidationError } from "../../../../../errors/common-errors.mjs";

// !! Globally change MixinName, MixinClass and BaseClass before implementing !!

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends object> = new (...args: any[]) => T;
type BaseClass = any; // edit //

// OBFUSCATED PROPERTIES ===============================================================
export const ObfuscatedProp = Symbol('ObfuscatedProp'); // eg //

// MIXIN PUBLIC INTERFACE ==============================================================
export interface MixinName extends BaseClass {
    //# insert public properties 
    //# insert obfuscated properties 
    [ObfuscatedProp](): void; // EG
}

// PRIVATE FIELDS ======================================================================
const _privateField = new WeakMap<MixinName, any>();
// EG // const _readonlyPrivateField = new SetOnceWeakMap<MixinName,any>();
/* Private method can be easily validated using helper function
 * `_assertBranded` that will throw TypeError in case the element
 * was not branded by this class
 */
// EG //* function privateMethod(self: MixinName) {
//          _assertBranded(self);
//          /* .... */
// }

// HELPERS =============================================================================
/* ... */

// MIXIN FUNCTION ======================================================================
export function MixinName<
    TBase extends Constructor<BaseClass>
>(Base: TBase) {
    return class MixinClass extends Base implements MixinName {
        //# Implement interface and class privates 
        //# Implement obfuscated props 
        public [ObfuscatedProp]() { } // EG

        //# Branding in constructor
        constructor(...args: any[]) {
            super(...args);
            _brand(this);

            //# Init privates here
            // EG //* _initPrivateProp(this,_privateField,initialValue) */
        }
    }
}


// EXPORTED NAMESPACE ==================================================================
export namespace MixinName {
    /**
     * Validates an element as a `MixinName`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `MixinName`
     */
    export function getValidated(that: BaseClass): MixinName {
        if (branded.has(that)) return that as MixinName;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${MixinName.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `MixinName`. */
const branded = new WeakSet();
function _assertBranded(instance: MixinName): true {
    if (branded.has(instance)) return true;
    throw new TypeError("Cannot access private member");
}
/** Brands an element as an instance of `MixinName`. */
function _brand(instance: MixinName) {
    branded.add(instance);
}