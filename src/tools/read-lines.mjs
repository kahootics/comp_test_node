// @ts-check

/**
 * Transforms an async iterable (possibly a `ReadableStream`) 
 * of bytes or string chunks into an async 
 * iterable of lines (`string`) by collecting
 * the chunks into a buffer to split on newlines 
 * (also handles carriage returns).
 * 
 * @param {AsyncIterable<Uint8Array | string> | ReadableStream<Uint8Array | string>} chunkIterable - Async iterable of bytes or strings.
 * @param {Object} [options] - Options object:
 * @param {boolean} [options.trim] - Cuts away blank spaces between read lines.
 * @param {boolean} [options.skip_empty_lines] - Skip lines with no content (`''`).
 */
export async function* readLines(chunkIterable, options) {
    /** Implement async iterator protocol on `ReadableStream` if not present. */
    const safeAsyncIterable = isAsyncIterable(chunkIterable)
        ? chunkIterable
        : readableStreamToAsyncIterable(chunkIterable);

    const decoder = new TextDecoder("utf-8");
    /** Collects decoded chunks from the source iterable. */
    let buffer = '';

    const { trim, skip_empty_lines } = options ?? {};

    /**
     * Applies the selected options to
     * the output of the main function.
     * 
     * @param {string} line 
     * @returns {string|null}
     */
    const filter = (line) => {
        if (trim) line = line.trim();
        if (skip_empty_lines && line === '') return null;

        return line;
    }

    for await (const chunk of safeAsyncIterable) {
        // Buffer chunks according to their type
        buffer += typeof chunk === 'string'
            ? chunk
            : decoder.decode(chunk, { stream: true });

        /** Position of the first newline delimiter character within the buffer. */
        let idx;

        // Find all the newlines
        while ((idx = buffer.indexOf('\n')) >= 0) {
            // Slices the buffer at each newline (if any),
            let line = buffer.slice(0, idx);
            // The leftover part is left to the buffer
            buffer = buffer.slice(idx + 1);
            // Remove carriage return from line if any
            if (line.endsWith('\r')) line = line.slice(0, -1);

            // yields each sliced line according to specified options
            const res = filter(line);
            if (res !== null) yield res;
        }
    }

    // Flush the remainder of the buffer 
    // at the end of the reading operation
    buffer += decoder.decode();
    if (buffer.length > 0) {
        const res = filter(buffer);
        if (res) yield res;
    }
}

/**
 * @param {any} value
 * @returns {value is AsyncIterable<any>}
 */
function isAsyncIterable(value) {
    return value != null && typeof value[Symbol.asyncIterator] === 'function';
}

/** @param {ReadableStream<Uint8Array | string>} stream */
async function* readableStreamToAsyncIterable(stream) {
    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            yield value;
        }
    } catch (err) {
        await reader.cancel(err).catch(() => {});
        throw err;
    } finally {
        reader.releaseLock();
    }
}
