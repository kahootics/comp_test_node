
import path from 'node:path';
import fs from 'node:fs';
import config from '../config/app-config.mjs';
import { IllegalAccessError, IllegalArgumentError } from '../errors/common-errors.mjs';



const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const UNITS_LIMIT = UNITS.length - 1;
const KB = 1024;

export function toUnitBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';
    if (bytes < 0) throw new Error('A file size cannot be a negative value!');

    let i = Math.floor(Math.log(bytes) / Math.log(KB));
    if (i > UNITS_LIMIT) i = UNITS_LIMIT;

    const value = bytes / Math.pow(KB, i);

    return `${value.toFixed(decimals)} ${UNITS[i]}`;
}

/**
 * 
 * @param filePath - 
 * @returns
 */
export function toPublicUrl(filePath: string): string {
    const resolved = path.resolve(filePath);
    const part = toPublicUrlRaw(resolved);

    return _stabilizePath(part);
}

function toPublicUrlRaw(path: string): string {
    if(path.includes(config.paths.outDir))
        return path.split(config.paths.outDir)[1]!
    if(path.includes(config.paths.srcDir))
        return path.split(config.paths.srcDir)[1]!
    if(path.includes(config.paths.tsDir))
        return path.split(config.paths.outDir)[1]!
    throw new IllegalAccessError(`${path} is in none of the three project directories`)
}

export function toAbsolutePublicUrl(filePath: string): string {
    const publicChunk = toPublicUrl(filePath);
    return _stabilizePath(path.join(config.site, config.repo, publicChunk));
}

export function getDirname(filePath: string): string {
    return path.basename(path.dirname(filePath));
}
const birthRegister: Map<string, Date> = new Map();
export function getFileBirthTime(filePath: string) {
    const maybe = birthRegister.get(filePath);
    if (maybe) return maybe;
    // else
    const paths = path.resolve(filePath)
    const res = fs.statSync(paths).birthtime;
    birthRegister.set(filePath, res);
    return res;
}



export type $stable = string & { __stable: 'StablePath'; };
/**
 * Normalizes a path and sets the separator to be `/`
 * regardless of system.
 */
export function _stabilizePath<S extends string>(s: S): S & $stable {
    s ?? console.log(s)
    return path.normalize(s).split(path.sep).join('/') as S & $stable;
}
