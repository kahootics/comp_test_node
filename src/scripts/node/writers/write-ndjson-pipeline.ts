import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import type { PathLike } from 'node:fs';


export async function writeNdjsonPipeline(path: PathLike, asyncIterable: AsyncIterable<object>) {
    const lines = async function* () {
        for await (const obj of asyncIterable) {
            yield JSON.stringify(obj) + '\n';
        }
    };
    return pipeline(Readable.from(lines()), createWriteStream(path));
}
