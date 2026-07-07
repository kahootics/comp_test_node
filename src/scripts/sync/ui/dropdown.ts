
import pairTriggerAndToggleable, { ToggleableElement, TriggerElement } from "./expandables/expandable-pair.js";
import companionSharedConstants from '../../../config/companion-synced-constants.json' with { type: 'json' };

// DROPDOWN =============================================================================
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
     * @param controller - Id of HTMLButtonElement or the element itself
     * @throws {Error} If controller is not an HTMLButtonElement
     * @throws {Error} If controller lacks aria-controls attribute
     * @throws {Error} If element referenced by aria-controls does not exist
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

// DROPDOWN TRIGGER =====================================================================
/**
 * Dropdown trigger class
 * 
 * Instantiating an object of this class already initializes all necessary events
 * for the dropdown behaviour
 */
export class DropdownTrigger extends TriggerElement<HTMLButtonElement, Dropdown> {
    get dropdownTrigger() { return this.trigger; }
    get dropdown() { return this.controlled; }
    constructor(trigger: string | HTMLButtonElement, dropdown: Dropdown ) {
        super(trigger, HTMLButtonElement, dropdown);
    }
}

// PAIR DROPDOWN FUNCTION ===============================================================
/**
 * 
 * @param triggerIdOrEl - Id of dropdown trigger button or the element itself
 * @param dropdownObj - (optional) Dropdown instance.
 * Obtained using trigger's `aria-controls` if not provided manually.
 * @returns an instance of DropdownTrigger to pilot the dropdown manually
 */
export default function pairDropdown(triggerIdOrEl: string | HTMLButtonElement, dropdownObj?: Dropdown) {
    return pairTriggerAndToggleable(triggerIdOrEl, HTMLButtonElement, DropdownTrigger, Dropdown, dropdownObj);
}