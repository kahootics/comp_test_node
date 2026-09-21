
import { CUSTOM_TAGS } from "../../shared/custom-components-tags.js";
import { Backdrop } from "./components/backdrop.js";
import { ExtendibleElement } from "./components/extendible-element.js";
import { FalseSelectDropdown } from "./components/false/false-select-dropdown.js";
import { FalseSelect } from "./components/false/false-select.js";
import { Expandable, expandableCloseTransition, expandableOnTransitionEnd, expandableOpenTransition } from "./mixins/add_behaviour/expandable.mixin.js";
import { Modal } from "./mixins/add_behaviour/modal.mixin.js";
import { Popover } from "./mixins/add_behaviour/popover.mixin.js";

const { falseSelect, falseModal,falsePopover,falseSelectDropdown,expandable } = CUSTOM_TAGS

const ExpandableConstructor = Expandable(ExtendibleElement, 'open', 'is-open');
customElements.define(expandable, ExpandableConstructor);

class FalsePopover extends Popover(ExpandableConstructor) {};
customElements.define(falsePopover, FalsePopover);

const FalseModal = Modal(FalsePopover);
customElements.define(falseModal, FalseModal);


customElements.define(falseSelect, FalseSelect);
customElements.define(falseSelectDropdown,FalseSelectDropdown);

declare global {
    interface HTMLElementTagNameMap {
        [falseSelect]: FalseSelect;
        [falseSelectDropdown]: FalseSelectDropdown;
        [expandable]: Expandable;
        [falsePopover]: Popover;
        [falseModal]: Modal;
    }
}

declare const dummy: never;

export {
    dummy, FalseSelect, Backdrop,
    FalseModal, ExpandableConstructor, FalsePopover

}