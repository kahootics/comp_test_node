
import pairTriggerAndToggleable, { ToggleableElement, TriggerElement } from "./expandable-pair.js";
import companionSharedConstants from '../../../config/companion-shared-constants.json' with { type: 'json' };

/** ScrollHeight css variable recipient. */
const CSS_VAR: string = companionSharedConstants.CSSvariables.dropdown.scrollHeight;
/**
 * Animated dropdown component controlled via aria-controls.
 * @remarks
 * *Requires a DOM environment*.
 * @example
 * const dropdown = new Dropdown('my-dropdown-id');
 */
export class Dropdown extends ToggleableElement {
    /** The dropdown element */
    get dropdown(): HTMLElement { return this.ELEMENT; };
    /**
     * @param controller - id of HTMLButtonElement or the element itself
     * @throws an error If controller is not an HTMLButtonElement
     * @throws an error If controller lacks aria-controls attribute
     * @throws an error If element referenced by aria-controls does not exist
     */
    constructor(dropdown: string | HTMLElement) {
        super(dropdown, HTMLElement);
    }
    /**
     * Updates `CSS_VAR` constant property to reflect scrollHeight of dropdown (in px)
     */
    protected updateDropdownMaxHeight(): void {
        this.dropdown.style.setProperty(CSS_VAR, 
            `${this.dropdown.scrollHeight}px`);
    }
    /** 
     * Opens the dropdown,
     * sets aria-expanded of button to true
     */
    override open(): void {
        // this.controllerExpanded = true;
        this.updateDropdownMaxHeight();
        super.open();
    }
    /** 
     * Closes the dropdown,
     * sets aria-expanded of button to false
     */
    override close(): void {
        // this.controllerExpanded = false;
        this.updateDropdownMaxHeight();
        super.close();
    }
}

export class DropdownTrigger extends TriggerElement<HTMLButtonElement, Dropdown> {
    get dropdownTrigger() { return this.trigger; }
    get dropdown() { return this.controlled; }
    constructor(trigger: string | HTMLButtonElement, dropdown: Dropdown ) {
        super(trigger, HTMLButtonElement, dropdown);
    }
}

export default function pairDropdown(triggerIdOrEl: string | HTMLButtonElement, dropdownObj?: Dropdown) {
    return pairTriggerAndToggleable(triggerIdOrEl, HTMLButtonElement, DropdownTrigger, Dropdown, dropdownObj);
}