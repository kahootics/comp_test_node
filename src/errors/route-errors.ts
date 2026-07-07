
export class RouterInitializationError extends Error {
    override name: "RouterInitializationError";
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "RouterInitializationError";

        Object.setPrototypeOf(this,RouterInitializationError.prototype);
    }
}

export class RouterInvalidRequestError extends Error {
    override name: "RouterInvalidRequestError";
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "RouterInvalidRequestError";

        Object.setPrototypeOf(this,RouterInvalidRequestError.prototype);
    }
}