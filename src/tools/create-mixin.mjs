import { ValidationError } from "../errors/common-errors.mjs";
import { SetOnceWeakMap, _initPrivateProp, _getPrivateProp, _throwTypeError } from "./encapsulation.mjs";

// TYPE DECLARATIONS =====================================================================
/**
 * Constructor generic type.
 * @template {object} T
 * @typedef {new (...args: any[]) => T} Constructor
 */
/**
 * Mixin generic function (returns an extended class from a base one).
 * @template {object} Constructed - Base instance interface.
 * @template {object} IMixin - Mixin public interface.
 * @typedef {<
 *     TBase extends Constructor<Constructed>
 * >(base: TBase, ...rest: any[]) => TBase & Constructor<IMixin>
 * } MixinFn
 */
/**
 * Built-in static methods for the mixin.
 * @template {object} IMixin - Mixin public interface.
 * @typedef {object} MBrand 
 * @property {(instance: IMixin) => true} assertBranded
 * Asserts the argument is an instance
 * of a specific class that descends from the mixin
 * and it is allowed to call one of its private methods.
 * Throws {@link TypeError} if it is not.
 * @property {<T extends unknown>(arg: T) => T & IMixin} getValidated
 * Validates the argument and returns it as an instance
 * of a class that descends from the mixin.
 * Throws {@link ValidationError} if it is not.
 * @property {<T extends unknown>(arg: T) => arg is T & IMixin} isInstance
 * Verifies if the argument is present in the mixin internal
 * register as an instance of a class that descends from the mixin.   
 * *The original type is preserved*; if intersection type is not 
 * needed or wanted, use {@link MBrand.is} instead.
 * @property {(arg: unknown) => arg is IMixin} is
 * Verifies if the argument is present in the mixin internal
 * register as an instance of a class that descends from the mixin.   
 * *The original type is not preserved*; if preservation is needed,
 * use {@link MBrand.isInstance} instead.
 */

// BRAND CLASS =============================================================
/** @type {SetOnceWeakMap<Brand<object>, WeakSet<object>>} */
const _branded = new SetOnceWeakMap();
/** @type {SetOnceWeakMap<Brand<object>, string>} */
const _label = new SetOnceWeakMap();
/**
 * Branding class that implements encapsulation methods for the mixin.
 *
 * @template {object} IMixin
 * @implements {MBrand<IMixin>}
 */
class Brand {
    /**
     * @param {string} label - A label to identify the mixin with.
     */
    constructor(label) {
        _initPrivateProp(this, _branded, new WeakSet());
        _initPrivateProp(this, _label, label);
    }

    /**
     * Adds to the mixin internal register an instance
     * that implements the declared interface of the mixin.
     *
     * @remarks
     * *To use within the mixin function only*.
     * 
     * @param {IMixin} instance
     */
    add(instance) {
        /** @type {WeakSet<IMixin>} */
        const branded = _getPrivateProp(this, _branded);
        branded.add(instance);
    }
    /**
     * @param {IMixin} arg
     * @returns {true}
     */
    assertBranded(arg) {
        if (this.isInstance(arg)) return true;
        _throwTypeError("Cannot access private method of an object whose class did not declare it");
    }
    /**
     * @template {unknown} T
     * @param {T} arg
     * @returns {T & IMixin}
     */
    getValidated(arg) {
        if (this.isInstance(arg)) return arg;
        throw new ValidationError(`${arg?.constructor?.name ?? String(arg)} is not an instance of ${_getPrivateProp(this, _label)}`);
    }
    /**
     * @template {unknown} T
     * @param {T} arg
     * @returns {arg is T & IMixin}
     */
    isInstance(arg) {
        /** @type {WeakSet<IMixin>} */
        const branded = _getPrivateProp(this, _branded);
        return branded.has(/** @type {IMixin & T} */(arg));
    }
    /**
     * @param {unknown} arg
     * @returns {arg is IMixin}
     */
    is(arg) {
        /** @type {WeakSet<IMixin>} */
        const branded = _getPrivateProp(this, _branded);
        return branded.has(/** @type {IMixin} */(arg));
    }
}

// CREATE MIXIN FUNCTION =====================================================
/**
 * @template {object} Constructed
 * @template {object} IMixin
 * @overload
 * @param {string} label
 * @param {(brand: Brand<IMixin>) => MixinFn<Constructed,IMixin>} factory
 * @returns {MixinFn<Constructed,IMixin> & MBrand<IMixin>}
 */
/**
 * @template {object} Constructed
 * @template {object} IMixin
 * @template {object} Statics
 * @overload
 * @param {string} label
 * @param {(brand: Brand<IMixin>) => MixinFn<Constructed,IMixin>} factory
 * @param {Statics} statics
 * @returns {MixinFn<Constructed,IMixin> & MBrand<IMixin> & Statics}
 */
/**
 * Mixin function creator; takes a label, a mixin factory method and,
 * optionally, an object whose properties will be assigned to the resulting mixin.
 *
 * @remarks
 * - When creating a mixin with this function, use the `brand` object passed
 * to the factory to register (with `add`) the instances created from the returned class.
 * - The mixin function created will have some built-in static methods available,
 * (see {@link MBrand} for documentation).
 * - The static object will be assigned directly to the mixin, meaning that
 * only surface properties will be cloned, any nested field will be copied
 * as reference (shallow copy).
 * 
 * @template {object} Constructed - Base interface expected for the mixin to implement upon.
 * @template {object} IMixin - Interface of the mixin; explicitly required.
 * @template {object} Statics - Shape of the additional static properties to set on the mixin.
 *
 * @param {string} label - A string to identify the mixin function with (it will be reported in errors).
 * @param {(brand: Brand<IMixin>) => MixinFn<Constructed,IMixin>} factory -
 * A function that receives the `brand` object that implements the `add` method
 * that is synced with the resulting mixin static methods `getValidated`, `is` and `assertBranded`.
 * @param {Statics} [statics] - (optional) Object containing static properties that will be assigned to the mixin function.
 * @returns {MixinFn<Constructed,IMixin> & MBrand<IMixin> & Statics} the resulting mixin function.
 *
 * @example
 * - without statics:
 * ```ts
 * export const Expandable = createMixin<
 *     Constructed, Expandable
 * >('Expandable', (brand) => <
 *     TBase extends Constructor<Constructed> & {
 *         observedAttributes?: readonly string[]
 *     }
 * >(Base: TBase) => {
 *     return class ExpandableElement extends Base implements Expandable {
 *
 *         constructor(...args: any[]) {
 *             super(...args);
 *             brand.add(this);
 *         }
 *     }
 * });
 * ```
 * - with statics:
 * ```ts
 * export const Expandable = createMixin<
 *     Constructed, Expandable, { isEmpty(): boolean }
 * >('Expandable', (brand) => <
 *     TBase extends Constructor<Constructed> & {
 *         observedAttributes?: readonly string[]
 *     }
 * >(Base: TBase) => {
 *     return class ExpandableElement extends Base implements Expandable {
 *
 *         constructor(...args: any[]) {
 *             super(...args);
 *             brand.add(this);
 *         }
 *     }
 * }, { isEmpty() { return true; } });
 * ```
 */
export function createMixin(label, factory, statics) {

    /** @type {Brand<IMixin>} */
    const brand = new Brand(label);

    const mixin = factory(brand);

    return Object.freeze(Object.assign(mixin,
        /** @type {MBrand<IMixin>} */({
            assertBranded: (arg) => brand.assertBranded(arg),
            getValidated: (arg) => brand.getValidated(arg),
            isInstance: (arg) => brand.isInstance(arg),
            is: (arg) => brand.is(arg),
        }), statics)
    );
}
