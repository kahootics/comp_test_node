import sharp from 'sharp';
import { Log } from '../../../../tools/console.js';
import { ExportRule } from '../rule.js';
import z from 'zod';
import { Asset } from '../asset.js';
import { ValidationError } from '../../../../errors/common-errors.mjs';
import { CopyRule } from './copy-rule.js';
import { SrcsetOutput } from "../../../shared/assets-export-classes.js";
import type { directoryString } from '../../../types/general-types.js';


const widthsSchema = z.array(z.int().min(100)).nonempty();
type widthsType = z.infer<typeof widthsSchema>;

const ruleSchema = CopyRule.schema.extend({
    widths: widthsSchema
});
type ruleType = z.infer<typeof ruleSchema>;

export class SrcsetRule extends CopyRule implements ExportRule<
    ruleType
> {
    public static override readonly ownName: string = 'SrcsetRule';
    public static override readonly schema = ruleSchema;

    private readonly widths: widthsType;
    private readonly maxWidth: number;

    constructor(data: ruleType) {
        const { widths, hash, format, formatOptions } = data;
        super({ hash, format, formatOptions });
        this.widths = widths;

        this.maxWidth = Math.max(...widths);
    }

    override async enforce(exportableAsset: Asset, dest: directoryString): Promise<SrcsetOutput> {

        // Will use the original asset, ignoring any other rule
        /*const asset = new Asset(exportableAsset.path);
        
        const { width, height } = await this.getAssetSize(asset);
        this.#validateWidth(asset, width);

        asset.outDir = path.dirname(destPathCorrected(asset.path, this.dest)) as directoryString;
        asset.outExt = this.format ? this.format : asset.ext;

        const sharpAsset = this.#getFormattedSharpAsset(asset);

        if (this.createHash) {
            const hash = await this.createHashFromSharp(sharpAsset);
            asset.outName = asset.name + hash as nameString;
        }
        fs.mkdirSync(asset.outDir, { recursive: true });

        await sharpAsset.clone().toFile(asset.outPath);
        Log.file(asset.outPath);

        // Start building output
        const output = new SrcsetOutput(asset.name, asset.outPath, width, height);

        for (const width of this.widths) {
            const srcsetSharp = sharpAsset.clone().resize({ width });
            const outName = asset.name
                + '.' + width
                + (this.createHash ? await this.createHashFromSharp(srcsetSharp) : '')
                + '.' + asset.outExt;
            const outPath = path.resolve(path.join(asset.outDir, outName));
            await srcsetSharp.toFile(outPath);
            Log.file(outPath);

            output.add(width, outPath);
        }

        return output; */

        const subRes = await super.enforce(exportableAsset, dest);

        const output = SrcsetOutput.from(subRes);
        this.#validateWidth(exportableAsset, output.width);

        for (const width of this.widths) {
            const asset = exportableAsset.clone();
            const srcsetSharp = sharp(asset.path).resize({ width });
            asset.setOutParam('w', width + 'px');
            if (this.createHash) {
                const hash = await this.createHashFromSharp(srcsetSharp);
                asset.setOutParam('hash', hash);
            }
            await srcsetSharp.toFile(asset.outPath);
            Log.file(asset.outPath);

            output.add(width, asset.outPath);
        }
        return output;
    }

    #validateWidth(asset: Asset, assetWidth: number) {
        if (this.maxWidth >= assetWidth)
            throw new ValidationError(
                "Cannot upscale images:\n"
                + `${asset.name} at ${asset.path} is too small; must have width greater than ${this.maxWidth}px`
            );
    }

    /* #getFormattedSharpAsset(asset: Asset) {
        return this.format
            ? sharp(asset.path).toFormat(this.format, this.formatOptions)
            : sharp(asset.path);
    } */


}