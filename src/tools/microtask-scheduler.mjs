
/**
 * Allows to schedule a callback as a microtask
 * to be called with priority after the current task
 * is finished.
 * 
 */
export class MicrotaskScheduler {
    /** @type {boolean} */
    #scheduled = false;

    /** @type {boolean} */
    #aborted = false;

    /** @type {() => void} */
    #task;

    /**
     * @param {() => void} callback - This function will be memorized 
     * and queued as a microtask every time the method `schedule` is called.
     */
    constructor(callback) {
        this.#task = callback;
    }

    /** Indicates whether the microtask is scheduled
     *  for the current event loop; its execution may still
     *  be stopped by aborting it. */
    get scheduled() {
        return this.#scheduled;
    }
    /** Indicates whether the previously scheduled microtask
     *  was aborted; if no task is scheduled this will be `false`. */
    get aborted() {
        return this.#aborted;
    }
    /** Indicates whether the microtask is scheduled and
     *  will run at the end of the current task.
     */
    get willRun() {
        return this.#scheduled && !this.#aborted;
    }

    /**
     * Schedules this object's microtask.
     * 
     * @remarks
     * - If the task was previously aborted, it will be
     * rescheduled.
     * - If the task is sheduled two or more times before actual
     * execution, only one instance of the microtask will be in the queue
     * (the first one).
     */
    schedule() {
        this.#aborted = false;
        if (this.#scheduled) return;
        this.#scheduled = true;
        queueMicrotask(() => {
            this.#scheduled = false;
            if (this.#aborted) {
                this.#aborted = false;
                return;
            } else this.#task();
        });
    }

    /**
     * Aborts the scheduled microtask this object controls (if scheduled).
     * 
     * @returns {boolean} `true` if the scheduled microtask was aborted, 
     * `false` if there was none scheduled or it was already aborted.
     * 
     * @remarks
     * - If the task is aborted, this object remains alive and the
     * microtask it controls can be rescheduled at any time.
     */
    abort() {
        if (!this.#scheduled || this.#aborted) return false;
        return this.#aborted = true;
    }
}
