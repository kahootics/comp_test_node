
/** Lock handler class. */
export class Lock {
    /** Whether an action is in play. */
    private _lock: boolean = false;
    /**
     * Activates lock.
     */
    public lock(): void { this._lock = true; }
    /**
     * Deactivates lock.
     */
    public unlock(): void { this._lock = false; }
    /** Lock state */
    public get isLocked(): boolean { return this._lock; }
}
