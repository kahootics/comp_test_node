// @ts-check
import readline from 'node:readline/promises';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const UNITS_LIMIT = UNITS.length - 1;
const KB = 1024;

/**
 * 
 * @param {number} bytes - 
 * @param {number} decimals 
 * @returns {string}
 */
export function toUnitBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    if (bytes < 0) throw new Error('A file size cannot be a negative value!');

    let i = Math.floor(Math.log(bytes) / Math.log(KB));
    if (i > UNITS_LIMIT) i = UNITS_LIMIT;

    const value = bytes / Math.pow(KB, i);

    return `${value.toFixed(decimals)} ${UNITS[i]}`;
}

const Color = { black: 0, red: 1, green: 2, yellow: 3, blue: 4, purple: 5, cyan: 6, white: 7 }
const Style = { regular: 0, bold: 1, underline: 4 }
const Intensity = { text: 3, background: 4, high_tx: 9, high_bg: 10 }

/**
 * @param {string} text 
 * @param {keyof typeof Color} color 
 * @param {keyof typeof Intensity} intensity 
 * @param {keyof typeof Style} style 
 * @returns {string}
 */
export function _c(text, color, intensity = 'text', style = 'regular',) {
    return `\x1b[${Style[style]};${Intensity[intensity]}${Color[color]}m${text}\x1b[0m`;
}

/**
 * 
 */
class Logger {

    /**
     * @param {string} outPath
     * @param {number} sizeInBytes 
     */
    file(outPath, sizeInBytes) {
        console.log(`${_c('▶', 'green')} ${outPath} [${toUnitBytes(sizeInBytes)}]`);
    }
    /**
     * Outputs a message to console.
     * @param {string} message 
     */
    msg(message) {
        console.info(`${_c('●', 'cyan')} ${message}`);
    }
    /**
 * @param {readline.Interface} rl 
     * @param {number} no 
     * @param {string} msg 
     */
    listI(rl, no, msg) {
        return rl.question(
            _c(msg, 'white', 'text', 'underline')
        )
    }
    /**
     * Outputs a header between two '⏹' on a green background.
     * @param {string} header 
     */
    hdr(header) {
        console.groupEnd();
        const label = _c(header, 'black', 'text', 'bold');
        console.info(
            _c(` ⏹ ${label}`, 'green', 'background')
            + _c(` ⏹ `, 'green', 'background')
        );
    }
    /**
     * @param {string} warning 
     */
    wrn(warning) {
        console.warn(`${_c('⚠', 'yellow')} ${warning}`);
    }
    /**
     * @param {Error} e 
     * @param {string} [message] 
     */
    err(e, message) {
        const error = `${_c(` ☒ ${e.name} ☒ `, 'red', 'background')} ${e.message}`;
        const out = error + (message ? `\n${message}` : '');
        console.error(out);
    }
}

export const Log = new Logger();
