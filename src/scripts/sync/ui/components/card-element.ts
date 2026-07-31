import { ExtendibleElement } from "../components/extendible-element.js";


const HEADER_CLASS = '';
const TITLE_CLASS = '';
const BODY_CLASS = '';


export class CardElement extends ExtendibleElement {
    private connected: boolean = false;
    private static cardsNO: number = 0;

    /** Header of card. */
    private readonly HEADER: HTMLElement;
    private initHeader() {
        this.HEADER.classList.add(HEADER_CLASS);
    }

    /** Title of card. */
    private readonly TITLE: HTMLHeadingElement;
    private initTitle() {
        this.TITLE.setAttribute('tabindex', '-1');
        this.TITLE.classList.add(TITLE_CLASS);
        this.TITLE.id = TITLE_CLASS + CardElement.cardsNO;
        CardElement.cardsNO++; // different id for every title
        this.setAttribute('aria-labelledby', this.TITLE.id);
    }


    /** Body of the card */
    private readonly BODY: HTMLElement;
    private initBody() {
        this.BODY.classList.add(BODY_CLASS);
    }

    /** Element initializer function. */
    private init() {

        this.initBody();
        this.initHeader(); this.initTitle();


    }

    constructor() {
        super();

        this.HEADER = document.createElement('header');
        this.TITLE = document.createElement('h2');
        this.BODY = document.createElement('div');

        this.init();
    }

    connectedCallback() {
        // move child nodes to the body
        if (!this.connected) {
            this.connected = true;
            this.BODY.append(...this.childNodes);

            this.HEADER.append(this.TITLE);
            this.append(this.HEADER, this.BODY);
        }
    }

    // Title methods
    /** Brings the focus towards the TITLE. */
    public override focus(options?: FocusOptions): void {
        this.TITLE.focus();
    }
    /** Sets the text content within the element's TITLE's HEADER. */
    public override set title(newTitle: string) {
        this.TITLE.textContent = newTitle;
    }
    /** The text content within the element's TITLE's HEADER. */
    public override get title(): string {
        return this.TITLE.textContent;
    }
    // Body methods
    /**
     * Inserts nodes after the last child of BODY, 
     * while replacing strings in nodes with equivalent Text nodes. 
     */
    public appendToBody<T extends Node>(...nodes: T[]): void {
        this.BODY.append(...nodes);
    }
    /**
     * Inserts nodes before the first child of BODY, 
     * while replacing strings in nodes with equivalent Text nodes. 
     */
    public prependToBody<T extends Node>(...nodes: T[]): void {
        this.BODY.prepend(...nodes);
    }
    /**
     * Removes and returns node from BODY. 
     */
    public removeFromBody<T extends Node>(node: T): T {
        return this.BODY.removeChild(node);
    }

}

customElements.define("card-element", CardElement);
