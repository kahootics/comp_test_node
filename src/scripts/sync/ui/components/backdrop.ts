import config from "../../../../config/ui-config.mjs";
import { Expandable, expandableOnTransitionEnd, expandableCloseTransition, expandableOpenTransition, type ExpandableToggles } from "../mixins/add_behaviour/expandable.mixin.js";
import { ExtendibleElement } from "./extendible-element.js";

/** Backdrop specific css class name. */
const OPEN_CLASS = config.css.classes.BACKDROP_OPEN;
/**
 * Backdrop component. Appended to the body automatically.
 * @remarks
 * - *Requires a DOM environment* — not compatible with Node.js.
 * - Must be instantiated after DOM is ready (`DOMContentLoaded`).
 * @example
 * const backdrop = new Backdrop(closeMyModalFunc);
 * @see {@link Expandable} for details about inherited methods
 */
export class Backdrop extends Expandable(ExtendibleElement, 'open', OPEN_CLASS) {
    /**
     * @param backdropClass - Class to apply to the backdrop element;
     * @param modalCloserFunction - Function that closes the modal;
     * required for closing it when backdrop is clicked
     */
    constructor(backdropClass: string) {
        super();
        this.classList.add(backdropClass);
        this.setAttribute('aria-hidden','true');
    }
    override connectedCallback(): void {
        super.connectedCallback();
        document.body.appendChild(this);
    }
    /** Removes backdrop from document. */
    destroy() {
        this.remove();
    }
}

customElements.define('backdrop-element', Backdrop);
