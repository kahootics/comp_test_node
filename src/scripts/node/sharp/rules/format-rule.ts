import sharp, { type FormatEnum, type Sharp } from "sharp";
import z from "zod";
import { AssetRule } from "../rule.js";
import { Asset } from "../asset.js";
import type { extType } from "../../../types/general-types.js";

export const formatSchema = z.enum(['jpeg', 'gif', 'webp', 'png']);
export const optionsSchema = z.object({
    quality: z.number().min(1).max(100).optional(),
    lossless: z.boolean().optional()
});
type optionsType = z.infer<typeof optionsSchema>;
const ruleSchema = z.object({
    format: formatSchema, formatOptions: optionsSchema.optional()
});
type ruleType = z.infer<typeof ruleSchema>;


export class FormatRule extends AssetRule<ruleType> {
    
    public static override readonly ownName = 'FormatRule';

    private readonly format: keyof FormatEnum;
    private readonly options?: optionsType;

    public static override readonly schema = ruleSchema;

    constructor(data: ruleType) {
        super(data);
        this.format = data.format;
        this.options = data.formatOptions;
    }
    enforce(asset: Asset, sharpAsset: Sharp) {
        if (asset.ext === this.format) return sharpAsset;
        asset.outExt = this.format;
        return sharpAsset.toFormat(this.format, this.options);
    }
}
