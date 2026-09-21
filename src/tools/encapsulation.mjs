//@ ts-check
// HELPERS ===================================================
/** 
 * Checks whether the `register` already has `instance` stored 
 * as a key (if it is a Map) or as a value (if it is a Set).
 * 
 * @template {object} T - Type of the object whose field should belong to.
 * @param {T} instance - Object whose field should belong to (usually `this`).
 * @param {WeakMap<T, unknown> | WeakSet<T>} register - 
 * Scoped (module or other) `WeakMap` that stores the private properties of a class
 * or `WeakSet` that registers the allowed callers of a private method.
 * @param {string} typeErrorMsg - Message to throw with the type error.
 * @returns {true}
 * 
 * @throws {TypeError} If `register` does not have `instance`.
 */
function _hasAccess(instance, register, typeErrorMsg) {
    if (register.has(instance)) return true;
    /* else */_throwTypeError(typeErrorMsg);
}
/** 
 * @param {string} message 
 * @returns {never}
 * @throws {TypeError} With provided message string. 
 */
function _throwTypeError(message) {
    throw new TypeError(message);
}

// INITIALIZER =========================================================
/**
 * Initializes a private field of a property defining it on `istance`.
 * 
 * @template {object} T - Type of the object whose property belongs to.
 * @template V - Type of the property's value.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakMap<T, V>} register - Scoped (module or other) `WeakMap` that stores the private properties of a class.
 * @param {V} value - Value to use for initializing the property.
 * @returns {V} the value of the private property.
 * 
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private property was already defined on the object.
 * 
 * @remarks
 * * Use {@link _getPrivateProp} to read from private property.
 * * Use {@link _setPrivateProp} to overwrite the private property.
 */
export function _initPrivateProp(instance, register, value,) {
    if (register.has(instance))
        _throwTypeError("Cannot initialize the same private field more than once");
    register.set(instance, value);
    return value;
}
/**
 * Initializes a private field of a property defining it on `istance` using a provided `setter` function.
 *
 * @template {object} T - Type of the object whose property belongs to.
 * @template V - Type of the property's value.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakMap<T, V>} register - Scoped (module or other) `WeakMap` that stores the private properties of a class.
 * @param {V} value - Value to use for initializing the property.
 * @param {(val: V) => void} setter - A setter method that will be called using 'instance' as its 'this' value and 'value' as the only argument.
 * @returns {V} the value of the private property.
 * 
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private property was already defined on the object.
 * 
 * @remarks
 * * Use {@link _getterPrivateProp} to read from private property with a getter function.
 * * Use {@link _setterPrivateProp} to overwrite the private property with a setter function.
 */
export function _initSetPrivateProp(instance, register, value, setter) {
    if (register.has(instance))
        _throwTypeError("Cannot initialize the same private field more than once");
    setter.call(instance, value);
    return value;
}
/**
 * Authorizes `istance` to call a private method defined for its class.
 * 
 * @template {object} T - Type of the object whose property belongs to.
 * @param {T} instance - Object whose method belongs to (usually `this`).
 * @param {WeakSet<T>} register - Scoped (module or other) `WeakSet` that stores the allowed callers of the method.
 * 
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private method was already defined on the object.
 * 
 * @remarks
 * * Use {@link _getPrivateMethod} to request access to the method.
 */
export function _allowPrivateMethod(instance, register) {
    if (register.has(instance))
        _throwTypeError("Cannot initialize the same private method more than once");
    register.add(instance);
}
/**
 * Inerts `istance` in a private register.
 * 
 * @template {object} T - Type of the object.
 * @param {T} instance - Object to register in order to enforce privacy (usually `this`).
 * @param {WeakSet<T>} register - Scoped (module or other) `WeakSet` that stores the registered instances.
 * 
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private method was already defined on the object.
 * 
 * @remarks
 * * Use {@link _assertRegistered} in any field where you want the register safety.
 */
export function _insertInRegister(instance, register,) {
    if (register.has(instance))
        _throwTypeError("Cannot have the same element in the same private register twice");
    register.add(instance);
}


// GETTER =============================================================
/**
 * Reads from a private field of a property defined on `istance`.
 *
 * @template {object} T - Type of the object whose property belongs to.
 * @template V - Type of the property's value.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakMap<T, V>} register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @returns {V} the value of the private property.
 * 
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * 
 * @remarks
 * * Use {@link _initPrivateProp} to initialize the property before.
 * * Use {@link _setPrivateProp} to write to private property.
 */
export function _getPrivateProp(instance, register,) {
    const msg = "Cannot read from private property of an object whose class did not declare it";
    /* assert */_hasAccess(instance, register, msg);
    return /** @type {V} */(register.get(instance));
}
/**
 * Reads from a private field of a property defined on `istance` using a provided `getter` function.
 *
 * @template {object} T - Type of the object whose property belongs to.
 * @template V - Type of the property's value.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakMap<T, V>} register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @param {() => V} getter - A getter method that will be called using 'instance' as its 'this' value.
 * @returns the value of the private property.
 * 
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * 
 * @remarks
 * Use {@link _initSetPrivateProp} to initialize the property before with a setter function.
 * Use {@link _setterPrivateProp} to write to private property with a setter function.
 */
export function _getterPrivateProp(instance, register, getter) {
    /* assert */_hasAccess(instance, register, "Cannot read from private property of an object whose class did not declare it");
    return getter.call(instance);
}
/**
 * Checks authorization of `istance` for calling a private method defined for its class.
 *
 * @template {object} T - Type of the object whose method belongs to.
 * @template {(...args: any[]) => any} V - Method to access.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakSet<T>} register - Scoped (module or other) `WeakSet` that stores the authenti, 
 * preventing them to be accessed from outside its definition scope.
 * @param {V} method - Method to access.
 * 
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private method was not defined on the object.
 * 
 * @remarks
 * * Use {@link _allowPrivateMethod} to register the instance before using this function.
 * * No setter is provided; **the method must be defined in the same scope of its register and outside the class**
 */
export function _getPrivateMethod(instance, register, method) {
    /* assert */_hasAccess(instance, register, "Cannot access private method");
    return method;
}
/**
 * Checks authorization of `istance` for calling a private method defined for its class.
 *
 * @template {object} T - Type of the object whose method belongs to.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakSet<T>} register - Scoped (module or other) `WeakSet` that stores the authenticated, 
 * preventing them to be accessed from outside its definition scope.
 * @returns {asserts instance is T}
 * 
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private method was not defined on the object.
 * 
 * @remarks
 * * Use {@link _allowPrivateMethod} to register the instance before using this function.
 * * No setter is provided; **the method must be defined in the same scope of its register and outside the class**
 */
export function _assertRegistered(instance, register) {
    _hasAccess(instance, register, "Cannot access private method");
}

// SETTER ======================================================
/**
 * Writes to a private field of a property defined on `istance`.
 *
 * @template {object} T - Type of the object whose property belongs to.
 * @template V - Type of the property's value.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakMap<T, V>} register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @param {V} value - Value to use for setting the property.
 * @returns {V} the value of the private property.
 * 
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * 
 * @remarks
 * * Use {@link _initPrivateProp} to initialize the property before using this function to edit it.
 * * Use {@link _getPrivateProp} to read from private property.
 */
export function _setPrivateProp(instance, register, value) {
    /* assert */_hasAccess(instance, register, "Cannot write to private property of an object whose class did not declare it");
    register.set(instance, value);
    return value;
}
/**
 * Writes to a private field of a property defined on `istance` using a provided `setter` function.
 *
 * @template {object} T - Type of the object whose property belongs to.
 * @template V - Type of the property's value.
 * @param {T} instance - Object whose property belongs to (usually `this`).
 * @param {WeakMap<T, V>} register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @param {V} value - Value to use for setting the property.
 * @param {(val: V) => any} setter - A setter method that will be called using 'instance' as its 'this' value and 'value' as the only argument.
 * @returns {V} the value of the private property.
 * 
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * 
 * @remarks
 * * Use {@link _initSetPrivateProp} to initialize the property with a setter function before using this function to edit it.
 * * Use {@link _getterPrivateProp} to read from private property with a getter function.
 */
export function _setterPrivateProp(instance, register, value, setter) {
    /* assert */_hasAccess(instance, register, "Cannot write to private property of an object whose class did not declare it");
    setter.call(instance, value);
    return value;
}

// READONLY HELPERS =============================================
const _defProp = Object.defineProperty;
const descriptor = Object.create(null);
descriptor.enumerable = true;
/**
 * Defines a readonly property on a given `instance`.
 * 
 * @template {object} T
 * @template V
 * @param {T} instance - Onto which to define the property.
 * @param {string|symbol} key - Access key of the property.
 * @param {V} value - Value to which to initialize the property.
 */
export function _defReadonlyProp(instance, key, value) {
    descriptor.value = value;
    _defProp(instance, key, descriptor);
}
/**
 * A WeakMap that rejects any attempt to edit an existing entry if the key already exists.
 * 
 * @extends {WeakMap<K, V>}
 * @template {WeakKey} K
 * @template V
 * 
 * @throws {TypeError} If attempting to overwrite an existing entry.
 */
export class SetOnceWeakMap extends WeakMap {
    /**
     * @override
     * @param {K} key 
     * @param {V} value 
     * @returns {this}
     */
    set(key, value) {
        if (super.has(key)) _throwTypeError("Cannot write to readonly field");
        return super.set(key, value);
    }
}

// MISC ==================================================
/**
 * Checks whether `baseClassConstructor` is in the prototype chain of `classConstructor`.
 * 
 * @param {Function} baseClassConstructor 
 * @param {Function} classConstructor 
 * @returns {boolean}
 */
export function extendsClass(classConstructor, baseClassConstructor) {
    if (classConstructor === baseClassConstructor) return true;
    return classConstructor.prototype instanceof baseClassConstructor;
}