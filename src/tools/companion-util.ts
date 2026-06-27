
import path from 'node:path';
import fs from 'node:fs';
import { OUT } from '../config/global-const.mjs';

export { OUT_NAME } from '../config/global-const.mjs';
export { OUT } from '../config/global-const.mjs';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const UNITS_LIMIT = UNITS.length - 1;
const KB = 1024;

export function toUnitBytes(bytes: number, decimals: number = 2): string {
    if(bytes === 0) return '0 B';
    if(bytes < 0) throw new Error('A file size cannot be a negative value!');

    let i = Math.floor(Math.log(bytes) / Math.log(KB));
    if(i > UNITS_LIMIT) i = UNITS_LIMIT;
    
    const value = bytes / Math.pow(KB, i);

    return `${value.toFixed(decimals)} ${UNITS[i]}`;
}

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
    return (text: string) => ansi + text + (chain ? '' : '\x1b[0m');        
}

export const Log = Object.freeze({
    file(outPath: string, size?: number) {
        console.log(`${style('green')('▶')} ${toPublicUrl(outPath)} [${toUnitBytes(size ?? fs.statSync(outPath).size)}]`);
    },
    msg(message: string) {
        console.info(`${style('yellow')('●')} ${message}`);
    },
    hdr(header: string) {
        console.info(`${style('green','background','regular')( `⏹ ${style('black','text','bold',true)(header)} ⏹ `)}`);
    },
    wrn(warning: string) {
        console.warn(warning);
    },
    err(e: Error, message: string) {
        console.error(`${ e.name}`);
    }
});