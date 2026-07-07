

export class IllegalArgumentError extends Error {
    override name: "IllegalArgumentError";
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "IllegalArgumentError";

        Object.setPrototypeOf(this,IllegalArgumentError.prototype);
    }
}

export class NullPointerError extends Error {
    override name: "NullPointerError";
    constructor(subject: string, options?: ErrorOptions) {
        const message: string = `${subject} cannot be null`;
        super(message, options);
        this.name = "NullPointerError";

        Object.setPrototypeOf(this,NullPointerError.prototype);
    }
}

/**
 * Validation Error custom class
 * A validation error
 */
export class ValidationError extends Error {
    override name: "ValidationError";
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ValidationError";

        Object.setPrototypeOf(this,ValidationError.prototype);
    }
}