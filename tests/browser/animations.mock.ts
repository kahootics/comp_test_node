/**
 * jsdom has no Web Animations: the Slide mixin waits for `getAnimations()` to list running
 * `CSSTransition`s on `transform`. These doubles stand in for them, under the test's control.
 */
export class FakeCSSTransition {
    readonly finished: Promise<unknown>;
    #resolve!: (v?: unknown) => void;
    #reject!: (e: unknown) => void;
    constructor(readonly transitionProperty: string, private readonly onEnd: (t: FakeCSSTransition) => void) {
        this.finished = new Promise((resolve, reject) => { this.#resolve = resolve; this.#reject = reject; });
        this.finished.catch(() => { /* a cancelled one is not an unhandled rejection */ });
    }
    finish() { this.onEnd(this); this.#resolve(this); }
    cancel() { this.onEnd(this); this.#reject(new DOMException('The animation was aborted', 'AbortError')); }
}

/** An animation that is not a transition (a CSS animation): it must be ignored. It never finishes. */
export class FakeCSSAnimation {
    readonly finished = new Promise(() => { /* never */ });
    constructor(readonly animationName: string) {}
}

const running = new WeakMap<Element, unknown[]>();

export function installAnimations() {
    (globalThis as any).CSSTransition = FakeCSSTransition;
    (Element.prototype as any).getAnimations = function (this: Element) { return [...(running.get(this) ?? [])]; };
}

function add(el: Element, animation: unknown) {
    running.set(el, [...(running.get(el) ?? []), animation]);
}

/** Makes a transition of the given property "running" on the element, until it is finished or cancelled. */
export function startTransition(el: Element, property = 'transform'): FakeCSSTransition {
    const t = new FakeCSSTransition(property, done => running.set(el, (running.get(el) ?? []).filter(a => a !== done)));
    add(el, t);
    return t;
}

export function startAnimation(el: Element): FakeCSSAnimation {
    const a = new FakeCSSAnimation('spin');
    add(el, a);
    return a;
}