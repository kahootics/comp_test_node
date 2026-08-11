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

const behavSchema = z.enum(['skip', 'throw', 'full']);
type behaviorType = z.infer<typeof behavSchema>;


const ruleSchema = CopyRule.schema.extend({
    widths: widthsSchema, behavior: behavSchema
});
type ruleType = z.infer<typeof ruleSchema>;

export class SrcsetRule extends CopyRule implements ExportRule<
    ruleType
> {
    public static override readonly ownName: string = 'SrcsetRule';
    public static override readonly schema = ruleSchema;

    private readonly widths: widthsType;
    private readonly behavior: behaviorType;
    private readonly maxWidth: number;

    constructor(data: ruleType) {
        const { widths, hash, format, formatOptions, behavior } = data;
        super({ hash, format, formatOptions });
        this.widths = widths;
        this.behavior = behavior;

        this.maxWidth = Math.max(...widths);
    }

    override async enforce(exportableAsset: Asset, dest: directoryString): Promise<SrcsetOutput> {

        const subRes = await super.enforce(exportableAsset, dest);

        const output = SrcsetOutput.from(subRes);
        const usableWidths = this.#validateWidth(exportableAsset, output.width);
        if (usableWidths.length === 0) return output;

        for (const width of usableWidths) {
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
        if (this.maxWidth > assetWidth)
            switch (this.behavior) {
                case 'skip': {
                    return this.widths.filter(width => width < assetWidth)
                }
                case 'throw': throw new ValidationError(
                    "Cannot upscale images:\n"
                    + `${asset.name} at ${asset.path} is too small (${assetWidth}); must have width greater than ${this.maxWidth}px`
                );
                case 'full': {
                    return this.widths.map(width => width > assetWidth ? assetWidth : width)
                }
            }
        return this.widths;
    }
}