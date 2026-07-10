import { ValidationError } from "../../../../errors/common-errors.js";

/** Holds all branded instances of `ExtendibleElement`. */
const branded = new WeakSet();
/** Brands an element as an instance of `ExtendibleElement`. */
function brand(toBrand: any) {
    branded.add(toBrand);
}

/** Generic branded extension of `HTMLElement` */
export class ExtendibleElement extends HTMLElement {    
    constructor() {
        super();
        brand(this);
    }
    static getValidated(that: HTMLElement): ExtendibleElement {
        if(branded.has(that)) return that as ExtendibleElement;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${ExtendibleElement.name}`
        );
    }
}