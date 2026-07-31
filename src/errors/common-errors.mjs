// @ts-check
import { formatList } from "../tools/string-parsers.js";

/**
 * Hyerachy:  
 * * {@link Error} (native) - 
 *    base error class.
 *   * {@link TypeError} (native) - 
 *      when a variable or parameter is not of a valid type.
 *   * {@link AggregateError} (native) -
 *      when multiple errors need to be reported by an operation (wraps them).
 *   * {@link IllegalArgumentError} -
 *      whena a parameter/argument passed to a function does not respect its restrictions.
 *   * {@link IllegalStateError} -
 *      when an operation is requested but state is incorrect.
 *      * {@link SingletonNotInitializedError} - 
 *         when a singleton instance is accessed without prior initialization.
 *      * {@link SingletonDuplicateError} - 
 *         when a singleton instance is accessed without prior initialization.
 *   * {@link IllegalAccessError} - 
 *      when accessing a field without correct authorization.
 *   * {@link NullPointerError} - 
 *      when an expected field is missing.
 *   * {@link UnsupportedOperationError} - 
 *      when an operation is not supported or not available.
 *   * {@link ValidationError} -
 *      when data in a process is rejected by a validation protocol.
 *   * {@link ConfigurationError} -
 *      when a configuration is not valid.
 *   * {@link ParseError} -
 *      when a parsing operation fails.
 *   * {@link AssertionError} -
 *      when an assertion is proven false.
 *   * {@link IOException} -
 *      when a I/O operation has falied or has been interrupted.
 *      * {@link FileNotFoundError} -
 *         when a file with the specified pathname does not exist.
 *      * {@link PermissionDeniedError} -
 * 
 *      * {@link TimeoutError} -
 * 
 *   * {@link ResourceError} -
 * 
 *      * {@link NotFoundError} -
 * 
 *      * {@link AlreadyExistsError} -
 * 
 *      * {@link DuplicateKeyError} -
 * 
 */
// @ts-ignore
class TemplateError extends Error {
    /** @override @type {string} */
    name = "TemplateError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, TemplateError.prototype);
    }
}

// ERRORS ====================================================

/**
 * Thrown where a parameter/argument passed to a function
 * does not respect its restrictions.
 * 
 * @example
 * ```ts
 * function functionCall(num) {
 *     if(typeof num !== "number")
 *         throw new IllegalArgumentError("Argument must be a number; " + num + " is not");
 * }
 * let four = true;
 * functionCall(four);
 * ```
 * ```txt
 * Error: Argument must be a number; true is not
 * ```
 */
export class IllegalArgumentError extends Error {
    /** @override @type {string} */
    name = "IllegalArgumentError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, IllegalArgumentError.prototype);
    }
}

export class IllegalStateError extends Error {
    /** @override @type {string} */
    name = "IllegalStateError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, IllegalStateError.prototype);
    }
}

export class IllegalAccessError extends Error {
    /** @override @type {string} */
    name = "IllegalAccessError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, IllegalAccessError.prototype);
    }
}

/**
 * Thrown where a resource is expected but is missing;   
 * (either `null` or `undefined`).
 * 
 * @example
 * ```ts
 * function functionCall(anything) {
 *     if(!anything)
 *         throw new NullPointerException("any","variable is not initialized");
 * }
 * let four;
 * functionCall(four);
 * ```
 * ```txt
 * Error: Expected any, found undefined; variable is not initialized
 * ```
 */
export class NullPointerError extends Error {
    /** @override @type {string} */
    name = "NullPointerError";
    /**
     * @param {string} expected - Expected result of operations.
     * @param {ErrorOptions & {found?: string}} [options] - Optional fields: 
     * * `cause` - A cause for the error.
     * * `found` - Actual result (defaults to `undefined`).
     */
    constructor(expected, options) {
        const message = `Expected ${expected}, but found ${String(options?.found)}`
            + typeof options?.cause === 'string' ? `; ${options?.cause}` : '';
        super(message, options);
        Object.setPrototypeOf(this, NullPointerError.prototype);
    }
}

export class NotFoundError extends Error {
    /** @override @type {string} */
    name = "NotFoundError";
    /**
     * "Cannot find {type} {name(s)}"
     * @typedef {ErrorOptions & {type?: string}} NotFoundErrorOptions
     * @param {string | string[]} name - Name or identifier string of the missing resource (allows multiple).
     * @param {NotFoundErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     * * `type` - Type of the missing resource.
     */
    constructor(name, options) {
        const message = `Cannot find ${options?.type ? options.type + ' ' : ''
            }${typeof name === 'string' ?
                name : formatList(name, 'nor')
            }`;
        super(message, options);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class FileNotFoundError extends Error {
    /** @override @type {string} */
    name = "FileNotFoundError";
    /**
     * "Cannot find {type}{name} at {path}"
     * @typedef {ErrorOptions & {name?: string, type?: string}} FileNotFoundErrorOptions
     * @param {string} filePath - Path to the missing resource.
     * @param {FileNotFoundErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     * * `name` - Name of the missing resource.
     * * `type` - Type of file.
     */
    constructor(filePath, options) {
        const {type, name} = options ?? {}
        const message = `Cannot find ${type
                ? (type + ' ') : ''}${name
                ? ('with name ' + name)
                : 'file'}at ${filePath}`;
        super(message, options);
        Object.setPrototypeOf(this, FileNotFoundError.prototype);
    }
}


export class DirectoryNotFoundError extends Error {
    /** @override @type {"DirectoryNotFoundError"} */
    name = "DirectoryNotFoundError";
    /**
     * "Cannot find directory at {path}"
     * @param {string} dirPath - Path to the missing resource.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(dirPath, options) {
        const message = `Cannot find directory at ${dirPath}`;
        super(message, options);
        Object.setPrototypeOf(this, DirectoryNotFoundError.prototype);
    }
}
/**
 * Thrown when data in a process is rejected by a validation protocol.
 * 
 * @example
 * ```ts
 * function isInt(int) {
 *     if(!(typeof int === "number" && int % 1 === 0))
 *         throw new ValidationError("Required integer");
 * }
 * let four;
 * functionCall(four);
 * ```
 * ```txt
 * Error: Required integer
 * ```
 */
export class ValidationError extends Error {
    /** @override @type {string} */
    name = "ValidationError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}


export class ConfigurationError extends Error {
    /** @override @type {string} */
    name = "ConfigurationError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}





export class UnsupportedOperationError extends Error {
    /** @override @type {string} */
    name = "UnsupportedOperationError";
    /**
     * @param {string} message - Error message.
     * @param {ErrorOptions} [options] - Optional fields:
     * * `cause` - A cause for the error.
     */
    constructor(message, options) {
        super(message, options);
        Object.setPrototypeOf(this, UnsupportedOperationError.prototype);
    }
}
