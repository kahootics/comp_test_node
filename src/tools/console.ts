import fs from 'node:fs';
import { toPublicUrl } from './companion-util.js';
import * as lug from "./logger.mjs";


export type FileSizeReader = (path: string) => number;
const defaultSizeReader: FileSizeReader = (p) => fs.statSync(p).size;

export class Logger {
    readonly #getSize: FileSizeReader = defaultSizeReader;

    file(outPath: string, size?: number): void {
        const bytes = size ?? this.#getSize(outPath);
        lug.Log.file(toPublicUrl(outPath),bytes)
    }

    msg(message: string): void {
        lug.Log.msg(message);
    }

    hdr(header: string): void {
        lug.Log.hdr(header)
    }

    wrn(warning: string): void {
        lug.Log.wrn(warning)
    }

    err(e: Error, message?: string): void {
        lug.Log.err(e,message)
    }
}

export const Log = new Logger();