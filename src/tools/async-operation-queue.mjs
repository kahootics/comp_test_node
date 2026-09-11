// @ts-check

/**
 * Creates a queue to chain asynchronous operations 
 * so that they cannot occurr simultaneously.
 * 
 * @remarks
 * Particularly useful to avoid concurrent 
 * I/O operations on the same resources.
 */
export class AsyncOperationQueue {
    /** 
     * *Await before starting any new operation*.
     * 
     * If a new operation starts, the resulting promise should be 
     * stored here to ensure no concurrent operation of the same type starts.
     */
    #pending = Promise.resolve();

    /**
     * @param {() => Promise<void>} callback - A function that will be called once previously scheduled async callbacks have resolved.
     * @returns {Promise<void>} an empty promise that should be awaited to ensure completion of the operation.
     */
    async enqueue(callback)  {
        return this.#pending = this.#pending.then(callback);
    }
}
