// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

// Assumes 'inert' attribute is supported in test environment
vi.mock('../../src/ui/components/mixins/add_behaviour/inert-polyfill.mixin.js', async () => ({
    InertPolyfill: createMixin<HTMLElement,HTMLElement>('inert', 
        () => <TBase extends Constructor<HTMLElement>>(base: TBase) => class a extends base {}),
})); 

import { Slide } from '../../src/scripts/browser/ui/mixins/add_behaviour/slide.mixin.js';
import { InertPolyfill } from '../../src/scripts/browser/ui/mixins/add_behaviour/inert-polyfill.mixin.js';
import { HiddenStateChangeEvent, hiddenStateChangeEvent } from '../../src/scripts/browser/ui/hidden-state-change-event.js';
import { IllegalArgumentError, IllegalStateError } from '../../src/errors/common-errors.mjs';
import { installAnimations, startAnimation, startTransition } from './animations.mock.js';
import { createMixin, type Constructor } from '../../src/tools/create-mixin.mjs';

// jsdom has no Web Animations (see the fakes) and no real CSS: what the browser does with the
// transitions that `position` changes start is simulated by registering them before the call.

beforeAll(installAnimations);

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

// HELPERS ===========================================

let counter = 0;
type Side = 'left' | 'right';

/** Applies the mixin to a base and registers the result. */
function defineSlide(Base: any = HTMLElement, defaultPosition?: Side) {
    const Cls = Slide(Base, defaultPosition);
    const tag = `test-slide-${counter++}`;
    customElements.define(tag, Cls);
    return { Cls, tag };
}

const { tag: SLIDE } = defineSlide();

/** A slide, not yet connected. */
const make = (tag = SLIDE) => document.createElement(tag) as any;

/** A connected slide: inert, as every slide is when it connects. */
function mount(tag = SLIDE) {
    const el = make(tag);
    document.body.append(el);
    return el;
}

/** A connected slide that is active: at the center, not inert. */
function mountActive(tag = SLIDE) {
    const el = mount(tag);
    el.setAttribute('position', 'center');
    el.inert = false;
    return el;
}

const tick = () => new Promise<void>(r => setTimeout(r, 0));

/** Follows a promise without waiting for it. */
function track<T>(promise: Promise<T>) {
    const state = { done: false, value: undefined as T | undefined };
    promise.then(v => { state.done = true; state.value = v; });
    return state;
}

/** Records the state of the element each time the browser is asked to commit its styles. */
function spyOnStyleFlush() {
    const seen: { position: string | null; inert: boolean }[] = [];
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(((target: Element) => {
        seen.push({ position: target.getAttribute('position'), inert: target.hasAttribute('inert') });
        return { opacity: '1' } as CSSStyleDeclaration;
    }) as typeof getComputedStyle);
    return seen;
}

// THE MIXIN ===========================================

describe('the mixin', () => {
    test('builds a class that extends the base: its instances are elements', () => {
        const { Cls } = defineSlide();
        const el = new Cls();
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el).toBeInstanceOf(Cls);
    });

    test('exposes the available positions', () => {
        expect(Slide.Position).toEqual({ left: 'left', center: 'center', right: 'right' });
    });

    test('brands its instances, however they are created', () => {
        const { Cls, tag } = defineSlide();
        expect(Slide.isInstance(new Cls())).toBe(true);
        expect(Slide.isInstance(document.createElement(tag))).toBe(true);
    });

    test('does not brand anything else', () => {
        expect(Slide.isInstance(document.createElement('div'))).toBe(false);
        expect(Slide.isInstance(null)).toBe(false);
        expect(Slide.isInstance({})).toBe(false);
        expect(Slide.isInstance(undefined)).toBe(false);
    });

    test('passes its constructor arguments on to the base', () => {
        class WithArgs extends HTMLElement {
            args: unknown[];
            constructor(...args: unknown[]) { super(); this.args = args; }
        }
        const { Cls } = defineSlide(WithArgs);
        expect(new Cls('x', 2).args).toEqual(['x', 2]);
    });

    test('refuses a base that already has a `position`, naming the class', () => {
        class HasPosition extends HTMLElement { get position() { return 'x'; } }
        expect(() => Slide(HasPosition)).toThrow(IllegalArgumentError);
        expect(() => Slide(HasPosition)).toThrow(/HasPosition/);
    });

    /*  test('refuses an inert polyfill that introduces a `position`', () => {
        vi.mocked(InertPolyfill as any).mockImplementationOnce(
            (createMixin<HTMLElement,HTMLElement>('inert', 
        () => <TBase extends Constructor<HTMLElement>>(base: TBase) => class a extends base { get position() { return 2; }}))
        );
        expect(() => Slide(HTMLElement)).toThrow(IllegalStateError);
    });  */
});

// POSITION ===========================================

describe('position', () => {
    test('is the default one when there is no attribute: left, unless chosen otherwise', () => {
        expect(make().position).toBe('left');
        const { tag } = defineSlide(HTMLElement, 'right');
        expect(make(tag).position).toBe('right');
    });

    test.each(['left', 'center', 'right'])('reads %s from the attribute', (pos) => {
        const el = make();
        el.setAttribute('position', pos);
        expect(el.position).toBe(pos);
    });

    test('reads an invalid attribute as the default', () => {
        const el = make();
        el.setAttribute('position', 'top');
        expect(el.position).toBe('left');
    });

    test('writing it sets the attribute', () => {
        const el = make();
        el.position = 'right';
        expect(el.getAttribute('position')).toBe('right');
        expect(el.position).toBe('right');
    });

    describe('isPositioned', () => {
        test('is false without the attribute, even though `position` has a default', () => {
            const el = make();
            expect(el.position).toBe('left');
            expect(el.isPositioned).toBe(false);
        });

        test('is false for an invalid attribute', () => {
            const el = make();
            el.setAttribute('position', 'top');
            expect(el.isPositioned).toBe(false);
        });

        test.each(['left', 'center', 'right'])('is true for %s', (pos) => {
            const el = make();
            el.setAttribute('position', pos);
            expect(el.isPositioned).toBe(true);
        });
    });
});

// isActive ===========================================

describe('isActive', () => {
    test('is true for a connected slide at the center, not inert, not hidden', () => {
        expect(mountActive().isActive).toBe(true);
    });

    test('is false when it is not connected', () => {
        const el = mountActive();
        el.remove();
        expect(el.isActive).toBe(false);
    });

    test('is false when it is inert', () => {
        const el = mountActive();
        el.inert = true;
        expect(el.isActive).toBe(false);
    });

    test('is false when it is hidden', () => {
        const el = mountActive();
        el.hidden = true;
        expect(el.isActive).toBe(false);
    });

    test.each(['left', 'right'])('is false when it is at the %s', (pos) => {
        const el = mountActive();
        el.setAttribute('position', pos);
        expect(el.isActive).toBe(false);
    });

    test('is false when no position was ever set, whatever the default', () => {
        const { tag } = defineSlide(HTMLElement, 'right');
        const el = mount(tag);
        el.inert = false;
        expect(el.isActive).toBe(false);
    });
});

// CONNECTION ===========================================

describe('connection', () => {
    test('makes the slide inert: a slide is at rest until somebody activates it', () => {
        const el = mount();
        expect(el.hasAttribute('inert')).toBe(true);
        expect(el.inert).toBe(true);
    });

    test('is not active just by being connected, nor positioned', () => {
        const el = mount();
        expect(el.isActive).toBe(false);
        expect(el.isPositioned).toBe(false);
    });

    test('leaves alone a slide that already had the attribute', () => {
        const el = make();
        el.setAttribute('inert', '');
        document.body.append(el);
        expect(el.inert).toBe(true);
    });

    test('makes inert again an active slide that is moved (current behaviour: every connection, not only the first)', () => {
        const el = mountActive();
        const elsewhere = document.createElement('div');
        document.body.append(elsewhere);
        elsewhere.append(el);
        expect(el.inert).toBe(true);
        expect(el.position).toBe('center');
    });

    test('lets the base react to the connection first', () => {
        const seen: boolean[] = [];
        class Base extends HTMLElement {
            connectedCallback() { seen.push(this.hasAttribute('inert')); }
        }
        const { tag } = defineSlide(Base);
        const el = mount(tag);
        expect(seen).toEqual([false]);
        expect(el.inert).toBe(true);
    });
});

// ATTRIBUTES AND THE BASE ===========================================

describe('attributes and the base', () => {
    test('observes `hidden`', () => {
        expect((Slide(HTMLElement) as any).observedAttributes).toContain('hidden');
    });

    test('observes what the base observes, too', () => {
        class Base extends HTMLElement { static get observedAttributes() { return ['foo']; } }
        const { Cls } = defineSlide(Base);
        expect(Cls.observedAttributes).toEqual(expect.arrayContaining(['foo', 'hidden']));
    });

    test('lets the base see every attribute change, hidden included', () => {
        const seen: unknown[][] = [];
        class Base extends HTMLElement {
            static get observedAttributes() { return ['foo']; }
            attributeChangedCallback(...args: unknown[]) { seen.push(args); }
        }
        const { tag } = defineSlide(Base);
        const el = mount(tag);
        el.setAttribute('foo', 'a');
        el.setAttribute('foo', 'b');
        el.setAttribute('hidden', '');
        expect(seen).toEqual([['foo', null, 'a'], ['foo', 'a', 'b'], ['hidden', null, '']]);
    });

    test('works with a base that has none of those hooks', () => {
        const el = mount();
        expect(() => { el.setAttribute('hidden', ''); el.removeAttribute('hidden'); }).not.toThrow();
    });
});

// THE HIDDEN EVENT ===========================================

describe('the event of a change of the hidden state', () => {
    function listen(el: HTMLElement) {
        const events: HiddenStateChangeEvent[] = [];
        el.addEventListener(hiddenStateChangeEvent, e => events.push(e as HiddenStateChangeEvent));
        return events;
    }

    test('is fired when the slide gets hidden, telling what it was and what it is', () => {
        const el = mount();
        const events = listen(el);
        el.setAttribute('hidden', '');
        expect(events).toHaveLength(1);
        expect([events[0]!.old, events[0]!.new]).toEqual([false, true]);
    });

    test('is fired when it is shown again', () => {
        const el = mount();
        el.hidden = true;
        const events = listen(el);
        el.hidden = false;
        expect(events).toHaveLength(1);
        expect([events[0]!.old, events[0]!.new]).toEqual([true, false]);
    });

    test('has the slide as its target, and bubbles', () => {
        const el = mount();
        const parentSeen: Event[] = [];
        document.body.addEventListener(hiddenStateChangeEvent, e => parentSeen.push(e));
        el.hidden = true;
        expect(parentSeen).toHaveLength(1);
        expect(parentSeen[0]!.target).toBe(el);
        expect(parentSeen[0]!.bubbles).toBe(true);
    });

    test('is fired also for a slide that is not connected', () => {
        const el = make();
        const events = listen(el);
        el.hidden = true;
        expect(events).toHaveLength(1);
    });

    test('is not fired for other attributes', () => {
        const el = mount();
        const events = listen(el);
        el.setAttribute('position', 'right');
        el.setAttribute('data-x', '1');
        el.inert = false;
        expect(events).toEqual([]);
    });

    test('is not fired when the attribute is set again to the same value', () => {
        const el = mount();
        el.setAttribute('hidden', '');
        const events = listen(el);
        el.setAttribute('hidden', '');
        expect(events).toEqual([]);
    });

    test('is not fired when the value changes but the slide is hidden before and after', () => {
        const el = mount();
        el.setAttribute('hidden', '');
        const events = listen(el);
        el.setAttribute('hidden', 'hidden');
        expect(events).toEqual([]);
    });

    describe('with `hidden="until-found"`', () => {
        // jsdom's `hidden` is a plain boolean: this base reads it the way the browsers that
        // support `until-found` do.
        class UntilFound extends HTMLElement {
            get hidden(): any {
                const v = this.getAttribute('hidden');
                return v === null ? false : v === 'until-found' ? 'until-found' : true;
            }
            set hidden(v: any) { if (v) this.setAttribute('hidden', v === true ? '' : v); else this.removeAttribute('hidden'); }
        }
        const { tag } = defineSlide(UntilFound);

        test.each([
            [null, 'until-found', false, 'until-found'],
            ['until-found', null, 'until-found', false],
            ['', 'until-found', true, 'until-found'],
            ['until-found', '', 'until-found', true],
        ])('from %j to %j it tells old=%j new=%j', (before, after, old, now) => {
            const el = make(tag);
            if (before !== null) el.setAttribute('hidden', before);
            const events = listen(el);
            if (after === null) el.removeAttribute('hidden'); else el.setAttribute('hidden', after);
            expect(events).toHaveLength(1);
            expect([events[0]!.old, events[0]!.new]).toEqual([old, now]);
        });

        test('a hidden-until-found slide is not active', () => {
            const el = mountActive(tag);
            el.setAttribute('hidden', 'until-found');
            expect(el.isActive).toBe(false);
        });
    });
});

// ACTIVATE ===========================================

describe('activate', () => {
    test('without options, moves the slide to the center at once and makes it interactive', async () => {
        const el = mount();
        const result = await el.activate();
        expect(result).toBe(true);
        expect(el.position).toBe('center');
        expect(el.inert).toBe(false);
        expect(el.isActive).toBe(true);
    });

    test('with `withTransition: false` does the same, without committing styles', async () => {
        const el = mount();
        const flushes = spyOnStyleFlush();
        expect(await el.activate({ withTransition: false })).toBe(true);
        expect(el.position).toBe('center');
        expect(el.inert).toBe(false);
        expect(flushes).toEqual([]);
    });

    test('instant: it moves to the center while still inert, and only then becomes interactive', async () => {
        const el = mount();
        const states: string[] = [];
        const observer = new MutationObserver(records => records.forEach(r => states.push(r.attributeName!)));
        observer.observe(el, { attributes: true, attributeFilter: ['position', 'inert'] });
        await el.activate({ withTransition: false });
        await tick();
        expect(states).toEqual(['position', 'inert']);
    });

    describe('with a transition', () => {
        test('jumps to the starting side while still inert, commits the styles, and only then goes to the center', async () => {
            const el = mount();
            const flushes = spyOnStyleFlush();
            const done = el.activate({ withTransition: true, from: 'right' });
            // what the browser sees when asked to commit styles: already on the right, still inert
            expect(flushes).toEqual([{ position: 'right', inert: true }]);
            expect(el.position).toBe('center');
            expect(el.inert).toBe(false);
            await done;
        });

        test('without a starting side, commits the styles where the slide already is', async () => {
            const el = mount();
            el.setAttribute('position', 'left');
            const flushes = spyOnStyleFlush();
            await el.activate({ withTransition: true });
            expect(flushes).toEqual([{ position: 'left', inert: true }]);
            expect(el.position).toBe('center');
        });

        test('is interactive from the start of the transition, not from its end', async () => {
            const el = mount();
            const transition = startTransition(el);
            const state = track(el.activate({ withTransition: true, from: 'left' }));
            await tick();
            expect(state.done).toBe(false);
            expect(el.inert).toBe(false);
            expect(el.position).toBe('center');
            transition.finish();
            await tick();
            expect(state.done).toBe(true);
        });

        test('resolves true when the transition ends', async () => {
            const el = mount();
            const transition = startTransition(el);
            const done = el.activate({ withTransition: true });
            transition.finish();
            expect(await done).toBe(true);
        });

        test('waits for every running transform transition', async () => {
            const el = mount();
            const first = startTransition(el), second = startTransition(el);
            const state = track(el.activate({ withTransition: true }));
            first.finish();
            await tick();
            expect(state.done).toBe(false);
            second.finish();
            await tick();
            expect(state.done).toBe(true);
        });

        test('waits for a transition that also covers other properties', async () => {
            const el = mount();
            const transition = startTransition(el, 'opacity, transform');
            const state = track(el.activate({ withTransition: true }));
            await tick();
            expect(state.done).toBe(false);
            transition.finish();
            await tick();
            expect(state.done).toBe(true);
        });

        test('does not wait for transitions of other properties, nor for animations that are not transitions', async () => {
            const el = mount();
            startTransition(el, 'opacity');
            startAnimation(el);
            expect(await el.activate({ withTransition: true })).toBe(true);
        }, 1000);

        test('resolves also when a transition is cancelled', async () => {
            const el = mount();
            const transition = startTransition(el);
            const done = el.activate({ withTransition: true });
            transition.cancel();
            expect(await done).toBe(true);
        });

        test('resolves right away when no transition starts', async () => {
            const el = mount();
            const state = track(el.activate({ withTransition: true, from: 'left' }));
            await tick();
            expect(state.done).toBe(true);
            expect(state.value).toBe(true);
        });
    });

    describe('when the slide is not inert', () => {
        test('resolves false and changes nothing: it is already active', async () => {
            const el = mountActive();
            const flushes = spyOnStyleFlush();
            expect(await el.activate({ withTransition: true, from: 'left' })).toBe(false);
            expect(el.position).toBe('center');
            expect(flushes).toEqual([]);
        });

        test('does not move a slide that was activated and then went somewhere else without becoming inert', async () => {
            const el = mountActive();
            el.setAttribute('position', 'right');
            expect(await el.activate()).toBe(false);
            expect(el.position).toBe('right');
        });
    });

    test('always returns a promise, also when it resolves false', () => {
        expect(mountActive().activate()).toBeInstanceOf(Promise);
        expect(mount().activate()).toBeInstanceOf(Promise);
    });
});

// DEACTIVATE ===========================================

describe('deactivate', () => {
    test('without options, moves the slide to the default side at once and makes it inert', async () => {
        const el = mountActive();
        expect(await el.deactivate()).toBe(true);
        expect(el.position).toBe('left');
        expect(el.inert).toBe(true);
        expect(el.isActive).toBe(false);
    });

    test('goes to the right if that is the default chosen when applying the mixin', async () => {
        const { tag } = defineSlide(HTMLElement, 'right');
        const el = mountActive(tag);
        await el.deactivate();
        expect(el.position).toBe('right');
    });

    test.each([
        [{ newPos: 'right' }, 'right'],
        [{ newPos: 'left' }, 'left'],
        [{ left: true }, 'left'],
        [{ left: false }, 'right'],
        [{ right: true }, 'right'],
        [{ right: false }, 'left'],
        [{ newPos: 'right', left: true }, 'right'],
        [{}, 'left'],
    ])('with %j it goes to the %s', async (direction, expected) => {
        const el = mountActive();
        await el.deactivate({ withTransition: false, ...direction });
        expect(el.position).toBe(expected);
        expect(el.inert).toBe(true);
    });

    test('with transition and no direction, goes to the default side', async () => {
        const { tag } = defineSlide(HTMLElement, 'right');
        const el = mountActive(tag);
        await el.deactivate({ withTransition: true });
        expect(el.position).toBe('right');
    });

    test('without transition, does not commit styles', async () => {
        const el = mountActive();
        const flushes = spyOnStyleFlush();
        await el.deactivate({ withTransition: false, left: true });
        expect(flushes).toEqual([]);
    });

    describe('with a transition', () => {
        test('commits the styles where the slide is, and only then moves it away', async () => {
            const el = mountActive();
            const flushes = spyOnStyleFlush();
            const done = el.deactivate({ withTransition: true, right: true });
            expect(flushes).toEqual([{ position: 'center', inert: false }]);
            expect(el.position).toBe('right');
            await done;
        });

        test('stays interactive until the transition ends, then becomes inert and resolves true', async () => {
            const el = mountActive();
            const transition = startTransition(el);
            const state = track(el.deactivate({ withTransition: true, left: true }));
            await tick();
            expect(state.done).toBe(false);
            expect(el.inert).toBe(false);
            expect(el.position).toBe('left');

            transition.finish();
            await tick();
            expect(state.done).toBe(true);
            expect(state.value).toBe(true);
            expect(el.inert).toBe(true);
        });

        test('waits for every running transform transition', async () => {
            const el = mountActive();
            const first = startTransition(el), second = startTransition(el);
            const state = track(el.deactivate({ withTransition: true }));
            first.finish();
            await tick();
            expect(el.inert).toBe(false);
            second.finish();
            await tick();
            expect(state.done).toBe(true);
            expect(el.inert).toBe(true);
        });

        test('does not wait for transitions of other properties, nor for animations that are not transitions', async () => {
            const el = mountActive();
            startTransition(el, 'opacity');
            startAnimation(el);
            expect(await el.deactivate({ withTransition: true })).toBe(true);
            expect(el.inert).toBe(true);
        }, 1000);

        test('becomes inert also when a transition is cancelled', async () => {
            const el = mountActive();
            const transition = startTransition(el);
            const done = el.deactivate({ withTransition: true });
            transition.cancel();
            expect(await done).toBe(true);
            expect(el.inert).toBe(true);
        });

        test('becomes inert right away when no transition starts', async () => {
            const el = mountActive();
            const state = track(el.deactivate({ withTransition: true, left: true }));
            await tick();
            expect(state.done).toBe(true);
            expect(el.inert).toBe(true);
        });

        test('cannot be undone while it lasts: the slide is not inert yet, so it counts as active', async () => {
            const el = mountActive();
            const transition = startTransition(el);
            const leaving = el.deactivate({ withTransition: true, left: true });
            expect(await el.activate()).toBe(false);
            transition.finish();
            await leaving;
            expect(await el.activate()).toBe(true);
        });

        test('asking again while it lasts is allowed, and both resolve when it ends', async () => {
            const el = mountActive();
            const transition = startTransition(el);
            const first = el.deactivate({ withTransition: true, left: true });
            const second = el.deactivate({ withTransition: true, left: true });
            transition.finish();
            expect(await Promise.all([first, second])).toEqual([true, true]);
            expect(el.inert).toBe(true);
        });
    });

    describe('when the slide is inert', () => {
        test('resolves false and changes nothing: it is already deactivated', async () => {
            const el = mount();
            el.setAttribute('position', 'right');
            const flushes = spyOnStyleFlush();
            expect(await el.deactivate({ withTransition: true, left: true })).toBe(false);
            expect(el.position).toBe('right');
            expect(flushes).toEqual([]);
        });

        test('also a slide that never had a position', async () => {
            const el = mount();
            expect(await el.deactivate()).toBe(false);
            expect(el.isPositioned).toBe(false);
        });
    });

    test('always returns a promise, also when it resolves false', () => {
        expect(mount().deactivate()).toBeInstanceOf(Promise);
        expect(mountActive().deactivate()).toBeInstanceOf(Promise);
    });
});

// SETTLE ===========================================

describe('settle', () => {
    test.each(['left', 'right'] as const)('puts the slide at the %s and makes it inert', (side) => {
        const el = mountActive();
        el.settle(side);
        expect(el.position).toBe(side);
        expect(el.inert).toBe(true);
        expect(el.isPositioned).toBe(true);
    });

    test('works on a slide that is already inert, and on one that was never positioned', () => {
        const el = mount();
        el.settle('right');
        expect(el.position).toBe('right');
        expect(el.inert).toBe(true);
    });

    test('makes inert first, so that moving the slide fires no transition', () => {
        const el = mountActive();
        const order: string[] = [];
        const observer = new MutationObserver(() => {});
        observer.observe(el, { attributes: true });
        el.settle('left');
        order.push(...observer.takeRecords().map(r => r.attributeName!));
        expect(order).toEqual(['inert', 'position']);
    });

    test('is instant: it commits no styles, waits for nothing and returns nothing', () => {
        const el = mountActive();
        startTransition(el);
        const flushes = spyOnStyleFlush();
        expect(el.settle('left')).toBeUndefined();
        expect(flushes).toEqual([]);
        expect(el.inert).toBe(true);
    });

    test('leaves the slide ready to be activated', async () => {
        const el = mountActive();
        el.settle('right');
        expect(await el.activate({ withTransition: false })).toBe(true);
        expect(el.isActive).toBe(true);
    });
});

// A WHOLE LIFE ===========================================

describe('a slide through its life', () => {
    test('goes from rest to active to rest, on either side', async () => {
        const el = mount();
        expect([el.isActive, el.isPositioned, el.inert]).toEqual([false, false, true]);

        await el.activate({ withTransition: false });
        expect([el.isActive, el.position, el.inert]).toEqual([true, 'center', false]);

        await el.deactivate({ withTransition: false, right: true });
        expect([el.isActive, el.position, el.inert]).toEqual([false, 'right', true]);

        await el.activate({ withTransition: true, from: 'right' });
        expect([el.isActive, el.position]).toEqual([true, 'center']);

        await el.deactivate({ withTransition: true, left: true });
        expect([el.isActive, el.position, el.inert]).toEqual([false, 'left', true]);
    });

    test('as a carousel uses it: one slide leaves while the next arrives', async () => {
        const leaving = mountActive(), arriving = mount();
        arriving.settle('right');
        const out = startTransition(leaving), inn = startTransition(arriving);

        const both = Promise.all([
            arriving.activate({ withTransition: true, from: 'right' }),
            leaving.deactivate({ withTransition: true, left: true }),
        ]);
        expect([arriving.position, leaving.position]).toEqual(['center', 'left']);
        out.finish(); inn.finish();
        expect(await both).toEqual([true, true]);
        expect([arriving.isActive, leaving.isActive, leaving.inert]).toEqual([true, false, true]);
    });
});