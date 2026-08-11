import { Expandable } from "../../mixins/add_behaviour/expandable.mixin.js";
import { Modal } from "../../mixins/add_behaviour/modal.mixin.js";
import { Popover } from "../../mixins/add_behaviour/popover.mixin.js";
import { Carousel, CAROUSEL_TAG } from "../carousel.js";
import { ExtendibleElement } from "../extendible-element.js";

declare const OPEN_CLASS: string;
declare const OPEN_ATT: string;

class RoutedCarousel extends Modal(Popover(Expandable(ExtendibleElement,OPEN_ATT,OPEN_CLASS))) {
    #carousel: Carousel;
    #header: HTMLHeadElement;
    #title: HTMLHeadingElement;
    #footer: HTMLElement;
    #closer: HTMLButtonElement;
    #next: HTMLButtonElement;
    #prev: HTMLButtonElement;
    constructor() {
        super();
        this.#carousel = document.createElement(CAROUSEL_TAG);
        this.#header = document.createElement('header');
        this.#title = document.createElement('h2');
        this.#footer = document.createElement('footer');
        this.#closer = document.createElement('button');
        this.#next = document.createElement('button');
        this.#prev = document.createElement('button');
    }


    // STARTUP ==================================================================

    #initHeader() {
        
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.#header.append(this.#title)
        this.append(this.#header,this.#carousel,this.#footer);

    }
}