import { ValidationError } from "../../../../errors/common-errors.mjs";

/** Holds all branded instances of `ExtendibleElement`. */
const branded = new WeakSet();
function _assertBranded(instance: ExtendibleElement): true {
    if (branded.has(instance)) return true;
    throw new TypeError("Cannot access private member");
}
/** Brands an element as an instance of `ExtendibleElement`. */
function _brand(instance: any) {
    branded.add(instance);
}

/** Generic branded extension of `HTMLElement` */
export class ExtendibleElement extends HTMLElement {
    constructor() {
        super();
        _brand(this);
    }
    static getValidated(that: HTMLElement): ExtendibleElement {
        if (branded.has(that)) return that as ExtendibleElement;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${ExtendibleElement.name}`
        );
    }
}