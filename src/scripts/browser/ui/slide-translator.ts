/* eslint-disable baseline-js/use-baseline */
// ^Ignore 'inert' attribute for it is polyfilled
// HELPER ========================================================

import { IllegalArgumentError, IllegalStateError } from "../../../errors/common-errors.mjs";
import { Movement, type direction } from "../utilities/movement.js";
import { Slide } from "./mixins/add_behaviour/slide.mixin.js";
import type { Brand } from "../../shared/general-types.js";

type positive = Brand<number, 'positive'>;
function _abs(num: number): positive {
    return Math.abs(num) as positive;
}

interface TranslatorWindow {
    center: Slide;
    left: Slide;
    right: Slide;
}

interface TranslatorOptions {

    threshold?: number;
    cssVariable?: string;
    direction?: direction;
    /** Determines whether to cancel movement 
     *  when pointer is removed out of the borders of the host. 
     *  Defaults to `true`. */
    cancelWhenOutOfHost?: boolean;
    /** Only starts movement 
     *  if pointer is type 'coarse'.   
     *  Defaults to `false`. */
    requirePointerTouch?: boolean
}

export interface TranslatorHost extends HTMLElement {
    /** Indicates whether a translation movement is occurring in the element. */
    translating: boolean;
    /** Tries to acquire the shared lock; 
     * `false` if already held elsewhere. */
    requestLock(): boolean;
    /** Called when the drag exceeds the threshold. Host now owns the lock
     *  and must release it once its own transition settles. */
    onCommit(direction: 'right' | 'left'): void;
    /** Called when the drag settles back under threshold. Host now owns
     *  the lock and must release it once its own transition settles. */
    onCancel(peeked: 'right' | 'left' | null): void;
    /** Called when the drag is interrupted. Host now owns
     *  the lock and must release it once its own transition settles. */
    onInterrupt(peeked: 'right' | 'left' | null): void;
}

interface SlideTranslatorI {

    setWindow(center: Slide, left: Slide, right: Slide): void;
    setWindow(center: Slide, sides: Slide): void;

    resetWindow(): void;

    readonly threshold: number;
    readonly cssVariable: string;


    listen(): void;
    abort(): void;
}

/**
 * Helper class for handling translations
 * on drag for triplets of slide elements 
 * of which only one is active at a time.
 * 
 * Use `listen` and `abort` to start and stop 
 * the translator from handling drags.   
 * Use `setWindow` and `resetWindow` to populate
 * and clear the translator's handled elements.   
 * A threshold will be requested at construction; 
 * if the length of the drag is greater than
 * the host's width multiplied by the threshold value,
 * the translator will request the host to run
 * the `onCommit` method, otherwise the `onCancel` method.
 * 
 * @remarks
 * - The translator only allows drag for coarse pointer-types (fingers).
 * - The translator only supports horizontal dragging.
 * - 
 */
export class SlideTranslator implements SlideTranslatorI {
    readonly #host: TranslatorHost;

    #window: TranslatorWindow | null = null;

    public resetWindow() {
        this.#window = null;
    }

    public setWindow(center: Slide, left: Slide, right?: Slide) {
        this.#window = {
            center, left, right: right ?? left
        }
    }

    readonly #threshold: positive;
    public get threshold(): positive { return this.#threshold; }

    readonly #cssVariable: string;
    get cssVariable() { return this.#cssVariable; }

    #cancelOutOfBorders: boolean;
    set cancelWhenOutOfHost(v: boolean) {
        this.#cancelOutOfBorders = v;
    }
    #requirePointerTouch: boolean;
    readonly #direction: direction;
    get direction() { return this.#direction; }

    /**
     * 
     * @param host - Element that hosts the translable elements.
     * @param [options] - Options to set the translator:
     * @param [options.threshold=0.3] - 
     */
    public constructor(
        host: TranslatorHost,
        {
            threshold = 0.3,
            direction = Movement.dirHorizontal,
            cssVariable = '--translation-value',
            cancelWhenOutOfHost = true,
            requirePointerTouch = false
        }: TranslatorOptions = {}
    ) {
        if (!cssVariable.startsWith('--'))
            throw new IllegalArgumentError(`${cssVariable} is not a valid name for a CSS variable`);
        if (threshold > 1 || threshold < -1)
            throw new IllegalArgumentError(`The threshold for the translator must be a value between -1 and 1; received ${threshold}`);
        this.#host = host;
        this.#threshold = _abs(threshold);
        this.#cssVariable = cssVariable;
        this.#cancelOutOfBorders = cancelWhenOutOfHost;
        this.#requirePointerTouch = requirePointerTouch;
        this.#direction = direction;
    }


    // TOUCH LISTENERS =============================================
    static readonly #activeTranslators = new Map<TranslatorHost, SlideTranslator>();
    #controller: AbortController | null = null;

    /**
     * Begins to listen for pointer events on the host.
     * 
     * @remarks
     * - If this translator was already listening on the host, 
     * the old listener remains; a new one *is not set*.
     * - If another translator was already listening on the host,
     * the other translator is called off; a new listener is 
     * set from this translator on the host.
     */
    public listen(): void {
        const host = this.#host;

        // Check if a translator is already listening on the host
        const currentListener = SlideTranslator.#activeTranslators.get(host);
        if (currentListener === this) return; // Idempotency (don't set another listener)
        else if (currentListener) currentListener.abort(); // Override previous listener

        // Setup new listener
        const signal = (this.#controller = new AbortController()).signal;
        host.addEventListener('pointerdown', (e) => this.#handlePointerDown(e), { signal });
        host.addEventListener('pointerup', (e) => this.#handlePointerUp(e), { signal })
        host.addEventListener('pointercancel', (e) => this.#handlePointerCancel(e), { signal })
        SlideTranslator.#activeTranslators.set(host, this);
    }
    public abort(): void {
        this.#controller?.abort();
        this.#controller = null;

        const at = SlideTranslator.#activeTranslators;
        // If it was registered as active by the class
        at.get(this.#host) === this
            // if this branch is reached, 
            // delete returns true always
            ? at.delete(this.#host)
            : false;
    }

    // TRANSLATIOON HANDLERS ================================

    #movement: Movement | null = null;

    #terminateMovement(result: { successful: boolean } = { successful: false }) {
        result.successful ? this.#movement?.finish() : this.#movement?.abort();
        this.#movement = null;
    }

    #setTranslationVar(pixels: number): void {
        const host = this.#host;
        const limit = this.#direction === Movement.dirHorizontal
            ? host.clientWidth
            : host.clientHeight;
        if (pixels > limit) pixels = limit;
        else if (pixels < -limit) pixels = -limit;
        host.style.setProperty(this.#cssVariable, pixels.toFixed(2) + 'px');
    }
    #startTranslating() {
        this.#host.translating = true;
    }
    #stopTranslating() {
        const host = this.#host;
        host.translating = false;
        host.style.removeProperty(this.#cssVariable);
    }

    #getPeekedSide(): 'left' | 'right' | null {
        const win = this.#window;
        if (!win) return null;
        if (!win.left.inert) return 'left';
        if (!win.right.inert) return 'right';
        return null;
    }

    /**
     * When user presses on the host, 
     * register the touch coordinates and prepares for movement.
     */
    #handlePointerDown(e: PointerEvent) {
        if (this.#requirePointerTouch 
            && e.pointerType !== 'touch'
        ) return;
        const movement = (this.#movement = new Movement(e, this.#controller!.signal));
        const host = this.#host;
        // host.addEventListener('lostpointercapture', (e) => console.log('lost', e.pointerId, (e.target as any)?.tagName))

        host.setPointerCapture(e.pointerId);

        // console.log('down', e.pointerId, (e.target as any)?.tagName);
        host.addEventListener('pointermove', (e) => this.#handlePointerMove(e), { signal: movement.signal })
    }

    /**
     * When, after touching the host, the user moves the cursor/pointer:
     * - if the movement has been aborted, then nothing happens.
     * - 
     */
    #handlePointerMove(e: PointerEvent) {
        // console.log('moving', e.pointerId, (e.target as any)?.tagName)
        const win = this.#window;
        if (!win)
            throw new IllegalStateError('Cannot handle drag without a slide window set');
        const movement = this.#movement;
        if (!movement)
            throw new IllegalStateError('Expected movement but found undefined during movement tracking');

        if (!movement.hasDirection) {
            if (Math.abs(movement.delta('Y', e)) >= Math.abs(movement.delta('X', e))) {
                movement.lockDirection(Movement.dirVertical);
            }
            else
                movement.lockDirection(Movement.dirHorizontal);

            // check lock and direction to verify
            // if the movement can be started or
            // must be called off
            if (
                movement.direction !== this.#direction
                // if direction is not correct, 
                // the lock won't be acquired regardless
                || !this.#host.requestLock()
                // Attempt to lock only as last action
                // before actually listening to the movement
                // or calling it off
            ) return this.#abortMovement(e);

            this.#startTranslating();
        }

        const delta = movement.delta(this.#direction, e);

        const { left, right } = win;
        if (delta > 0 && left.inert) {
            left.position = Slide.Position.left;
            right.inert = true;
            left.inert = false;
        } else if (delta < 0 && right.inert) {
            right.position = Slide.Position.right;
            left.inert = true;
            right.inert = false;
        }

        this.#setTranslationVar(delta);
    }

    #isPointerInsideHost({ clientX, clientY }: PointerEvent): boolean {
        const { left, right, top, bottom } = this.#host.getBoundingClientRect();
        return (
            clientX >= left &&
            clientX <= right &&
            clientY >= top &&
            clientY <= bottom
        );
    }

    #handlePointerUp(e: PointerEvent) {

        const movement = this.#movement;
        // Abort movement if none has been made (it was a click)
        if (!movement) return;
        if (!movement.hasDirection) return this.#abortMovement(e);

        const host = this.#host;
        // Never called if movement was aborted

        const delta = movement.delta(this.#direction, e);
        if (this.#cancelOutOfBorders
            && !this.#isPointerInsideHost(e)
        ) return this.#handlePointerCancel(e);
        // console.log('up', e.pointerId, (e.target as any)?.tagName)

        const threshold = Math.abs(host.clientWidth * this.#threshold);

        this.#stopTranslating();

        if (delta > threshold) {
            host.onCommit('right');
            this.#terminateMovement({ successful: true });
        } else if (delta < -threshold) {
            host.onCommit('left');
            this.#terminateMovement({ successful: true });
        } else {
            host.onCancel(this.#getPeekedSide());
            this.#terminateMovement();
        }
    }

    #handlePointerCancel(e: PointerEvent) {
        // Never called if movement was aborted

        if (!this.#movement?.hasDirection) return this.#abortMovement(e);
        // console.log('cancel', e.pointerId, (e.target as any)?.tagName)

        this.#stopTranslating();
        this.#host.onInterrupt(this.#getPeekedSide());
        this.#terminateMovement();
    }
    #abortMovement(e: PointerEvent) {
        // console.log('abort', e.pointerId, (e.target as any)?.tagName)

        this.#terminateMovement(); // lock is not held here
        this.#host.releasePointerCapture(e.pointerId);
    }
}