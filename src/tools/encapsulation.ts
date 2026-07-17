// HELPERS ===================================================
/** 
 * Checks whether the `register` already has `instance` stored 
 * as a key (if it is a Map) or as a value (if it is a Set).
 * 
 * @typeParam T - Type of the object whose field should belong to.
 * @param instance - Object whose field should belong to (usually `this`).
 * @param register - 
 * Scoped (module or other) `WeakMap` that stores the private properties of a class
 * or `WeakSet` that registers the allowed callers of a private method.
 * @param typeErrorMsg - Message to throw with the type error.
 * 
 * @throws {TypeError} If `register` does not have `instance`.
 */
function _hasAccess<
    T extends object
>(
    instance: T,
    register: WeakMap<T, unknown> | WeakSet<T>,
    typeErrorMsg: string
): true {
    if (register.has(instance)) return true;
    /* else */_throwTypeError(typeErrorMsg);
}
/** 
 * @throws {TypeError} With provided message string. 
 */
function _throwTypeError(message: string): never {
    throw new TypeError(message);
}

// INITIALIZER =========================================================
/**
 * Initializes a private field of a property defining it on `istance`.
 * 
 * @typeParam T - Type of the object whose property belongs to.
 * @typeParam V - Type of the property's value.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakMap` that stores the private properties of a class.
 * @param value - Value to use for initializing the property.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private property was already defined on the object.
 * @remarks
 * * Use {@link _getPrivateProp} to read from private property.
 * * Use {@link _setPrivateProp} to overwrite the private property.
 */
export function _initPrivateProp<
    T extends object, V
>(
    instance: T,
    register: WeakMap<T, V>,
    value: V,
): V {
    if (register.has(instance))
        _throwTypeError("Cannot initialize the same private field more than once");
    register.set(instance, value);
    return value;
}
/**
 * Initializes a private field of a property defining it on `istance` using a provided `setter` function.
 *
 * @typeParam T - Type of the object whose property belongs to.
 * @typeParam V - Type of the property's value.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakMap` that stores the private properties of a class.
 * @param value - Value to use for initializing the property.
 * @param setter - A setter method that will be called using 'instance' as its 'this' value and 'value' as the only argument.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private property was already defined on the object.
 * @remarks
 * * Use {@link _getterPrivateProp} to read from private property with a getter function.
 * * Use {@link _setterPrivateProp} to overwrite the private property with a setter function.
 */
export function _initSetPrivateProp<
    T extends object, V
>(
    instance: T,
    register: WeakMap<T, V>,
    value: V,
    setter: (val: V) => void
): V {
    if (register.has(instance))
        _throwTypeError("Cannot initialize the same private field more than once");
    setter.call(instance, value);
    return value;
}
/**
 * Authorizes `istance` to call a private method defined for its class.
 * 
 * @typeParam T - Type of the object whose property belongs to.
 * @param instance - Object whose method belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakSet` that stores the allowed callers of the method.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is in the `register`;
 * it means that the private method was already defined on the object.
 * @remarks
 * * Use {@link _getPrivateMethod} to request access to the method.
 */
export function _allowPrivateMethod<
    T extends object
>(
    instance: T,
    register: WeakSet<T>,
): void {
    if (register.has(instance))
        _throwTypeError("Cannot initialize the same private method more than once");
    register.add(instance);
}

// GETTER =============================================================
/**
 * Reads from a private field of a property defined on `istance`.
 *
 * @typeParam T - Type of the object whose property belongs to.
 * @typeParam V - Type of the property's value.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * @remarks
 * * Use {@link _initPrivateProp} to initialize the property before.
 * * Use {@link _setPrivateProp} to write to private property.
 */
export function _getPrivateProp<
    T extends object, V
>(
    instance: T,
    register: WeakMap<T, V>,
): V {
    /* assert */_hasAccess(instance, register, "Cannot read from private property of an object whose class did not declare it");
    return register.get(instance) as V;
}
/**
 * Reads from a private field of a property defined on `istance` using a provided `getter` function.
 *
 * @typeParam T - Type of the object whose property belongs to.
 * @typeParam V - Type of the property's value.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @param getter - A getter method that will be called using 'instance' as its 'this' value.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * @remarks
 * Use {@link _initSetPrivateProp} to initialize the property before with a setter function.
 * Use {@link _setterPrivateProp} to write to private property with a setter function.
 */
export function _getterPrivateProp<
    T extends object, V
>(
    instance: T,
    register: WeakMap<T, V>,
    getter: () => V
): V {
    /* assert */_hasAccess(instance, register, "Cannot read from private property of an object whose class did not declare it");
    return getter.call(instance);
}
/**
 * Checks authorization of `istance` for calling a private method defined for its class.
 *
 * @typeParam T - Type of the object whose method belongs to.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakSet` that stores the authenti, 
 * preventing them to be accessed from outside its definition scope.
 * @param method - Method to access.
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private method was not defined on the object.
 * @remarks
 * * Use {@link _allowPrivateMethod} to register the instance before using this function.
 * * No setter is provided; **the method must be defined in the same scope of its register and outside the class**
 */
export function _getPrivateMethod<
    T extends object
>(
    instance: T,
    register: WeakSet<T>,
    method: (...args: any[]) => any
) {
    /* assert */_hasAccess(instance, register, "Cannot access private method");
    return method;
}
export function _isRegistered<
    T extends object
>(
    instance: T,
    register: WeakSet<T>,
): true {
    return _hasAccess(instance, register, "Cannot access private method");
}

export function _assertRegistered<T extends object>(
    instance: T,
    register: WeakSet<T>,
): asserts instance is T {
    _hasAccess(instance, register, "Cannot access private method");
}

// SETTER ======================================================
/**
 * Writes to a private field of a property defined on `istance`.
 *
 * @typeParam T - Type of the object whose property belongs to.
 * @typeParam V - Type of the property's value.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @param value - Value to use for setting the property.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * @remarks
 * * Use {@link _initPrivateProp} to initialize the property before using this function to edit it.
 * * Use {@link _getPrivateProp} to read from private property.
 */
export function _setPrivateProp<
    T extends object, V
>(
    instance: T,
    register: WeakMap<T, V>,
    value: V,
): V {
    /* assert */_hasAccess(instance, register, "Cannot write to private property of an object whose class did not declare it");
    register.set(instance, value);
    return value;
}
/**
 * Writes to a private field of a property defined on `istance` using a provided `setter` function.
 *
 * @typeParam T - Type of the object whose property belongs to.
 * @typeParam V - Type of the property's value.
 * @param instance - Object whose property belongs to (usually `this`).
 * @param register - Scoped (module or other) `WeakMap` that stores the private properties of a class, 
 * preventing them to be accessed from outside its definition scope.
 * @param value - Value to use for setting the property.
 * @param setter - A setter method that will be called using 'instance' as its 'this' value and 'value' as the only argument.
 * @returns the value of the private property.
 * @throws {TypeError} If `instance` is not in the `register`;
 * it means that the private property was not defined on the object.
 * @remarks
 * * Use {@link _initSetPrivateProp} to initialize the property with a setter function before using this function to edit it.
 * * Use {@link _getterPrivateProp} to read from private property with a getter function.
 */
export function _setterPrivateProp<
    T extends object, V
>(
    instance: T,
    register: WeakMap<T, V>,
    value: V,
    setter: (val: V) => any
): V {
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
 * @param instance - Onto which to define the property.
 * @param key - Access key of the property.
 * @param value - Value to which to initialize the property.
 */
export function _defReadonlyProp<T extends object, V>(instance: T, key: string | symbol, value: V) {
    descriptor.value = value;
    _defProp(instance, key, descriptor);
}
/**
 * A WeakMap that rejects any attempt to edit an existing entry if the key already exists.
 * 
 * @throws {TypeError} If attempting to overwrite an existing entry.
 */
export class SetOnceWeakMap<K extends WeakKey = object, V = any> extends WeakMap<K, V> {
    override set(key: K, value: V): this {
        if (super.has(key)) _throwTypeError("Cannot write to readonly field");
        return super.set(key, value);
    }
}
