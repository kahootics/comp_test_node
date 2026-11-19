/* eslint-disable baseline-js/use-baseline */
import { IllegalArgumentError, IllegalStateError } from "../../../../../errors/common-errors.mjs";
import { createMixin } from "../../../../../tools/create-mixin.mjs"
import type { Constructor } from "../../../../../tools/create-mixin.mjs";
import { HiddenStateChangeEvent, hiddenStateChangeEvent } from "../../hidden-state-change-event.js";
import { InertPolyfill, type InertCapable } from "./inert-polyfill.mixin.js";

const Position = {
    left: 'left',
    center: 'center',
    right: 'right'
} as const;
type PositionKey = typeof Position[keyof typeof Position];
type PositionKeySides = Exclude<PositionKey, typeof Position['center']>

function isPosition(pos: string): pos is PositionKey {
    switch (pos) {
        case 'left': case 'right': case 'center':
            return true;
        default:
            return false;
    }
}

export interface Slide extends HTMLElement, InertCapable {
    /**
     * Activates the element through the `inert` attribute and
     * moves it to the center from either left or right and
     * possibly starts a transition if specified in the options. 
     * @returns a promise that resolves at the end of the transition 
     * (if any started); the promise will resolve `true` if the element
     * was activated, `false` if it was already from the start.
     */
    activate(options: { withTransition: boolean, from?: PositionKeySides }): Promise<boolean>;
    activate(options: { withTransition: false }): Promise<boolean>;
    activate(): Promise<boolean>;

    /** 
     * Deactivates the element through the `inert` attribute and 
     * moves it away from the center and possibly starts a transition 
     * to the new position if specified in the options. 
     * @returns a promise that resolves at the end of the transition 
     * (if any started); the promise will resolve `true` if the element
     * was deactivated, `false` if it was already.
     */
    deactivate(options: { withTransition: boolean, newPos: PositionKeySides }): Promise<boolean>;
    deactivate(options: { withTransition: boolean, left: boolean }): Promise<boolean>;
    deactivate(options: { withTransition: boolean, right: boolean }): Promise<boolean>;
    deactivate(): Promise<boolean>;

    settle(position: PositionKeySides): void;

    /** Indicates the static position of the element 
     *  compared to its referment position. */
    position: PositionKey;
    /** Indicates whether the static position 
     *  of the element is correctly set. */
    readonly isPositioned: boolean;

    /** 
     * Indicates if the slide respects the following conditions:
     * - the element is connected,
     * - the static position of the element is set,
     * - the element is not inert or hidden.
     */
    readonly isActive: boolean;

    /** Notifies the slide element its activation may
     *  be requested soon, allowing it to preload 
     *  needed resources (if any). */
    prepare?(highPriority?: true): void;

    /** Notifies the slide element its activation won't
     *  be requested soon, allowing it to stop
     *  resources preparations (if any). */
    unprepare?(): void;

}

// PRIVATE FIELDS ===========

function _resolveSidePosition(
    options: { newPos?: PositionKeySides, left?: boolean, right?: boolean } | undefined,
    defaultPosition: PositionKeySides
): PositionKeySides {
    if (!options) return defaultPosition;
    const { newPos, left, right } = options;
    if (newPos) return newPos;
    if (left || right === false) return Position.left;
    if (right || left === false) return Position.right;
    return defaultPosition;
}

async function _endTransition(self: Slide) {
    Slide.assertBranded(self);
    const running = self.getAnimations()
        .filter(a => a instanceof CSSTransition && a.transitionProperty.includes('transform'));
    if (running.length === 0) return;
    return Promise.allSettled(running.map(r => r.finished));
}

/**
 * Mixin to implement slide behaviour for carousel-like
 * controllers;
 * 
 * @remarks
 * - Assumes the attribute `inert` prevents transitions.
 * - The only positions available are 'left', 'center' and 'right'.
 * - The container for slides is expected to display only one at once.
 * - The `position` attribute is handled by the `activate` and `deactivate`
 * methods and it is not recommended to alter it manually.
 */
export const Slide = createMixin<
    HTMLElement, Slide, { readonly Position: typeof Position }
>('Slide', (brand) => <
    TBase extends Constructor<HTMLElement> & {
        observedAttributes?: readonly string[]
    }
>(Base: TBase, defaultPosition: PositionKeySides = Position.left) => {
    const sBase = InertPolyfill(Base);

    // Hard check against attribute duplicates
    if ('position' in Base.prototype)
        throw new IllegalArgumentError(`Cannot overwrite existing attribute "${'position'}" in class ${Base.name}`);
    if ('position' in sBase.prototype)
        throw new IllegalStateError(`InertPolyfill mixin introduces properties not declared in the interface`);

    return class SlideElement extends sBase implements Slide {

        constructor(...args: any[]) {
            super(...args);
            brand.add(this);
        }

        // STATIC POSITION ========================
        get position(): PositionKey {
            const pos = this.getAttribute('position') ?? defaultPosition;
            if (isPosition(pos)) return pos;
            return defaultPosition;
        }
        set position(pos: PositionKey) {
            this.setAttribute('position', pos);
        }
        get isPositioned(): boolean {
            const pos = this.getAttribute('position');
            return pos !== null && isPosition(pos);
        }
        get isActive(): boolean {
            return this.isConnected
                && this.position === Position.center
                && !this.inert && !this.hidden;
        }

        /** Element's observed attributes. */
        static override get observedAttributes(): string[] {
            return [
                ...(super.observedAttributes ?? []),
                'hidden'
            ];
        }

        override connectedCallback(): void {
            super.connectedCallback?.();
            if (!this.hasAttribute('inert')) this.inert = true
        }

        override attributeChangedCallback(n: string, o: string | null, v: string | null): void {
            super.attributeChangedCallback?.(n, o, v);
            if (n !== 'hidden') return;
            const old = o === null ? false : (o === 'until-found' ? 'until-found' : true);
            const now = this.hidden;
            if (old === now) return;
            this.dispatchEvent(new HiddenStateChangeEvent(
                hiddenStateChangeEvent, { old, new: now, bubbles: true }));
        }

        // STATE COMMANDS =========================
        async activate(options?: { withTransition: boolean, from?: PositionKeySides }): Promise<boolean> {
            if (!this.inert) return false;
            const { withTransition, from } = options ?? {};

            // jump to the starting position while still inert: no transition can fire
            if (from) this.position = from;

            if (withTransition) {
                void getComputedStyle(this).opacity; // commit the jump before enabling transitions
                this.inert = false;
                this.position = Position.center; // now animates from `from` (or current) to center
            } else {
                this.position = Position.center; // still inert: instant
                this.inert = false; // enabled only once already in place
            }
            return _endTransition(this).then(() => true);
        }

        async deactivate(options?: { withTransition: boolean, newPos?: PositionKeySides, left?: boolean, right?: boolean }): Promise<boolean> {
            if (this.inert) return false;
            const pos = _resolveSidePosition(options, defaultPosition);

            if (options?.withTransition) {
                void getComputedStyle(this).opacity;
                this.position = pos;
                return _endTransition(this).then(() => this.inert = true);
            }

            this.position = pos;
            this.inert = true;
            return true;
        }

        settle(pos: PositionKeySides): void {
            this.inert = true;
            this.position = pos;
        }
    }
}, { Position })

