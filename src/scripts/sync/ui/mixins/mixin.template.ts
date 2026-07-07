import { ValidationError } from "../../../../errors/common-errors.js";

// !! Globally change MixinName and MixinClass before implementing !!

// OBFUSCATED PROPERTIES
export const PrivateProp = Symbol('PrivateProp');

// EXTENDED CONSTRUCTOR
type GConstructor<T extends {}> = new (...args: any[]) => T; 
type BaseClass = any; // edit //
type BaseConstructor = GConstructor<BaseClass>

// MIXIN PUBLIC INTERFACE
interface MixinName extends BaseClass {
    //# insert public properties 
    //# insert obfuscated properties 
    [PrivateProp](): void; // EG
}

// MIXIN FUNCTION
export function MixinName<
    TBase extends BaseConstructor
> ( Base: TBase ) {
    return class MixinClass extends Base implements MixinName {
        //# Implement interface and class privates 
        //# Implement obfuscated props 
        public [PrivateProp]() {} // EG

        //# Branding in constructor
        constructor(...args: any[]) {
            super(...args);
            brand(this);
            
        }
    }
}


// EXPORTED NAMESPACE
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
        if(branded.has(that)) return that as MixinName;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${MixinName.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION
/** Holds all branded instances of `MixinName`. */
const branded = new WeakSet();
/** Brands an element as an instance of `MixinName`. */
function brand(toBrand: MixinName) {
    branded.add(toBrand);
}