
declare const ExpandibleSymbol: unique symbol;
export abstract class ExpandibleElement extends HTMLElement {
    declare [ExpandibleSymbol]: never;
}



export abstract class LockableElement extends ExpandibleElement {
    /** Whether an action is in play. */
    private _lock: boolean = false;
    /** 
     * Activates lock. 
     * @remarks only available to descendants */
    protected lock(): void { this._lock = true; }
    /** 
     * Deactivates lock. 
     * @remarks only available to descendants */
    protected unlock(): void { this._lock = false; }
    /** @returns lock state */
    public get isLocked(): boolean { return this._lock; }
}
