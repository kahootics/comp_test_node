import path from "node:path";
import z from "zod";
import type { directoryString } from "../../../types/general-types.js";
import fs from 'node:fs';
import { formatSchema, optionsSchema } from './format-rule.js';
import { ExportRule } from "../tmp-rule.js";
import { AssetOutput } from "../../../shared/assets-export-classes.js";
import { Asset } from "../tmp-asset.js";
import sharp from "sharp";
import { createHashFromBuffer } from "../../writers/hash.js";
import { destPathCorrected } from "../../writers/copy-file-to.js";
import { Log } from "../../../../tools/console.js";

const hashSchema = z.boolean().default(false);
type hashType = z.infer<typeof hashSchema>;

const ruleSchema = z.object({
    hash: hashSchema,
    format: formatSchema.optional(), formatOptions: optionsSchema.optional()
})
type ruleType = z.infer<typeof ruleSchema>;

export class CopyRule extends ExportRule<
    ruleType
> {
    public static override readonly ownName: string = 'CopyRule';
    public static override readonly schema = ruleSchema;

    protected readonly createHash: hashType;
    protected readonly format?: z.infer<typeof formatSchema>;
    protected readonly formatOptions?: z.infer<typeof optionsSchema>;

    constructor(data: ruleType) {
        super(data);
        const { hash, format, formatOptions } = data;
        this.createHash = hash;
        this.format = format;
        this.formatOptions = formatOptions;
    }

    override async enforce(asset: Asset, dest: directoryString): Promise<AssetOutput> {
        // Will use the original asset, ignoring any other rule

        const { width, height } = await this.getAssetSize(asset);

        asset.outDir = path.dirname(destPathCorrected(asset.path, dest)) as directoryString;
        asset.outExt = this.format ? this.format : asset.ext;

        const sharpAsset = this.#getFormattedSharpAsset(asset);

        if (this.createHash) {
            const hash = await this.createHashFromSharp(sharpAsset);
            asset.setOutParam('copy',hash);
        }
        fs.mkdirSync(asset.outDir, { recursive: true });

        await sharpAsset.toFile(asset.outPath);
        asset.saveEdits();
        Log.file(asset.outPath);

        return new AssetOutput(asset.name,asset.outPath,width,height);
    }

    #getFormattedSharpAsset(asset: Asset) {
        return this.format
            ? sharp(asset.path).toFormat(this.format, this.formatOptions)
            : sharp(asset.path);
    }

    protected async getAssetSize(asset: Asset) {
        const metadata = await sharp(asset.path).metadata();
        const { width, height } = metadata;
        if (!width || !height) throw new Error(`Cannot read metadata from: ${asset.path}`);
        return { width, height };
    }

    /**
     * Returns a hash created from the bufferized clone of the sharp asset
     */
    protected async createHashFromSharp(sharpAsset: sharp.Sharp) {
        const buffer = await sharpAsset.clone().toBuffer();
        return createHashFromBuffer(buffer);
    }
}