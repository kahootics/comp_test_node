import { _getPrivateProp, _initPrivateProp, _setPrivateProp } from "../../../tools/encapsulation.js";

/** Whether an action is in play. */
const _lock = new WeakMap<Lock,boolean>();

/** Lock handler class. */
export class Lock {
    /* private */constructor() {
        _initPrivateProp(this,_lock,false)
    };
    /** Activates lock. */
    public lock(): void { _setPrivateProp(this,_lock,true); }
    /** Deactivates lock. */
    public unlock(): void { _setPrivateProp(this,_lock,false); }
    /** Lock's state. */
    public get isLocked(): boolean { return _getPrivateProp(this,_lock); }
}
