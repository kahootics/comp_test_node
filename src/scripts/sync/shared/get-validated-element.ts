import { IllegalArgumentError, NullPointerError, ValidationError } from "../../../errors/common-errors.js";


/**
 * Retrieves HTML element of specified type from 
 * string or validates type of element.
 * 
 * @param type - Type to get the element validated for (must be HTMLElement or derived)
 * @param idOrEl - Either id attribute of element or the element itself
 * @returns the element with validated type
 * @throws {Error} If element is not of requested type
 * @throws {Error} If element does not exist (id references nothing)
 * @remarks *Requires a DOM environment*.
 */
export function getValidatedElement<H extends HTMLElement>(
    type: new (...args: unknown[]) => H,
    idOrEl: string | H
): H {
    if (typeof idOrEl === 'string') {
        const el = document.getElementById(idOrEl);
        if (!el) throw new Error(`Element with id "${idOrEl}" not found.`);
        if (!(el instanceof type)) throw new Error(`Element "${idOrEl}" is not ${type.name}.`);
        return el;
    }
    return idOrEl;
}

/**
 * Type validation utility function for Elements
 * 
 * @param typeConstructor - Type to get the element validated for (must be Element or derived)
 * @param element - The element to validate
 * @returns the element with the validated type
 * 
 * @throws {ValidationError} If the element is not of requested type
 */
export function getValidatedElementBack<
    E extends Element = Element
>(
    typeConstructor: new (...args: any[]) => E,
    element: Element
): E {
    if(element instanceof typeConstructor) return element;
    else throw new ValidationError(`Element is not of type ${typeConstructor.name}`);
}

/**
 * Utility function to get an element by its id
 * and validate its type
 * 
 * @param typeConstructor - Type to get the element validated for (must be HTMLElement or derived)
 * @param id - `id` attribute of the element to get and validate
 * @returns the element with requested type and id
 * 
 * @throws {NullPointerError} If the element does not exist in the document
 * @throws {ValidationError} If the element exists but is not of requested type
 */
export function getElementByIdAs<
    E extends HTMLElement = HTMLElement
>(
    typeConstructor: new (...args: any[]) => E,
    id: string
): E {
    const element = document.getElementById(id);
    if(element instanceof typeConstructor) return element;
    else if(element === null) throw new NullPointerError("The element");
    else throw new ValidationError(`No ${typeConstructor.name} element exists with id "${id}"`);
}

/**
 * Utility function to get elements by their ids
 * and validate their type
 * 
 * @param typeConstructor - Type to get the elements validated for (must be HTMLElement or derived)
 * @param ids - `id` attributes (all uniques) of the elements to get and validate
 * @returns an object that assigns the validated elements to their id
 * 
 * @throws {IllegalArgumentError} If the provided ids have duplicates or none were provided
 * @throws {NullPointerError} If any element does not exist in the document
 * @throws {ValidationError} If any element exists but is not of requested type
 * 
 */
export function getElementsByIdsAs<
    E extends HTMLElement = HTMLElement
>(
    typeConstructor: new (...args: any[]) => E,
    ...ids: string[]
): { [id: string]: E } {
    if(ids.length === 0) 
        throw new IllegalArgumentError("Must provide at least 1 id");
    const idsSet = new Set(ids);
    if(idsSet.size !== ids.length)
        throw new IllegalArgumentError("Must provide all unique ids");

    const result: { [id: string]: E } = {};
    idsSet.forEach(id => result[id] = getElementByIdAs(typeConstructor,id));
    return result;
}

/**
 * Utility function to retrieve a selection of elements
 * validated with a type
 * 
 * @param typeConstructor - Type to get the elements validated for (must be Element or derived)
 * @param selectorString - CSS selector string
 * @param [container=document] - Element to select children from according to the selector string   
 * Defaults to `document`
 * @returns an array of elements of the requested type
 * 
 * @throws {SyntaxError} if the selector string is not a valid CSS selector
 * @throws {ValidationError} If any element is not of requested type
 */
export function getQuerySelectedAllAs<
    E extends Element = Element
>(
    typeConstructor: new (...args: any[]) => E,
    selectorString: string,
    container: Element|Document = document
): E[] {
    const selectedEls = container.querySelectorAll(selectorString);
    return [...selectedEls].map(el => getValidatedElementBack(typeConstructor,el));
}