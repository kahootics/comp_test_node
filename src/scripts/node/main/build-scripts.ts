
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { toPublicUrl, getDirname } from '../../../tools/companion-util.js';
import { Log } from '../../../tools/console.js';
import { createHashFromBuffer } from '../writers/hash.js';
import * as esbuild from 'esbuild';
import { isDev } from '../../../main.js';
import config from '../../../config/app-config.mjs'


const TARGET_BASELINE = 'ES2020';

/**
 * `filename`: *path relative to `OUT` dir with hash*
 */
interface Scripts {
    [key: string]: string
}

/**
 * For more info on inner function see {@link bundleScripts}
 * @returns an object that maps all the bundles of main.js files with hashing.
 */
export default async function buildScripts(): Promise<Scripts> {
    const out = await bundleScripts(
        config.paths.tsDir + '/scripts/{sync,shared}/**/main.js',
        config.paths.outDir + '/scripts/',
        true
    );
    return out;
}

/**
 * Bundles, minifies and hashes all entrypoint scripts.
 * All other accessory scripts are unnecessary.
 * @param entrypointsGlob - glob pattern for entrypoints (absolute paths)
 * @param outDir - Output directory
 * @param useDirnameAsKey - (optional) If `true`, will use the file's directory basename as key for the output
 * @returns a map of original filename/directory to hashed output path
 */
export async function bundleScripts(
    entrypointsGlob: string,
    outDir: string,
    useDirnameAsKey?: boolean
): Promise<Scripts> {

    const entryPoints = await glob(entrypointsGlob);
    const output: Scripts = {};

    for (const entry of entryPoints) {
        const result = await esbuild.build({
            entryPoints: [entry],
            bundle: true,
            target: [TARGET_BASELINE],
            platform: 'browser',
            format: 'esm',
            write: false, // Returns buffer array
            minify: !isDev,
            sourcemap: isDev,
            /* minifyWhitespace: true,
            minifyIdentifiers: true,
            minifySyntax: true, */

        });
        const arrBuf = result.outputFiles[0]?.contents
        if (!arrBuf) throw new Error(
            `File at ${entry} cannot be bundled correctly.`
        );

        const buffer = Buffer.from(arrBuf);
        const hash = createHashFromBuffer(buffer);
        const name = useDirnameAsKey
            ? getDirname(entry)
            : path.basename(entry, '.js');
        const filename = `${name}.${hash}.js`;
        const keyName = `${name}.js`;
        const outPath = path.resolve(path.join(outDir, filename));

        // check for duplicates
        if (output[keyName])
            throw new Error(
                `${keyName} has duplicate sources: `
                + `\n${toPublicUrl(outPath)}`
                + `\n${output[keyName]}`
            );

        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, buffer);

        output[keyName] = toPublicUrl(outPath);
        Log.file(outPath);
    }

    return output;
}