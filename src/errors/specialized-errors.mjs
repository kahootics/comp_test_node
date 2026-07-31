import { IllegalAccessError, IllegalStateError, UnsupportedOperationError } from "./common-errors.mjs";


// SINGLETON & FACTORY ERRORS =================================================

export class SingletonNotInitializedError extends IllegalStateError {
    /** @override @type {"SingletonNotInitializedError"} */
    name = "SingletonNotInitializedError";
    /**
     * @typedef {ErrorOptions & { init?: {method: string} }} SingletonNotInitializedErrorOptions
     * @param {string} className - Name of the singleton class.
     * @param {SingletonNotInitializedErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     * * `initMethod` - Name of the method that initializes singleton (leave blank if constructor is not private).
     */
    constructor(className, options) {
        const { method } = options?.init ?? {};
        const message = `Cannot access singleton instance of ${className
            } without initializing it ${method
                ? ('with method ' + (method + ' ')) : ''}first`;
        super(message, options);
        Object.setPrototypeOf(this, SingletonNotInitializedError.prototype);
    }
}


export class SingletonDuplicateError extends IllegalStateError {
    /** @override @type {"SingletonDuplicateError"} */
    name = "SingletonDuplicateError";
    /**
     * @param {string} className - Name of the singleton class.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     * * `initMethod` - Name of the method that initializes singleton (leave blank if constructor is not private).
     */
    constructor(className, options) {
        const message = `Cannot initialize singleton instance of ${className
            } twice`;
        super(message, options);
        Object.setPrototypeOf(this, SingletonDuplicateError.prototype);
    }
}


export class PrivateConstructorError extends IllegalAccessError {
    /** @override @type {"PrivateConstructorError"} */
    name = "PrivateConstructorError";
    /**
     * @typedef {ErrorOptions & { init?: { method: string, type: 'factory'|'singleton' } }} PrivateConstructorErrorOptions
     * @param {string} className - Name of the singleton class.
     * @param {PrivateConstructorErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     * * `init.type` - factory or singleton pattern.
     * * `init.method` - Name of the method that instantiates.
     */
    constructor(className, options) {
        const { method, type } = options?.init ?? {};
        const message = `Cannot instantiate ${className} directly`
            + (method && type
                ? `; must use static ${type} method "${method}" instead`
                : '');
        super(message, options);
        Object.setPrototypeOf(this, PrivateConstructorError.prototype);
    }
}
