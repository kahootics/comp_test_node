import { IllegalAccessError, IllegalArgumentError, IllegalStateError } from "../../../errors/common-errors.mjs";
import type { Brand } from "../../shared/general-types.js";

export type horizontalDirection = Brand<true, 'horizontal-direction'>;
export type verticalDirection = Brand<false, 'vertical-direction'>;

const HORIZONTAL = true as horizontalDirection;
 const   VERTICAL = false as verticalDirection;

export type direction = horizontalDirection | verticalDirection;
type Xcoordinate = Brand<number, 'X-coordinate'>;
type Ycoordinate = Brand<number, 'Y-coordinate'>;
type deltaX = Brand<number, 'deltaX'>;
type deltaY = Brand<number, 'deltaY'>;

interface delta {
    'X': deltaX;
    'Y': deltaY;
}

type AxysOf<D extends direction> =
    D extends horizontalDirection ? 'X' :
    D extends verticalDirection ? 'Y' :
    never;
type deltaMov<D extends direction | keyof delta> =
    D extends direction ? delta[AxysOf<D>] : 
    D extends keyof delta ? delta[D] :
    never;




export interface MovementI {
    // COORDINATES =======================================================
    /** 
     * Initial value for the X coordinate. 
     */
    readonly startX: Xcoordinate;
    /** 
     * Initial value for the Y coordinate. 
     */
    readonly startY: Ycoordinate;

    /**
     * @param deltaof - Coordinate of which a difference must be calculated.
     * @param final - Final value for the coordinate chosen.
     */
    delta(deltaof: keyof delta, final: number): delta[typeof deltaof];
    delta(deltaof: direction, final: number): delta[AxysOf<typeof deltaof>];
    /**
     * @param deltaof - Coordinate of which a difference must be calculated.
     * @param pointer - Pointer object/event containing `clientX` and `clientY` values as final coordinates.
     */
    delta(deltaof: keyof delta, pointer: { clientX: number, clientY: number }): delta[typeof deltaof];
    delta(deltaof: direction, pointer: { clientX: number, clientY: number }): delta[AxysOf<typeof deltaof>];

    // DIRECTION ========================================================
    /**
     * The direction set for the occurring movement.
     * 
     * @throws {IllegalAccessError} If accessed while a direction has not been set yet.
     */
    readonly direction: direction;
    /** A boolean value indicating whether a 
     *  direction has been set for the movement. */
    readonly hasDirection: boolean;
    /**
     * @param direction - A direction to lock the movement on.
     * 
     * @throws {IllegalAccessError} If a direction has been set already. 
     */
    lockDirection(direction: direction): void;

    // LIFECYCLE =======================================================
    /**
     * The signal of the movement, used to control 
     * operations associated with the movement.
     * 
     * @remarks
     * Reading any property of the movement object
     * will throw a `AbortError` if the signal
     * has been aborted.   
     * The signal cannot be restored once aborted.
     */
    readonly signal: AbortSignal;
    /** Aborts the movement, blocking any property from being read. */
    abort(): ReturnType<AbortController['abort']>;
    /** 
     * Concludes the movement and aborts any associated operation;
     * properties of the movement cannot be read once done.
     */
    finish(): ReturnType<AbortController['abort']>;
    /** 
     * Throws an `AbortError` if the signal associated with this movement
     * has been aborted.
     */
    throwIfAborted(): void;
}
/**
 * Describes an ongoing movement.
 */
export class Movement implements MovementI {

    static get dirHorizontal() { return HORIZONTAL; }
    static get dirVertical() { return VERTICAL; }


    #direction: direction | null = null;
    readonly #startY: Ycoordinate;
    readonly #startX: Xcoordinate;
    readonly #controller = new AbortController();

    /**
     * @param x - X starting coordinate for the movement.
     * @param y - Y starting coordinate for the movement.
     * @param [signal] - A signal that will abort the movement when aborted itself.
     */
    constructor(x: number, y: number, signal?: AbortSignal);
    /**
     * @param pointer - An object that holds the starting coordinates for the movement.
     * @param [signal] - A signal that will abort the movement when aborted itself.
     */
    constructor(pointer: { clientX: number, clientY: number }, signal?: AbortSignal);
    constructor(
        xOrPointer: number | { clientX: number, clientY: number },
        yOrSignal?: number | AbortSignal,
        signal?: AbortSignal
    ) {
        let x: number, y: number, actualSignal: AbortSignal | undefined;
        // If X is a number, Y must also be, and there must be a signal as third argument
        if (typeof xOrPointer === "number") {
            if (typeof yOrSignal !== 'number')
                throw new IllegalArgumentError(
                    `Must provide both coordinates`
                );
            x = xOrPointer;
            y = yOrSignal;
            actualSignal = signal;
        }
        // If X is an object, then second argument must be signal (third is irreleavant)
        else {
            if (typeof yOrSignal === 'number')
                throw new IllegalArgumentError(
                    `Cannot provide more coordinates when first argument is a pointer`
                );
            x = xOrPointer.clientX;
            y = xOrPointer.clientY;
            actualSignal = yOrSignal;
        }

        if (Number.isNaN(x) || Number.isNaN(y))
            throw new IllegalArgumentError('Both coordinates given must be valid numbers');
        if (actualSignal?.aborted)
            throw new IllegalArgumentError('Cannot listen to signal that is already aborted');

        actualSignal?.addEventListener('abort', () => this.#controller.abort(), { once: true, signal: this.#controller.signal });
        this.#startX = x as Xcoordinate;
        this.#startY = y as Ycoordinate;
    }

    // COORDINATES =======================================
    get startX(): Xcoordinate {
        this.throwIfAborted();
        return this.#startX;
    }
    get startY(): Ycoordinate {
        this.throwIfAborted();
        return this.#startY;
    }
    delta(deltaof: (keyof delta) | direction, v: number | { clientX: number, clientY: number }): deltaMov<typeof deltaof> {
        this.throwIfAborted();
        let start: number;
        let finish: number;
        switch (deltaof) {
            case "X": case HORIZONTAL:
                start = this.#startX;
                finish = typeof v === "number" ? v : v.clientX;
                break;

            case "Y": case VERTICAL:
                start = this.#startY;
                finish = typeof v === "number" ? v : v.clientY;
                break;
            
            default: throw new IllegalStateError('')
        }
        return finish - start as deltaMov<typeof deltaof>;
    }


    get direction(): direction {
        this.throwIfAborted();
        const dir = this.#direction;
        if (dir === null)
            throw new IllegalAccessError(`Cannot read direction before setting it`);
        return dir;
    }
    get hasDirection(): boolean {
        this.throwIfAborted();
        return this.#direction !== null;
    }
    public lockDirection(dir: direction) {
        this.throwIfAborted();
        if (this.#direction !== null)
            throw new IllegalAccessError("Cannot set direction twice, reset first");
        this.#direction = dir;
    }

    get signal() {
        return this.#controller.signal;
    }
    abort(reason?: any) {
        this.throwIfAborted();
        this.#controller.abort(reason);
        // console.log('movement aborted: ', this.#controller.signal.aborted)
    }
    finish() {
        this.throwIfAborted();
        this.#controller.abort('movement finished');
        // console.log('movement aborted: ', this.#controller.signal.aborted)
    }
    throwIfAborted() {
        const signal = this.signal;
        if (signal.aborted)
            throw new DOMException('AbortError', signal.reason);
    }
}