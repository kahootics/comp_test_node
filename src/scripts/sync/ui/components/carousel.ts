import appConfig from "../../../../config/ui-config.mjs";
import { IllegalArgumentError, IllegalStateError, NotFoundError } from "../../../../errors/common-errors.mjs";
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

function _positionAtCenter(target: HTMLElement): void {
    target.style.setProperty(POSITION_CSS_VAR, Position.CENTER);
}

function _positionAtSides(target: HTMLElement, position: TransitionDirection): void {
    target.style.setProperty(POSITION_CSS_VAR, position ? Position.LEFT : Position.RIGHT);
}

const PointerMoveDirection = {
    HORIZONTAL: 10, VERTICAL: 20
} as const;

const TransitionDirection = {
    LEFT: true,
    RIGHT: false
} as const;
type TransitionDirection = typeof TransitionDirection[keyof (typeof TransitionDirection)];

class Coordinates {
    public direction: typeof PointerMoveDirection[keyof (typeof PointerMoveDirection)] | null = null;
    public startY: number | null = null;
    public startX: number | null = null;
    /**
     * reset
     */
    public reset() {
        this.direction = this.startY = this.startX = null;
    }
}

const _childListObsOpt: MutationObserverInit = {
    childList: true,
} as const;
const _eachChildObsOpt: MutationObserverInit = {
    attributes: true,
    attributeFilter: ["hidden"]
} as const;
const placeholder = new HTMLElement();
/**
 * 
 */
export class Carousel extends HTMLElement {

    // STATE MANAGERS =========================================
    /** Observes changes in disposition of direct childern of the carousel. */
    readonly #childObserver = new MutationObserver(() => this.#buildView());
    /** The total amount of children in the carousel (includes 'hidden' elements) */
    //#childrenAmount: number = 0;
    /** Observes changes to the `hidden` attribute on the carousel's subtree. */
    readonly #hiddnObserver = new MutationObserver(() => this.#buildView());
    /** Controls the touch listeners. */
    readonly #controller = new AbortController();
    /** Locks transitions, so that only one can occur at a time. */
    readonly #lock = new Lock();

    // VIEW ================================================
    /** Index reference of all the elements in the view. */
    readonly #indexesMap = new Map<HTMLElement, number>();
    /** The entire list of the elementss displayed by the carousel. */
    #view: /* E */HTMLElement[] = [];
    /** Size of the view. */
    #viewSize: number = 0;
    /** Size of the carousel's view. */
    get size() { return this.#viewSize; }

    // STATE ==================================================
    /** Currently displayed element. */
    #curr?:/* E */HTMLElement;
    /** Currently displayed element. */
    get current() {
        if (!this.#curr)
            throw new NotFoundError("carousel current element");
        return this.#curr;
    }
    /** Currently displayed element's position in the view (-1 otherwise). */
    get currentIndex(): number {
        return this.indexOf(this.current);
    }

    /** Element of the view preceding current one. */
    #prev:/* E */HTMLElement = placeholder;
    /** Element of the view preceding current one. */
    get previous() { return this.#prev; }

    /** Element of the view succeding current one. */
    #next:/* E */HTMLElement = placeholder;
    /** Element of the view succeding current one. */
    get next() { return this.#next; }

    // STATE MANAGERS ==========================================

    /** Renders all the elements within the view `inert`. */
    #inertAll() {
        for (const child of this.#view) {
            child.inert || (child.inert = true); // or just child.inert = true
        }
    }

    /**
     * Ensures the current element is present and correctly set up
     * along with its side elements.
     */
    #ensureCurrentState() {
        // current has been estabilished:
        const current = this.#curr = this.#assertGetCurrent();
        // makes sure all elements are inactive
        this.#inertAll();
        // update side elements.
        this.#ensureSides();
        // Centering of current is done last; 
        // this ensures that, if the view contains only 2 elements, 
        // then the current one is certainly set at the center.
        _positionAtCenter(current);
        current.inert = false;
    }

    /**
     * @returns the current element of the view;
     * if it is no longer in the view, fallbacks 
     * to the first element of the view.
     * @throws {NotFoundError} If the view contains no suitable element.
     */
    #assertGetCurrent(): HTMLElement {
        // check if current stored still exists, 
        // is connected and still attached to the carousel
        const curr = this.#curr;
        if (curr?.isConnected && this.isChild(curr))
            return curr;

        // if not, make the first element of view as current
        const maybe = this.#view[0];
        if (!maybe)
            throw new NotFoundError("any available carousel element");
        return maybe;
    }

    /**
     * Finds and stores previous and next element of the view.
     */
    #ensureSides() {
        _positionAtSides(this.#prev = this.#findPrev(), TransitionDirection.LEFT);
        _positionAtSides(this.#next = this.#findNext(), TransitionDirection.RIGHT);
    }

    /** Element of the view preceding current one; positioned to the left. */
    get #positionedPrev() {
        const prev = this.#prev;
        _positionAtSides(prev, TransitionDirection.LEFT);
        return prev;
    }
    /** Element of the view succeding current one; positioned to the right. */
    get #positionedNext() {
        const next = this.#next;
        _positionAtSides(next, TransitionDirection.RIGHT);
        return next;
    }

    // FINDER METHODS ==================================================

    /** Finds the element after the current one according to the order of the view. */
    #findNext(): HTMLElement {
        return this.getCircularChild(this.currentIndex + 1);
    }
    /** Finds the element before the current one according to the order of the view. */
    #findPrev(): HTMLElement {
        return this.getCircularChild(this.currentIndex - 1);
    }
    /**
     * @param child - Element of the view to index.
     * @returns an integer indicating the position (0-based) of `child` within the current view; -1 if not present
     */
    public indexOf(child: HTMLElement): number {
        return this.#indexesMap.get(child) ?? -1;
    }

    /**
     * @param maybe - Element to look for in the view.
     * @returns `true` if the element is in the current view, `false` otherwise.
     */
    public isChild(maybe: HTMLElement): boolean {
        return this.#indexesMap.has(maybe);
    }

    /**
     * @param index - Position (0-based) of searched element within the current view.
     * @returns 
     * the element at the indicated position;    
     * `undefined` if the index is negative or exceeds the range of the view.
     */
    public getChild(index: number): HTMLElement | undefined {
        return this.#view[index];
    }
    /**
     * @param index - Position (0-based) of an element within the current view.
     * @returns the normalized index according to current view size.
     */
    #getCircularIndex(index: number): number {
        const length = this.#viewSize;
        return (index % length) + (index < 0 ? length : 0);
    }
    /**
     * @param index - Position (0-based) of searched element within the current view; 
     * the index will be normalized to fit the size of the view.
     * @returns the element at the indicated position.
     */
    public getCircularChild(index: number): HTMLElement {
        const i = this.#getCircularIndex(index);
        return this.#view[i]!;
    }

    /**
     * 
     * @param id - Id of the element within the current view.
     * @returns the element if it exists and is in the view; `undefined` otherwise.
     */
    public getChildById(id: string): HTMLElement | undefined {
        const maybe = document.getElementById(id);
        if (maybe && this.isChild(maybe)) return maybe;
    }

    // VIEW OBSERVER =============================================

    /**
     * Iterates on all the children of the carousel
     * to set un an observer for their 'hidden'
     * attributes.
     * 
     * The process only triggers when the total
     * count of elements in the carousel changes.
     */
    #observeChildren() {
        const { children } = this;
        const { length } = children;
        // Verify if a recalc of observed children is needed
        // if (this.#childrenAmount === length) return; // exit if not

        // The amount of children has changed; 
        // update to new amount
        //this.#childrenAmount = length;
        // reset the observer
        this.#hiddnObserver.disconnect();
        // recalc observed children
        for (const child of children) {
            this.#hiddnObserver.observe(child, _eachChildObsOpt);
        }
    }
    /**
     * Start watching carousel for child injection/removal
     * and all of its children for `hidden` attribute changes.
     */
    #startViewObserver() {
        this.#childObserver.observe(this, _childListObsOpt);
        this.#observeChildren();
    }
    /** Stops all the observers. */
    #stopViewObserver() {
        this.#childObserver.disconnect();
        this.#hiddnObserver.disconnect();
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

        // update view size
        this.#view = visible;
        const { length } = visible;
        this.#viewSize = length;

        // if the number of elements in the view is too small, 
        // remove touch listeners, else add them.
        if (length <= 1) this.removeTouchListeners();
        else this.addTouchListeners();

        // set up current, previous and next
        this.#ensureCurrentState();
    }

    // STARTUP & TEARDOWN =============================================

    connectedCallback(): void {
        this.#startViewObserver();
        this.#buildView();
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

    #startTransitionTo(target: HTMLElement, direction: TransitionDirection) {
        // If we need to translate left,
        // then `current` must move on the left
        _positionAtSides(this.current, direction);
        // will move to the center
        _positionAtCenter(this.#curr = target);
    }

    #setupTransitionEnd() {
        this.current.addEventListener('transitionend', () => {
            this.#ensureCurrentState();
            this.current.focus();
            this.#lock.unlock();
            if (this.#afterTransition) this.#afterTransition();
        }, { once: true });
    }

    toNext() { this.#transitionTo(this.next); }
    toPrev() { this.#transitionTo(this.previous); }
    to(target: HTMLElement) { this.#transitionTo(target); }

    #transitionTo(target: HTMLElement) {
        // If target is the same as current, do nothing;
        // this also excludes `this.currentIndex === i`|`distance === 0` case
        const lock = this.#lock;
        if (lock.isLocked || this.current === target) return;
        lock.lock();

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
        _positionAtSides(target, !translateLeft);
        target.inert = false;

        requestTransitionFrame(() => {
            this.#startTransitionTo(target, translateLeft);
            this.#setupTransitionEnd();
        });

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
        if (direction === PointerMoveDirection.VERTICAL
            || !(startY && startX)
        ) return;

        const { clientX, clientY } = e;

        const deltaX = clientX - startX;

        // set movement direction
        if (!direction)
            if (Math.abs(startY - clientY) >= Math.abs(deltaX)) {
                coord.direction = PointerMoveDirection.VERTICAL;
                return;
            } else {
                coord.direction = PointerMoveDirection.HORIZONTAL;
                this.#isTranslating(true);
                this.#lock.lock();
            }

        // if: direction = PointerMoveDirection.HORIZONTAL;
        if (deltaX > 0 && this.previous.inert) {
            // reposition in case there are only 2 elements
            this.#positionedPrev.inert = false;
            this.next.inert = true;
        }
        else if (deltaX < 0 && this.next.inert) {
            this.#positionedNext.inert = false;
            this.previous.inert = true;
        }

        this.#setTranslationVar(deltaX);

    }
    /**
     * 
     * @param e 
     * @param coord 
     */
    #handlePointerUp(e: PointerEvent, coord: Coordinates) {
        const { startX, startY, direction } = coord;
        if (direction === PointerMoveDirection.VERTICAL
            || !(startY && startX && direction)
        ) return;
        const { clientX } = e;

        const deltaX = clientX - startX;

        const threshold = Math.abs(this.clientWidth * THRESHOLD);
        // reset coordinates
        coord.reset();

        // No need for animation frame since
        // both elements are already visible

        // remove translation vars
        this.#unsetTranslationVar();
        // if above threshold, transition:
        // re-enable transitions
        this.#isTranslating(false);
        if (deltaX > threshold) {
            this.#startTransitionTo(this.previous, TransitionDirection.RIGHT);
        }
        else if (deltaX < -threshold) {
            this.#startTransitionTo(this.next, TransitionDirection.LEFT);
        }
        this.#setupTransitionEnd();

        // if none, slide back into position 
        // (will happen naturally since translation
        // only need to reset all to inert at the end
        // variables have been removed)
    }

}
export const CAROUSEL_TAG = appConfig.css.customElements.CAROUSEL_TAG
customElements.define(CAROUSEL_TAG, Carousel);

declare global {
  interface HTMLElementTagNameMap {
    [CAROUSEL_TAG]: Carousel;
  }
}
