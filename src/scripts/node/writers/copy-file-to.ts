
import fs from 'node:fs';
import path from 'node:path';
import { toUnitBytes } from '../../../config/companion-util.js';

/**
 * Compares a source valid path with a destination one and returns a validated version of it
 * @param src Source *filepath*
 * @param dest — Destination path
 * @returns corrected `dest` path as follows:
 * - normalized
 * - with the same basename of `src` if it had none or `dest` pointed to a folder or started with `.`
 * - with the same extension of `src` if it had none or different one
 */
export function destPathCorrected(src: string, dest: string): string {
    let correctedDest = path.normalize(dest);

    const destBase = path.basename(correctedDest);
    if (!destBase || destBase.startsWith('.') || correctedDest.endsWith(path.sep)) {
        correctedDest = path.join(correctedDest, path.basename(src));
    }

    const destExt = path.extname(correctedDest);
    const srcExt  = path.extname(src);
    if (!destExt) {
        correctedDest += srcExt;
    } else if (destExt !== srcExt) {
        correctedDest = correctedDest.slice(0, -destExt.length) + srcExt;
    }

    return correctedDest;
}
/**
 * Copies a file to another directory.
 * @param src — Source *filepath* to copy
 * @param dest — Destination path of the copy operation.
 * Destination will be adapted as follows:
 * - `dest` is always normalized
 * - if `dest` ends with a trailing slash, the source file 
 * will be copied in *that* directory with its original name
 * - if `dest` has no extension or it is different from the one of `src`,
 * the extension will be set to that of `src`
 */
export default function copyFileTo(src: string, dest: string) {

    const destCorr = destPathCorrected(src, dest);
    try {
        const srcPath = path.resolve(src);
        const outPath = path.resolve(destCorr);

        fs.mkdirSync(path.dirname(outPath), { recursive: true });        
        fs.copyFileSync(srcPath,outPath);
    
        console.log(`File '${path.basename(src)}' has been copied ${path.basename(src) === path.basename(destCorr) ? '' : `as '${path.basename(destCorr)}' `}to ${path.dirname(destCorr)}\\ [${toUnitBytes(fs.statSync(outPath).size)}]`);
        console.log(`src:  ${srcPath}\ndest: ${outPath}`);
    
    } catch(err) {
        console.error(`Copying of ${src} failed at: ${destCorr}:`, err);     
    }
}

