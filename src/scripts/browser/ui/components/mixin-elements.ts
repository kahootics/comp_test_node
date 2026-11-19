import { CUSTOM_TAGS } from "../../../shared/client-custom-elements-tags.js";
import { Expandable } from "../mixins/add_behaviour/expandable.mixin.js";
import { Modal } from "../mixins/add_behaviour/modal.mixin.js";
import { Popover } from "../mixins/add_behaviour/popover.mixin.js";
import { Slide } from "../mixins/add_behaviour/slide.mixin.js";
import type { Carousel } from "./carousel.js";

// Expandable family
const { falseModal, falsePopover, expandable } = CUSTOM_TAGS;

export const ExpandableElement = Expandable(HTMLElement);
export const FalsePopover = Popover(ExpandableElement);
export const FalseModal = Modal(FalsePopover);

customElements.define(expandable, ExpandableElement);
customElements.define(falsePopover, FalsePopover);
customElements.define(falseModal, FalseModal);

// Carousel Family
const { slide, carousel } = CUSTOM_TAGS;

export const SlideElement = Slide(HTMLElement);
customElements.define(slide,SlideElement);

declare global {
    interface HTMLElementTagNameMap {
        [expandable]: Expandable;
        [falsePopover]: Popover;
        [falseModal]: Modal;

        [slide]: Slide;
        [carousel]: Carousel;
    }
}