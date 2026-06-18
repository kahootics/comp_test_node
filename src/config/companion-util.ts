
import path from 'node:path';
import { fromBtoKB } from '../scripts/shared/utilities/hex-parsers.js';
import fs from 'node:fs';
import type { Values } from 'zod/v3';

export const OUT_NAME = 'dist';
export const OUT = OUT_NAME + path.sep;

/**
 * 
 * @param filePath - 
 * @returns
 */
export function toPublicUrl(filePath: string): string {
    // take anything after dist/
    return path.sep + filePath.split(OUT)[1];
   // return `${config.site + config.base}/${relative}`;
}

export function getDirname(filePath: string): string {
    return path.basename(path.dirname(filePath));
}
const birthRegister: Map<string,Date> = new Map();
export function getFileBirthTime(filePath: string) {
    const maybe = birthRegister.get(filePath);
    if(maybe) return maybe;
    // else
    const paths = path.resolve(filePath)
    const res = fs.statSync(paths).birthtime;
    birthRegister.set(filePath,res);
    return res;
}

enum COLOR {
    black, red, green, yellow, blue, purple, cyan, white
}
enum STYLE {
    regular = 0, bold = 1, underline = 4
}
enum INTENSITY {
    text = 3, background = 4, high_tx = 9, high_bg = 10
}

function style(
    color: keyof typeof COLOR,
    intensity: keyof typeof INTENSITY = 'text',
    style: keyof typeof STYLE = 'regular',
    chain: boolean = false
) {
    const ansi = `\x1b[${STYLE[style]};${INTENSITY[intensity]}${COLOR[color]}m`;
    return {
        txt(text: string) {
            return ansi + text + (chain ? '' : '\x1b[0m');
        }
    }
}

export const Log = {
    file(outPath: string, size?: number) {
        console.log(`${style('green').txt('▶')} ${toPublicUrl(outPath)} [${fromBtoKB(size ?? fs.statSync(outPath).size)}]`);
    },
    msg(message: string) {
        console.info(`${style('yellow').txt('●')} ${message}`);
    },
    hdr(header: string) {
        console.info(`${style('green','background','regular').txt( `⏹ ${style('white','text','bold',true).txt(header)} ⏹ `)}`);
    },
    wrn(warning: string) {
        console.warn(warning);
    }
}