import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { destPathCorrected } from '../../writers/copy-file-to.js';
import { createHashFromBuffer } from '../../writers/hash.js';
import { toPublicUrl } from '../../../../tools/companion-util.js';
import { Log } from '../../../../tools/console.js';
import { allRuleClasses, ExportRule } from '../rule.js';
import z, { number } from 'zod';
import { Asset } from '../asset.js';
import { formatSchema, optionsSchema } from './format-rule.js';
import type { directoryString, hashString, nameString } from '../../../types/general-types.js';
import { ValidationError } from '../../../../errors/common-errors.js';


const widthsSchema = z.array(z.int().min(100)).nonempty();
type widthsType = z.infer<typeof widthsSchema>;

const hashSchema = z.boolean().default(false);
type hashType = z.infer<typeof hashSchema>;

const destSchema = z.url().refine(
    dest => path.extname(dest) === '',
    { error: "a directory can't have an extension" });
type destType = directoryString;
const ruleSchema = z.object({
    widths: widthsSchema, hash: hashSchema, dest: destSchema,
    format: formatSchema.optional(), formatOptions: optionsSchema.optional()
});
type ruleType = z.infer<typeof ruleSchema>;

export interface SrcsetOutput {
    name: nameString;
    src: string;
    width: number;
    height: number;
    srcset: { [width_w: string]: string };
}

export class SrcsetRule extends ExportRule<
    ruleType, SrcsetOutput
> {
    public static readonly ownName = 'SrcsetRule';
    public static override readonly priority = 1;
    public static readonly schema = ruleSchema;

    #widths: widthsType;
    #maxWidth: number;
    #hash: hashType;
    #dest: destType;
    #format?: z.infer<typeof formatSchema>;
    #formatOptions?: z.infer<typeof optionsSchema>;

    constructor(data: ruleType) {
        super(data);
        const { widths, hash, dest, format, formatOptions } = data;
        this.#widths = widths;
        this.#hash = hash;
        this.#dest = dest as destType;
        this.#format = format;
        this.#formatOptions = formatOptions;

        this.#maxWidth = Math.max(...widths);
    }

    override async enforce(exportableAsset: Asset) {

        // Will use the original asset, ignoring any other rule
        const asset = new Asset(exportableAsset.path);

        const { width, height } = await this.#getAssetSize(asset);
        this.#validateWidth(asset, width);

        asset.outDir = path.dirname(destPathCorrected(asset.path, this.#dest)) as directoryString;
        asset.outExt = this.#format ? this.#format : asset.ext;

        const sharpAsset = this.#getFormattedSharpAsset(asset);

        if (this.#hash) {
            const hash = await this.#createHashFromSharp(sharpAsset);
            asset.outName = asset.name + hash as nameString;
        }
        fs.mkdirSync(asset.outPath, { recursive: true });

        await sharpAsset.clone().toFile(asset.outPath);
        Log.file(asset.outPath);

        // Start building output
        const output: SrcsetOutput = {
            name: asset.name,
            src: toPublicUrl(asset.outPath),
            width, height,
            srcset: {}
        };

        for (const width of this.#widths) {
            const srcsetSharp = sharpAsset.clone().resize({ width });
            const outName = asset.name
                + '.' + width
                + (this.#hash ? await this.#createHashFromSharp(srcsetSharp) : '')
                + '.' + asset.outExt;
            const outPath = path.resolve(path.join(asset.outDir, outName));
            await srcsetSharp.toFile(asset.outPath);
            Log.file(outPath);

            output.srcset[`${width}w`] = toPublicUrl(outPath);
        }

        return output;
    }

    #validateWidth(asset: Asset, assetWidth: number) {
        if (this.#maxWidth >= assetWidth)
            throw new ValidationError(
                "Cannot upscale images:\n"
                + `${asset.name} at ${asset.path} is too small; must have width greater than ${this.#maxWidth}px`
            );
    }

    #getFormattedSharpAsset(asset: Asset) {
        return this.#format
            ? sharp(asset.path).toFormat(this.#format, this.#formatOptions)
            : sharp(asset.path);
    }

    async #getAssetSize(asset: Asset) {
        const metadata = await sharp(asset.path).metadata();
        const { width, height } = metadata;
        if (!width || !height) throw new Error(`Cannot read metadata from: ${asset.path}`);
        return { width, height };
    }

    /**
     * Returns a hash created from the bufferized clone of the sharp asset
     */
    async #createHashFromSharp(sharpAsset: sharp.Sharp) {
        const buffer = await sharpAsset.clone().toBuffer();
        return createHashFromBuffer(buffer);
    }
}
allRuleClasses.add(SrcsetRule);