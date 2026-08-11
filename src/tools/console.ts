import fs from 'node:fs';
import { toPublicUrl, toUnitBytes } from './companion-util.js';

enum Color { black, red, green, yellow, blue, purple, cyan, white }
enum Style { regular = 0, bold = 1, underline = 4 }
enum Intensity { text = 3, background = 4, high_tx = 9, high_bg = 10 }

function paint(
    text: string,
    color: keyof typeof Color,
    intensity: keyof typeof Intensity = 'text',
    style: keyof typeof Style = 'regular',
): string {
    return `\x1b[${Style[style]};${Intensity[intensity]}${Color[color]}m${text}\x1b[0m`;
}

export interface LogSink {
    log(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

const consoleSink: LogSink = {
    log: (m) => console.log(m),
    info: (m) => console.info(m),
    warn: (m) => console.warn(m),
    error: (m) => console.error(m),
};

export type FileSizeReader = (path: string) => number;
const defaultSizeReader: FileSizeReader = (p) => fs.statSync(p).size;

export class Logger {
    readonly #sink: LogSink = consoleSink;
    readonly #getSize: FileSizeReader = defaultSizeReader;
    readonly #colors: boolean = true;

    #c(
        text: string,
        color: keyof typeof Color,
        intensity?: keyof typeof Intensity,
        style?: keyof typeof Style
    ): string {
        return this.#colors ? paint(text, color, intensity, style) : text;
    }

    file(outPath: string, size?: number): void {
        const bytes = size ?? this.#getSize(outPath);
        this.#sink.log(`${this.#c('▶', 'green')} ${toPublicUrl(outPath)} [${toUnitBytes(bytes)}]`);
    }

    msg(message: string): void {
        this.#sink.info(`${this.#c('●', 'cyan')} ${message}`);
    }

    hdr(header: string): void {
        const label = this.#c(header, 'black', 'text', 'bold');
        this.#sink.info(this.#c(` ⏹ ${label}`, 'green', 'background') + this.#c(` ⏹ `, 'green', 'background'));
    }

    wrn(warning: string): void {
        this.#sink.warn(`${this.#c('⚠', 'yellow')} ${warning}`);
    }

    err(e: Error, message?: string): void {
        const error = `${this.#c(` ☒ ${e.name} ☒ `, 'red', 'background')} ${e.message}`;
        const out = error + (message ? `\n${message}` : '');
        this.#sink.error(out);
    }
}

export const Log = new Logger();