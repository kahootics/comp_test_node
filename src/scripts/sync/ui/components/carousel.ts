import { IllegalArgumentError } from "../../../../errors/common-errors.mjs";
import { Lock } from "../../shared/lock.js";
import { requestTransitionFrame } from "../../shared/utilities.js";
import { isPointerCoarse } from "../handle.js";

/**
 * Elements order-agnostic translation:
 * * `prev` and `next` exist but are not necessarily the targets of the translation,
 * * `curr` is always a target,
 * * the other target will always be on either side of `curr`
 * This allows the carousel to be viewed non-sequentially
 * 
 * By default, the carousel will be circular
 * 
 * Carousel'elements may change order, be deleted or 'hidden';
 * any of these events will regenerate the view:   
 * hidden elements are skipped
 * 
 * 
 * 
 * 
 * states:
 * 
 * transitioning right (back):
 * > curr -> var(x + 100%);
 * > prev -> var(x + 100%)
 * > 
 * 
 * transition steps:
 * 1. there is a current element (`curr`)
 * 2. get element you must transition to (`target`)
 * 3. are we going back to start/end? (circle) (find index of transition target)
 * 4. is the element after/before the current one? (find transition direction(right/left) by comparing indexes of `curr` and `target`)
 * 5. set `target` to a position (left,right)
 * 6. remove `inert` from transitioned element before animating
 * 7. set transition variable to +100% if transitioning right; to -100% otherwise (all within animation frame (is it necessary?))
 * 8. set previously current to inert
 * 9. update internal state (prev, curr, next)
 * 
 * 
 */

declare const TRANSLATION_CSS_VAR: string;
declare const TRANSLATING_CSS_CLASS: string;
declare const POSITION_CSS_VAR: string;
declare const THRESHOLD: number;

const Position = {
    LEFT: '-100%',
    CENTER: '0%',
    RIGHT: '100%'
} as const;
/* function _positionAtLeft(target: HTMLElement): void {
    target.style.setProperty(POSITION_CSS_VAR, Position.LEFT);
} */
function _positionAtCenter(target: HTMLElement): void {
    target.style.setProperty(POSITION_CSS_VAR, Position.CENTER);
}
/* function _positionAtRight(target: HTMLElement): void {
    target.style.setProperty(POSITION_CSS_VAR, Position.RIGHT);
} */
function _positionAtLeftOrRight(target: HTMLElement, posLeft: boolean): void {
    target.style.setProperty(POSITION_CSS_VAR, posLeft ? Position.LEFT : Position.RIGHT);
}

const MovementDirection = {
    HORIZONTAL: 10, VERTICAL: 20
} as const;

class Coordinates {
    public direction: typeof MovementDirection[keyof (typeof MovementDirection)] | null = null;
    public startY: number | null = null;
    public startX: number | null = null;
    /**
     * reset
     */
    public reset() {
        this.direction = this.startY = this.startX = null;
    }
}

const _viewObsOpt: MutationObserverInit = {
    childList: true,
    subtree: false, // redundant
    attributes: true,
    attributeFilter: ["hidden"]
} as const;
const placeholder = new HTMLElement();

export class Carousel extends HTMLElement {

    // STATE MANAGERS =========================================
    readonly #viewObserver = new MutationObserver(() => this.#buildView());
    readonly #controller = new AbortController();
    readonly #lock = new Lock();
    // VIEW ================================================
    readonly #indexesMap = new Map<HTMLElement, number>();
    #view: /* E */HTMLElement[] = [];
    #viewSize: number = 0;
    get size() { return this.#viewSize; }

    #curr?:/* E */HTMLElement;
    #prev:/* E */HTMLElement = placeholder;
    #nextE:/* E */HTMLElement = placeholder;

    get current() {
        if (!this.#curr) throw new Error()
        return this.#curr;
    }
    get #positionedPrev() {
        const prev = this.#prev;
        _positionAtLeftOrRight(prev, true);
        return prev;
    }
    get previous() { return this.#prev; }
    get #positionedNext() {
        const next = this.#nextE;
        _positionAtLeftOrRight(next, false);
        return next;
    }
    get next() { return this.#nextE; }
    set #current(target: HTMLElement) {
        this.#assertIsChild(target);
        this.#curr = target;
        this.#setPrev();
        this.#setNext();
        _positionAtCenter(target);
    }
    #setPrev() {
        const target = this.#findPrev();
        _positionAtLeftOrRight(this.#prev = target, true);
    }
    #setNext() {
        const target = this.#findNext();
        _positionAtLeftOrRight(this.#nextE = target, false);
    }


    #assertIsChild(target: HTMLElement): void {
        if (!this.isChild(target)) throw new Error();
    }
    #assertGetCurrent(): HTMLElement {
        // check if current stored still exists, 
        // is connected and still attached to the carousel
        if (this.#curr?.isConnected && this.isChild(this.#curr))
            return this.#curr;

        // if not, make the first element of view as current
        const maybe = this.#view[0];
        if (!maybe)
            throw new Error("The carousel has no available elements");
        return maybe;
    }

    get currentIndex(): number {
        return this.indexOf(this.current);
    }


    // FINDER METHODS ==================================================

    #findNext(): HTMLElement {
        return this.getCircularChild(this.currentIndex + 1);
    }
    #findPrev(): HTMLElement {
        return this.getCircularChild(this.currentIndex - 1);
    }
    public indexOf(child: HTMLElement): number {
        return this.#indexesMap.get(child) ?? -1;
    }

    public isChild(maybe: HTMLElement): boolean {
        return this.#indexesMap.has(maybe);
    }

    public getChild(index: number): HTMLElement | undefined {
        return this.#view[index];
    }

    #getCircularIndex(index: number): number {
        const length = this.#viewSize;
        return (index % length) + (index < 0 ? length : 0);
    }

    public getCircularChild(index: number): HTMLElement {
        const i = this.#getCircularIndex(index);
        return this.#view[i]!;
    }

    public getChildById(id: string): HTMLElement | undefined {
        const maybe = document.getElementById(id);
        if (maybe && this.indexOf(maybe) > 0) return maybe;
    }

    // VIEW OBSERVER =============================================

    #startViewObserver() {
        this.#viewObserver.observe(this, _viewObsOpt);
    }
    #stopViewObserver() {
        this.#viewObserver.disconnect();
    }

    /**
     * Builds the list of visible (non-`hidden`) elements displayable by the carousel, 
     * along with a map associating each to their 0-based position in the list, and
     * updating/initializing the current element on display.
     */
    #buildView(): void {
        const visible: HTMLElement[] = [];
        const indexMap = this.#indexesMap;
        indexMap.clear();

        for (const child of this.children) {
            if (!child.hasAttribute('hidden') && child instanceof HTMLElement) {
                indexMap.set(child, visible.length);
                visible.push(child);
            }
        }
        this.#view = visible;
        const { length } = visible;
        this.#viewSize = length;

        if (length === 1) this.removeTouchListeners();
        else this.addTouchListeners();
 
        this.#current = this.#assertGetCurrent();
    }

    // STARTUP & TEARDOWN =============================================

    connectedCallback(): void {
        this.#startViewObserver();
        this.#buildView();

        this.#current = this.#assertGetCurrent();
    }

    disconnectedCallback(): void {
        this.#stopViewObserver();
        this.removeTouchListeners();
    }

    // TRANSITION BY POSITION ================================================

    #afterTransition?: () => void;

    ontransitionendCallback(callback: () => void) {
        this.#afterTransition = callback;
    }

    toNext() { this.#transitionTo(this.next); }
    toPrev() { this.#transitionTo(this.previous); }
    to(target: HTMLElement) { this.#transitionTo(target); }

    #transitionTo(target: HTMLElement) {
        const current = this.current;
        // If target is the same as current, do nothing;
        // this also excludes `this.currentIndex === i`|`distance === 0` case
        if (current === target) return;

        const i = this.indexOf(target);
        if (i < 0)
            throw new IllegalArgumentError("Cannot translate to an external target");
        // hidden children are also unviable targets

        const distance = i - this.currentIndex;
        // if they are consecutive at the extremes of the view
        // reverse the direction of the translation
        const translateLeft: boolean =
            (Math.abs(distance) === (this.#viewSize - 1))
                ? distance < 0 : distance > 0;

        // If we need to translate left,
        // then `target` must be on the right
        _positionAtLeftOrRight(target, !translateLeft);
        target.inert = false;

        requestTransitionFrame(() => {
            // If we need to translate left,
            // then `current` must move on the left
            _positionAtLeftOrRight(current, translateLeft);
            // will move to the center
            this.#current = target;
        });

        target.addEventListener('transitionend', () => {
            current.inert = true;
            target.focus();
            if (this.#afterTransition) this.#afterTransition();
        }, { once: true });

    }

    // EVENT LISTENERS =======================================================

    addTouchListeners() {
        const signal = this.#controller.signal;
        const coord = new Coordinates();
        this.addEventListener('pointerdown', (e) => this.#handlePointerDown(e, coord), { signal })
        this.addEventListener('pointermove', (e) => this.#handlePointerMove(e, coord), { signal })
        this.addEventListener('pointerup', (e) => this.#handlePointerUp(e, coord), { signal })
    }
    removeTouchListeners() {
        this.#controller.abort();
    }

    // TRANSITION BY TRANSLATION ============================================

    #isTranslating(yes: boolean): void {
        if (yes)
            this.classList.remove(TRANSLATING_CSS_CLASS);
        else this.classList.add(TRANSLATING_CSS_CLASS);
    }

    #setTranslationVar(pixels: number): void {
        this.style.setProperty(TRANSLATION_CSS_VAR, pixels + 'px');
    }
    #unsetTranslationVar(): string {
        return this.style.removeProperty(TRANSLATION_CSS_VAR);
    }

    /**
     * When user presses on the carousel, register the touch coordinates.
     * @param e 
     * @param coord 
     */
    #handlePointerDown(e: PointerEvent, coord: Coordinates) {
        if (!isPointerCoarse(e)) return;
        coord.startY = e.clientY;
        coord.startX = e.clientX;
    }
    /**
     * When user moves finger on carousel,
     * * if drag is more vertical, do nothing
     * * if drag is more horizontal, allows dragging
     * and sets inert attributes of nearby items
     * @param e 
     * @param coord 
     */
    #handlePointerMove(e: PointerEvent, coord: Coordinates) {
        const { startX, startY, direction } = coord;
        if (direction === MovementDirection.VERTICAL
            || !(startY && startX)
        ) return;

        const { clientX, clientY } = e;

        const deltaX = clientX - startX;

        // set movement direction
        if (!direction)
            if (Math.abs(startY - clientY) >= Math.abs(deltaX)) {
                coord.direction = MovementDirection.VERTICAL;
                return;
            } else {
                coord.direction = MovementDirection.HORIZONTAL;
                this.#isTranslating(true);
            }

        // if: direction = MovementDirection.HORIZONTAL;
        if (deltaX > 0 && this.previous.inert)
            // reposition in case there are only 2 elements
            this.#positionedPrev.inert = false;
        else if (deltaX < 0 && this.next.inert)
            this.#positionedNext.inert = false;
        else if (deltaX === 0)
            this.next.inert = this.previous.inert = true;

        this.#setTranslationVar(deltaX);

    }
    /**
     * 
     * @param e 
     * @param coord 
     */
    #handlePointerUp(e: PointerEvent, coord: Coordinates) {
        const { startX, startY, direction } = coord;
        if (direction === MovementDirection.VERTICAL
            || !(startY && startX && direction)
        ) return;
        const { clientX } = e;

        const deltaX = clientX - startX;

        const threshold = Math.abs(this.clientWidth * THRESHOLD);
        // reset everything
        coord.reset();

        // No need for animation frame since
        // both elements are already visible

        const curr = this.current;
        const next = this.next;
        const prev = this.previous;
        // re-enable transitions
        this.#isTranslating(false);
        // remove translation vars
        this.#unsetTranslationVar();
        // if above threshold, transition:
        if (deltaX > threshold) {
            _positionAtLeftOrRight(curr, false);
            this.#current = prev;
            prev.addEventListener('transitionend', () => {
                curr.inert = true;
                prev.focus();
                if (this.#afterTransition) this.#afterTransition();
            }, { once: true });
        }
        else if (deltaX < -threshold) {
            _positionAtLeftOrRight(curr, true);
            this.#current = next;
            next.addEventListener('transitionend', () => {
                curr.inert = true;
                next.focus();
                if (this.#afterTransition) this.#afterTransition();
            }, { once: true });
        }

        // if not, slide back into position 
        // (will happen naturally since translation
        // only need to reset all to inert at the end
        // variables have been removed)
        else {
            curr.addEventListener('transitionend', () => {
                next.inert = prev.inert = true;
            }, { once: true });
        }


    }

}
