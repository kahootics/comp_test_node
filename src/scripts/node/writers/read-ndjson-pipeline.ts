import { createReadStream, type PathLike } from "fs";
import type z from "zod";
import { readLines } from "../../../tools/read-lines.mjs";

export async function* readNdjsonPipeline<S extends z.ZodType>(
    path: PathLike,
    schema: S
): AsyncGenerator<z.infer<S>> {
    const reader = readLines(createReadStream(path));
    for await (const rawJsonLine of reader) {
        const rawData = JSON.parse(rawJsonLine);
        yield await schema.parseAsync(rawData);
    }
}