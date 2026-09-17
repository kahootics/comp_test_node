
/** Lock handler class. */
export class Lock {
/** Whether an action is in play. */
    #lock: boolean = false;
    /** Activates lock. */
    public lock(): void { this.#lock = true; }
    /** Deactivates lock. */
    public unlock(): void { this.#lock = false; }
    /** Lock's state. */
    public get isLocked(): boolean { return this.#lock; }
}
