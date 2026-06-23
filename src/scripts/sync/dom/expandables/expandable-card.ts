import { setTimeout } from "node:timers/promises";
import { ToggleableElement } from "./expandable-pair.js";

const CLOSER_CLASS = '';
const HEADER_CLASS = '';
const TITLE_CLASS = '';
const BODY_CLASS = '';

let cards: number = 0;

abstract class ExpandableCard extends ToggleableElement {

    /** Header of card. */
    private readonly HEADER: HTMLElement;
    private initHeader() {
        this.HEADER.classList.add(HEADER_CLASS);
    }

    /** Close button of card. */
    private readonly CLOSER: HTMLButtonElement;
    private initCloser() {
        this.CLOSER.classList.add(CLOSER_CLASS);
        this.CLOSER.addEventListener('click', () => this.close());
    }

    /** Close button of card. */
    private readonly TITLE: HTMLHeadingElement;
    private initTitle() {
        this.TITLE.setAttribute('tabindex','-1');
        this.TITLE.classList.add(TITLE_CLASS);
        this.TITLE.id = TITLE_CLASS + cards; cards++;
        this.ELEMENT.setAttribute('aria-labelledby',this.TITLE.id);
    }

    /** Body of the card */
    private readonly BODY: HTMLElement;
    private initBody() {
        this.BODY.classList.add(BODY_CLASS);
    }

    // card initialization from constructor
    private initCard(cardId: string, cardRole: string, cardAriaModal: string) {
        this.ELEMENT.id = cardId;
        this.ELEMENT.setAttribute('role', cardRole); // should be restrictive
        this.ELEMENT.setAttribute('aria-modal', cardAriaModal); // as above
    }

    private init(
        cardId: string, 
        cardRole: string, 
        cardAriaModal: string
    ) { // Debounced

        this.initCloser(); this.initBody();
        this.initHeader(); this.initTitle();

        this.ELEMENT.appendChild(this.HEADER)
                        .appendChild(this.CLOSER);
        this.HEADER.appendChild(this.TITLE);
        this.ELEMENT.appendChild(this.BODY);

        this.initCard(cardId, cardRole, cardAriaModal);
        document.body.appendChild(this.ELEMENT);
    }

    constructor(cardId: string, cardRole: string, cardAriaModal: string) {
        super(document.createElement('div'),HTMLElement);
        this.HEADER = document.createElement('header');
        this.CLOSER = document.createElement('button');
        this.TITLE  = document.createElement('h2');
        this.BODY   = document.createElement('div');

        this.init(cardId, cardRole, cardAriaModal);
    }

    // Header methods
    protected appendToHeader<T extends Node>(node: T): T  {
        return this.HEADER.appendChild(node);
    }
    // Title methods
    public focus() {
        this.TITLE.focus();
    }
    public set title(newTitle: string) {
        this.TITLE.textContent = newTitle;
    }
    // Body methods
    public append<T extends Node>(node: T): T {
        return this.BODY.appendChild(node);
    }
    public prepend<T extends Node>(node: T): void {
        this.BODY.prepend(node);
    }
    public remove<T extends Node>(node: T): T {
        return this.BODY.removeChild(node);
    }
    
}