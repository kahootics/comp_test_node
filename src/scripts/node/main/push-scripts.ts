
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { Log, toPublicUrl, OUT_NAME, OUT } from '../../../config/companion-util.js';
import hashFile, { createHashFromFile, createHashFromBuffer } from '../writers/hash.js';

const dest = OUT + 'scripts.json';

export async function pushScripts() {

    //const scriptFilesPaths = await glob(OUT_NAME + '/scripts/{sync,shared}/**/*.js');

    /* const out: { [key: string]: string }[] = [];
    scriptFilesPaths.forEach(scriptPath => {
        // const outPath = hashFile(scriptPath);
        Log.file(scriptPath);
        const name = path.basename(scriptPath, '.js');
        // const hash = createHashFromFile(scriptPath);
        out.push({
            name: name,
            src: toPublicUrl(scriptPath),
            //hash: hash
        });
    })
 */
    const out = await bundleScripts(OUT_NAME + '/scripts/{sync,shared}/**/index.js', 'dist/scripts/output/')

    const outPath = path.resolve(dest);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    fs.writeFileSync(
                outPath,
                JSON.stringify(out),
                'utf-8'
            );

    
    Log.file(outPath); // just return it later

}

const isBuild = process.env.BUILD == 'true';

// scripts/node/bundler.ts
import * as esbuild from 'esbuild';

/**
 * Bundles, minifies and hashes all entrypoint scripts.
 * All other accessory scripts are unnecessary.
 * @param entrypointsGlob - glob pattern for entrypoints (absolute paths)
 * @param outDir - Output directory
 * @returns a map of original filename: hashed output path
 */
export async function bundleScripts(
    entrypointsGlob: string,
    outDir: string
): Promise<Record<string, string>> {

    const entryPoints = await glob(entrypointsGlob);
    const output: Record<string, string> = {};

    for (const entry of entryPoints) {
        const result = await esbuild.build({
            entryPoints: [entry],
            bundle: true,
            target: ['ES2022'],
            write: false, // Returns buffer array
            format: 'esm',
            minify: true,
            sourcemap: true,
            platform: 'browser',
        });
        const arrBuf = result.outputFiles[0]?.contents
        if(!arrBuf) throw new Error(
            `File at ${entry} cannot be bundled correctly.`
        );

        const buffer = Buffer.from(arrBuf);
        const hash   = createHashFromBuffer(buffer);
        const name =  path.basename(path.dirname(entry));
        //const name   = path.basename(entry, '.js');
        const filename = `${name}.${hash}.js`;
        const outPath  = path.resolve(path.join(outDir, filename));

        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, buffer);

        output[`${name}.js`] = toPublicUrl(outPath);
        Log.file(outPath);
    }

    return output;
}