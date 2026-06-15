
import { fromBtoKB } from '../../shared/utilities/hex-parsers.js';
import ts from '../../../../tsconfig.json' with { type: 'json' };
import fs from 'node:fs';

const OUT = ts.compilerOptions.outDir;

/**
 * 
 * @param {string} filePath - 
 * @returns {string}
 */
export function toPublicUrl(filePath: string): string {
    // take anything after dist/
    return `/${filePath.split(OUT)[1]}`;
   // return `${config.site + config.base}/${relative}`;
}

export function logWritten(outPath: string, size?: number) {
    console.log(`▶ ${toPublicUrl(outPath)} [${fromBtoKB(size ?? fs.statSync(outPath).size)}]`);
}