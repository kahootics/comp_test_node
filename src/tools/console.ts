import fs from 'node:fs';
import { toPublicUrl, toUnitBytes } from './companion-util.js';

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
        console.info(`${style('green', 'background', 'regular')(`⏹ ${style('black', 'text', 'bold', true)(header)} ⏹ `)}`);
    },
    wrn(warning: string) {
        console.warn(warning);
    },
    err(e: Error, message: string) {
        console.error(`${e.name}`);
    }
});
