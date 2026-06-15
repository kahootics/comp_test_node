
import path from 'node:path';
import { fromBtoKB } from '../scripts/shared/utilities/hex-parsers.js';
import fs from 'node:fs';

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



export const Log = {
    file(outPath: string, size?: number) {
        console.log(`▶ ${toPublicUrl(outPath)} [${fromBtoKB(size ?? fs.statSync(outPath).size)}]`);
    }
}