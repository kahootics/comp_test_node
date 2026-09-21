import esbuild from 'esbuild';
import { glob } from 'glob';
import { writeFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path/posix';
import { Log } from '../../../tools/logger.mjs';
import { createHashFromBuffer } from './hash.js';
import { DuplicateOperationError, IllegalArgumentError, NotFoundError } from '../../../errors/common-errors.mjs';
import { OperationFailedError } from '../../../errors/specialized-errors.mjs';
import type { Brand } from '../../shared/general-types.js';

/** Output of the bundles generator function. */
interface BundledScript extends BundledPartial {
    readonly size: number;
}
/** Options for the bundling function. */
interface BundlingOptions {
    nameAsDirectory?: boolean;
    hash?: boolean;
    minify?: boolean;
    target?: string[];
    sourcemap?: 'external' | 'inline' | 'none';
}
/** Buffered bundle */
interface BundledPartial {
    readonly filename: string;
    readonly basename: bundleName;
    readonly extension: string;
    readonly path: string;
    readonly sourceMapPath?: string;
}
/** Output of bundling, before finalizing. */
interface BundlingPartial {
    readonly script: BundledPartial,
    readonly buffer: JsBuffer,
    readonly mapBuff?: SMBuffer
}
type bundleName = Brand<string, 'bundle'>;
type entryPointPath = Brand<string, 'entry-point'>;
type JsBuffer<T extends ArrayBufferLike = ArrayBufferLike> = Brand<Buffer<T>, 'js'>;
type SMBuffer<T extends ArrayBufferLike = ArrayBufferLike> = Brand<Buffer<T>, 'sourcemap'>;

const EXT = '(?:[cm]?[jt]s|[jt]sx)'; // js, mjs, cjs, ts, mts, cts, jsx, tsx

const ENTRY_GLOB_RE = new RegExp(`\\.(?:${EXT}|\\{${EXT}(?:,${EXT})*\\})$`);


/** Validates the pattern for the entry points glob. */
function _validateEntryPointsGlob(entryPointsGlob: string) {
    if (entryPointsGlob.startsWith('./') || entryPointsGlob.startsWith('../'))
        throw new IllegalArgumentError(`Glob pattern must be absolute: ${entryPointsGlob}`);

    if (!ENTRY_GLOB_RE.test(entryPointsGlob))
        throw new IllegalArgumentError(`Cannot bundle scripts other than JavaScript/TypeScript: ${entryPointsGlob}`);
}

/**
 * Searches for the paths of all entry points scripts from a glob pattern;
 * makes sure the result is not empty and valid.
 */
async function _ensureEntryPoints(entryPointsGlob: string): Promise<entryPointPath[]> {
    _validateEntryPointsGlob(entryPointsGlob);
    const entryPoints = await glob(entryPointsGlob, { ignore: '**/*.d.ts', absolute: true });

    if (entryPoints.length < 1)
        throw new NotFoundError(entryPointsGlob, { type: 'scripts to bundle with pattern' })

    return entryPoints.map(e => e.replaceAll('\\',`/`)) as entryPointPath[];
}

/**
 * Bundles scripts from entry-points obtained through a glob pattern.   
 * 
 * @param entryPointsGlob - glob pattern for entrypoints (must give absolute paths).
 * @param outDir - Destination directory for all the bundles generated.
 * @param [options]:
 * @param [options.nameAsDirectory] - (optional) If `true`, will use the file's directory basename as name for the bundle.
 * @param [options.hash] - (optional) If `true`, will create a md5 8-characters hash from each bundle and use it in the filename: <name>.<hash>.js.
 * @param [options.minify] - (optional) If `true`, will minify the script in the bundles (will remove whitespace, compress syntax and use short names for identifiers).
 * @param [options.target] - (optional) An array containing the EcmaScript targets for the output scripts (will use polyfill where available).
 * @param [options.sourcemap] - (optional) If 
 * - `'external'`, will generate a sourcemap file along with the bundle and link them.
 * - `'inline'`, will generate a sourcemap string to inline in the bundled script.
 * - `'none'`, (default if omitted) no sourcemap will be generated.
 * @returns an array containing metadata on the bundles created (@see {@link BundledScript}).
 * 
 * @remarks
 * If sourcemap is set to 'inline' and hash to 'true' in the options, 
 * the hash will be generated using the inlined sourcemap as well.
 * 
 * @throws {IllegalArgumentError} If the pattern given tries to search for scripts in a language other than JavaScript/TypeScript.
 * @throws {IllegalArgumentError} If the pattern given is not absolute.
 * @throws {NotFoundError} If no suitable entry-point is found by researching the pattern.
 * @throws {OperationFailedError} If `esbuild` fails to build any bundle's buffer.
 * @throws {OperationFailedError} If `esbuild` fails to build the sourcemap when specified in the option as 'external'.
 * @throws {DuplicateOperationError} If attempting to bundle twice from the same entrypoint (or directory if `nameAsDirectory` is `true`).
 * 
 * @requires glob
 * @requires esbuild
 */
export async function bundleJsScripts(
    entryPointsGlob: string,
    outDir: string,
    options?: BundlingOptions
): Promise<BundledScript[]> {
    // Normalize path
    const { nameAsDirectory, sourcemap } = options ?? {};

    // Get entry points
    const entryPoints = await _ensureEntryPoints(entryPointsGlob);

    // Name all the entries
    const namesMap = _getNamesEntryMap(entryPoints, nameAsDirectory);

    // Bundle scripts from entry points
    const partials = await _bundleScriptsInBuffers(namesMap, outDir, options);

    // Ensure destination directory
    await mkdir(outDir, { recursive: true });

    // Write the bundles
    const bundles: BundledScript[] = [];
    const finalizing = _finalizeBundlingPartials(partials, sourcemap);
    for await (const finalized of finalizing) {
        bundles.push(finalized);
    }

    // Return metadata
    return bundles;
}


/**
 * Maps all the found entry points to the basename of the
 * file that will result from their bundling;
 * throws if omonimous are found.
 */
function _getNamesEntryMap(
    entryPoints: entryPointPath[],
    nameAsDirectory?: boolean
): Map<bundleName, entryPointPath> {
    const namesMap = new Map<bundleName, entryPointPath>();

    for (const entry of entryPoints) {
        const name = (nameAsDirectory
            ? path.basename(path.dirname(entry))
            : path.basename(entry, path.extname(entry))) as bundleName;

        // Check for duplicates
        const duplicate = namesMap.get(name);
        if (duplicate)
            throw new DuplicateOperationError(
                `${name} cannot be bundled twice:`
                + `\n${entry} will have the same name as`
                + `\n${duplicate}`
            );

        namesMap.set(name, entry);
    }
    return namesMap;
}

/**
 * Generates the buffers of the bundles and of the sourcemap 
 * (if requested); nothing is written.
 */
async function _bundleScriptsInBuffers(
    namesEntryMap: Map<bundleName, entryPointPath>,
    outDir: string,
    options?: BundlingOptions
): Promise<BundlingPartial[]> {
    const { hash, minify, target, sourcemap } = options ?? {};

    const bundles: BundlingPartial[] = [];

    for (const [name, entry] of namesEntryMap.entries()) {
        // Bundle scripts
        const result = await esbuild.build({
            entryPoints: [entry],
            bundle: true,
            target: target,
            platform: 'browser',
            format: 'esm',
            write: false, // Returns buffer array
            minify,
            outdir: outDir,
            sourcemap: sourcemap && sourcemap !== 'none' ? sourcemap : false,
            /* minifyWhitespace: true,
            minifyIdentifiers: true,
            minifySyntax: true, */
        });

        // Extract contents buffer
        const jsFile = result.outputFiles.find(f => f.path.endsWith('.js'));
        const mapFile = result.outputFiles.find(f => f.path.endsWith('.js.map'));
        if (!jsFile) throw new OperationFailedError(
            `File at ${entry} cannot be bundled correctly.`
        );
        // The map file must exist if sourcemap is to be external
        if (sourcemap === 'external' && !mapFile)
            throw new OperationFailedError(
                `Cannot map sources of file at ${entry}.`
            );

        const jsBuffer = Buffer.from(jsFile.contents);
        const filename = hash
            ? `${name}.${createHashFromBuffer(jsBuffer)}.js`
            : `${name}.js`;

        const sourceMappingURL = `${filename}.map`;

        const finalJsBuff = (sourcemap === 'external'
            ? Buffer.concat([jsBuffer, Buffer.from(`\n//# sourceMappingURL=${sourceMappingURL}\n`)])
            : jsBuffer) as JsBuffer<ArrayBuffer>;

        // Build path to writing location
        const outPath = path.resolve(path.join(outDir, filename));

        // Object output construction
        const script: BundledPartial = {
            filename,
            basename: name,
            extension: 'js',
            path: outPath,
            sourceMapPath: sourcemap === 'external'
                ? path.resolve(path.join(outDir, sourceMappingURL))
                : undefined
        }
        bundles.push({
            script, buffer: finalJsBuff,
            mapBuff: mapFile && Buffer.from(mapFile.contents) as SMBuffer<ArrayBuffer>
        });
    }
    return bundles;
}

/**
 * Writes on disk the bundles and yields a 
 * metadata object for each.
 */
async function* _finalizeBundlingPartials(
    partials: BundlingPartial[],
    sourcemap?: string
): AsyncGenerator<BundledScript, void, unknown> {
    for (const { script, buffer, mapBuff } of partials) {
        const { path: outPath, sourceMapPath } = script;

        await writeFile(outPath, buffer);
        const { size } = await stat(outPath);
        const bundled = { ...script, size }

        Log.file(outPath, size);

        if (sourcemap === 'external' && sourceMapPath && mapBuff) {
            await writeFile(sourceMapPath, mapBuff);
            const { size } = await stat(sourceMapPath);

            Log.file(sourceMapPath, size)
        }

        yield bundled;
    }
}