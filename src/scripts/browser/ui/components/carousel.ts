/* eslint-disable baseline-js/use-baseline */
import { IllegalArgumentError } from "../../../../errors/common-errors.mjs";
import { MicrotaskScheduler } from "../../../../tools/microtask-scheduler.mjs";
import type { Brand } from "../../../shared/general-types.js";
import { Lock } from "../../../../tools/lock.mjs";
import { hiddenStateChangeEvent, type HiddenStateChangeEvent } from "../hidden-state-change-event.js";
import { Slide } from "../mixins/add_behaviour/slide.mixin.js";
import { SlideTranslator, type TranslatorHost } from "../slide-translator.js";

const DEFAULTS = {
    threshold: 0.3,
    translationVar: '--carousel-translation-offset'
} as const;
type left = Brand<true, 'left'>
type right = Brand<false, 'right'>
const TransitionDirection = { LEFT: true as left, RIGHT: false as right } as const;
type TransitionDirection = typeof TransitionDirection[keyof typeof TransitionDirection];

const _childListObsOpt: MutationObserverInit = { childList: true };
const Position = Slide.Position;

export class Carousel extends HTMLElement implements TranslatorHost {

    // STATE MANAGERS =========================================
    readonly #lock = new Lock();
    readonly #translator = new SlideTranslator(this, {
        threshold: DEFAULTS.threshold, 
        cssVariable: DEFAULTS.translationVar
    });
    /** A structural change arrived while a transition held the lock. */
    #reconcileDeferred = false;

    // VIEW ================================================
    readonly #indexesMap = new Map<Slide, number>();
    #view: Slide[] = [];
    get size() { return this.#view.length; }

    public get translating(): boolean { return this.hasAttribute('translating'); }
    public set translating(value: boolean) { this.toggleAttribute('translating', value); }

    // WINDOW ==================================================
    #curr: Slide | null = null;
    get current() { return this.#curr; }
    get currentIndex(): number { return this.#curr ? this.indexOf(this.#curr) : -1; }
    #prev: Slide | null = null;
    get previous() { return this.#prev; }
    #next: Slide | null = null;
    get next() { return this.#next; }

    // PRIVATE ACCESSORS ==================================================
    #getCurrent(): Slide | null {
        const curr = this.#curr;
        if (curr?.isConnected && this.isChild(curr)) return curr;
        return this.#view[0] ?? null;
    }
    #findNext(): Slide { return this.getCircularChild(this.currentIndex + 1); }
    #findPrev(): Slide { return this.getCircularChild(this.currentIndex - 1); }

    /** Euclidean modulo: valid for any integer, positive or negative. */
    #getCircularIndex(index: number): number {
        const length = this.size;
        return ((index % length) + length) % length;
    }

    // PUBLIC ACCESSORS ================================
    public indexOf(child: Slide): number { return this.#indexesMap.get(child) ?? -1; }
    public isChild(maybe: HTMLElement): maybe is Slide {
        return Slide.isInstance(maybe) && this.#indexesMap.has(maybe);
    }
    public getChild(index: number): Slide | null { return this.#view[index] ?? null; }
    public getCircularChild(index: number): Slide {
        return this.#view[this.#getCircularIndex(index)]!;
    }
    public getChildById(id: string): Slide | undefined {
        const maybe = document.getElementById(id);
        if (maybe && this.isChild(maybe)) return maybe;
    }

    // ATTRIBUTES ===================================
    get infinite(): boolean { return this.hasAttribute('infinite'); }
    set infinite(v: boolean) { this.toggleAttribute('infinite', v); }


    get threshold(): number {
        const t = Number.parseInt(this.getAttribute('threshold') ?? '0') ?? 0;
        return Number.isNaN(t) ? 0 : t;
    }
    set threshold(v: number) {
        this.setAttribute('threshold', v.toFixed(0));
    }

    /* translateX(attr(offset px, 0px)) 
    nvm*/
    get offset() { return this.getAttribute('offset') ?? '0'; }
    set offset(v: string) {
        this.setAttribute('offset', v);
    }
    static get observedAttributes(): string[] {
        return ['threshold', 'offset'];
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'threshold'
            && oldValue !== newValue) {

        } else if (name === 'infinite' &&
            (oldValue === null) !== (newValue === null)
        ) {
            /* Must change looping behaviour */
        }
    }    // VIEW HANDLING ================================
    #alignIndexesToView(start = 0) {
        const view = this.#view;
        for (let i = start; i < view.length; i++) this.#indexesMap.set(view[i]!, i);
    }
    #removeFromView(child: Slide) {
        const idx = this.indexOf(child);
        if (idx < 0) return; // never in view (e.g. was hidden): nothing to do
        this.#view.splice(idx, 1);
        this.#indexesMap.delete(child);
        this.#alignIndexesToView(idx);
    }
    #findInsertionIndex(child: Slide): number {
        const view = this.#view;
        let lo = 0, hi = view.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const after = child.compareDocumentPosition(view[mid]!) & Node.DOCUMENT_POSITION_FOLLOWING;
            if (after) hi = mid; else lo = mid + 1;
        }
        return lo;
    }
    #insertIntoView(child: Slide) {
        if (this.isChild(child)) return;
        const idx = this.#findInsertionIndex(child);
        this.#view.splice(idx, 0, child);
        this.#alignIndexesToView(idx);
    }
    #inertAllExcept(except: Slide) {
        for (const child of this.#view) {
            if (child.inert || child === except) continue;
            child.inert = true;
        }
    }

    #ensureSides(): { prev: Slide, next: Slide } {
        const prev = this.#prev = this.#findPrev();
        const next = this.#next = this.#findNext();
        // With only two slides prev === next: it rests on the right.
        if (prev !== next) prev.settle(Position.left);
        next.settle(Position.right);
        prev.prepare?.();
        next.prepare?.();
        return { prev, next };
    }

    #reconcileWindow() {
        const curr = this.#curr = this.#getCurrent();
        const translator = this.#translator;
        const oldPrev = this.#prev, oldNext = this.#next;

        if (!curr) {
            this.#prev = this.#next = null;
            translator.abort();
            translator.resetWindow();
        } else {
            this.#inertAllExcept(curr);
            void curr.activate({ withTransition: false });

            if (this.size < 2) {
                this.#prev = this.#next = null;
                translator.abort();
                translator.resetWindow();
            } else {
                const { prev, next } = this.#ensureSides();
                translator.listen();
                prev === next
                    ? translator.setWindow(curr, prev)
                    : translator.setWindow(curr, prev, next);
            }
        }

        for (const stale of [oldPrev, oldNext])
            if (stale && stale !== this.#prev && stale !== this.#next && stale !== curr)
                stale.unprepare?.();
    }

    /**
     * Structural changes are batched in a microtask. If a transition holds
     * the lock the window must not be touched mid-animation: the work is
     * deferred until the lock is released (never busy-retried: re-queuing
     * a microtask from a microtask would starve the event loop).
     */
    readonly #reconcile = new MicrotaskScheduler(() => {
        if (this.#lock.isLocked) this.#reconcileDeferred = true;
        else this.#reconcileWindow();
    });

    /** Releases the lock and runs any reconciliation deferred meanwhile. */
    #releaseLock() {
        this.#lock.unlock();
        if (this.#reconcileDeferred) {
            this.#reconcileDeferred = false;
            this.#reconcileWindow();
        }
    }

    // CHILDREN MUTATIONS HANDLERS =============================================
    readonly #childObserver = new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.removedNodes)
                if (Slide.isInstance(node)) this.#removeFromView(node);
            for (const node of record.addedNodes)
                if (Slide.isInstance(node) && !node.hasAttribute('hidden'))
                    this.#insertIntoView(node);
        }
        this.#reconcile.schedule();
    });

    readonly #handleChildHidden = (e: Event) => {
        const ev = e as HiddenStateChangeEvent;
        const slide = ev.target;
        if (!(Slide.isInstance(slide)) || slide.parentElement !== this) return;
        if (ev.new !== false) this.#removeFromView(slide);
        else this.#insertIntoView(slide);
        this.#reconcile.schedule();
    }

    #startViewObserver() {
        this.#childObserver.observe(this, _childListObsOpt);
        this.addEventListener(hiddenStateChangeEvent, this.#handleChildHidden);
    }
    #stopViewObserver() {
        this.#childObserver.disconnect();
        this.removeEventListener(hiddenStateChangeEvent, this.#handleChildHidden);
    }

    #buildView(): void {
        const visible: Slide[] = [];
        this.#indexesMap.clear();
        for (const child of this.children) {
            if (!child.hasAttribute('hidden') && Slide.isInstance(child)) {
                this.#indexesMap.set(child, visible.length);
                visible.push(child);
            }
        }
        this.#view = visible;
        this.#reconcileWindow();
    }

    // STARTUP & TEARDOWN =============================================
    connectedCallback(): void {
        this.#startViewObserver();
        this.#buildView();

    }
    disconnectedCallback(): void {
        this.#stopViewObserver();
        this.#translator.abort();
    }

    // TRANSITION BY POSITION ================================================
    public async toNext(): Promise<boolean> { return this.#next ? this.#transitionTo(this.#next) : false; }
    public async toPrev(): Promise<boolean> { return this.#prev ? this.#transitionTo(this.#prev) : false; }
    public async to(target: Slide): Promise<boolean> {
        // validated before touching the lock: a bad argument must never leave it held
        if (!this.isChild(target))
            throw new IllegalArgumentError("Cannot translate to a target outside the current view");
        return this.#transitionTo(target);
    }

    #determineDirection(targetI: number): TransitionDirection {
        const distance = targetI - this.currentIndex;
        // consecutive at the extremes of the view: reverse (circular)
        return ((Math.abs(distance) === (this.size - 1)) ? distance < 0 : distance > 0)
            ? TransitionDirection.LEFT
            : TransitionDirection.RIGHT;
    }

    async #performTransition(target: Slide, toLeft: TransitionDirection, options: { targetNoTransition?: true, currentNoTransition?: true } = {}): Promise<boolean> {
        const current = this.#curr;
        if (!current) { this.#releaseLock(); return false; }
        const { targetNoTransition, currentNoTransition } = options;
        try {
            // A slide peeked during a drag is already active, and `activate()`
            // is a no-op on active slides: bring it back to rest (still on its
            // side) so the activation actually animates it to the center.
            target.inert = true;
            await Promise.allSettled([
                target.activate({ withTransition: !targetNoTransition, from: toLeft ? Position.right : Position.left }),
                current.deactivate({ withTransition: !currentNoTransition, left: toLeft })
            ]);
            // the target becomes current *before* reconciling: `#getCurrent()`
            // keeps the old one as long as it is still a connected child
            this.#curr = target;
            this.#reconcileWindow();
            this.#curr?.focus();
            return true;
        } finally {
            this.#releaseLock();
        }
    }

    async #transitionTo(target: Slide): Promise<boolean> {
        const current = this.#curr;
        if (!current || current === target) return false;
        if (this.#lock.isLocked) return false;
        this.#lock.lock();
        return this.#performTransition(target, this.#determineDirection(this.indexOf(target)));
    }

    // TRANSLATOR HOST ================================================
    requestLock(): boolean {
        if (this.#lock.isLocked) return false;
        this.#lock.lock();
        return true;
    }

    #peekedSlide(peeked: 'left' | 'right' | null): Slide | null {
        return peeked === 'left' ? this.#prev : peeked === 'right' ? this.#next : null;
    }

    onCommit(direction: 'right' | 'left'): void {
        // dragging right reveals the previous slide, dragging left the next one
        const target = direction === 'right' ? this.#prev : this.#next;
        if (!target) { this.#releaseLock(); return; }
        this.#performTransition(
            target,
            direction === 'left' ? TransitionDirection.LEFT : TransitionDirection.RIGHT,
            { targetNoTransition: true }
        );
    }

    onCancel(peeked: 'left' | 'right' | null): void {
        const slide = this.#peekedSlide(peeked);
        if (!slide) { this.#releaseLock(); return; }
        void slide.deactivate({ withTransition: true, ...(peeked === 'left' ? { newPos: Position.left } : { newPos: Position.right }) })
            .finally(() => this.#releaseLock());
    }

    onInterrupt(peeked: 'left' | 'right' | null): void {
        const slide = this.#peekedSlide(peeked);
        void slide?.deactivate({ withTransition: true, ...(peeked === 'left' ? { newPos: Position.left } : { newPos: Position.right }) });
        this.#releaseLock();
    }
}
