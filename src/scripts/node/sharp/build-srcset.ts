import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { destPathCorrected } from '../writers/copy-file-to.js';
import hashFile from '../writers/hash.js';
import { Log, toPublicUrl } from '../../../config/companion-util.js';

/**
 * @param format - Format of destination
 * @param quality - Quality of conversion
 */
interface ImageFormat {
    format: keyof sharp.FormatEnum;
    quality: number;
}

export interface SrcsetOutput {
    name: string;
    src: string;
    alt: string;
    width: number;
    height: number;
    srcset: Record<string, string>;
}

/**
 * Builds an image srcset from a source file.
 * @param filePath - Source image path
 * @param dest - Destination path or directory
 * @param widths - Array of widths to generate
 * @param alt - Alt text, or `false` for decorative images
 * @param hash - (optional) Whether to hash output filenames
 * Defaults to `false`.
 * @param [newFormat] - (optional) Format conversion: see {@link ImageFormat}
 * @returns srcset output object
 */
export async function buildSrcset(
    filePath: string,
    dest: string,
    widths: number[],
    alt: string | false,
    hash?: boolean,
    newFormat?: ImageFormat
): Promise<SrcsetOutput> {

    // Metadata read (later use)
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;
    if(!width || !height) throw new Error(`Cannot read metadata from: ${filePath}`);

    const corrDest = destPathCorrected(filePath, dest);
    const outDir   = path.dirname(corrDest);
    const ext      = path.extname(corrDest).slice(1);
    const name     = path.basename(corrDest, '.' + ext);
    const outExt   = newFormat ? newFormat.format : ext;

    // Sharp Pipeline builder for each new output image
    const makePipeline = () => newFormat
        ? sharp(filePath).toFormat(newFormat.format, { quality: newFormat.quality })
        : sharp(filePath);

    // Non-resized image
    const ogOutPath = path.resolve(path.join(outDir, `${name}.${outExt}`));
    fs.mkdirSync(path.dirname(ogOutPath), { recursive: true });   
    await makePipeline().toFile(ogOutPath);
    const ogHashedPath = hash ? hashFile(ogOutPath) : ogOutPath;

    // init result
    const output: SrcsetOutput = {
        name,
        src:    toPublicUrl(ogHashedPath),
        alt:    alt || '',
        width,
        height,
        srcset: { [`${width}w`]: toPublicUrl(ogHashedPath) },
    };

    Log.file(ogHashedPath);
    
    // srcset builder
    for (const setWidth of widths) {
        // skip widths greater of original's (no upscale)
        if (setWidth >= width) continue;

        const varOutPath = path.resolve(path.join(outDir, `${name}.${setWidth}.${outExt}`));
        await makePipeline().resize({ width: setWidth }).toFile(varOutPath);
        // Rename with hashing
        const varHashedPath = hash ? hashFile(varOutPath) : varOutPath;

        output.srcset[`${setWidth}w`] = toPublicUrl(varHashedPath);
    }

    return output;
}

