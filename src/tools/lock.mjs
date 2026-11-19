// @ts-check
/** Lock handler class. */
export class Lock {
    /**
     * @type {boolean} 
     * Whether an action is in play. */
    #lock = false;
    /** Activates lock. */
    lock() { this.#lock = true; }
    /** Deactivates lock. */
    unlock() { this.#lock = false; }
    /** Lock's state. */
    get isLocked() { return this.#lock; }
}
