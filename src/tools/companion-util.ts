
import path from 'node:path';
import fs from 'node:fs';
import config from '../config/app-config.mjs';
import { _stabilizePath } from '../scripts/node/sharp/rule.js';
import appConfig from '../config/app-config.mjs';
import { IllegalAccessError } from '../errors/common-errors.mjs';


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
    // take anything after dist/
    const full = path.resolve(filePath);
    const chunk = full.split(config.repo)[1];
    if (!chunk)
        throw new IllegalAccessError("This file does not belong to the repository\n"+full);
    
    const end = chunk.includes(config.paths.tsDir)
        ? chunk.split(config.paths.tsDir)[1]! :
        chunk.includes(config.paths.outDir)
            ? chunk.split(config.paths.outDir)[1]! :
            chunk;
    return _stabilizePath(end);
    // return `${config.site + config.base}/${relative}`;
}

export function toAbsolutePublicUrl(filePath: string): string {
    const publicChunk = toPublicUrl(filePath);
    return _stabilizePath(path.join(appConfig.site, appConfig.repo, publicChunk));
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
