import sharp from "sharp";
import z from "zod";
import { type extType } from "../no.js";
import { AssetRule, ruleCategory, allRuleClasses } from "../Rule.js";
import { Asset } from "../Asset.js";

const formatSchema = z.enum(['jpeg', 'gif', 'avif', 'webp', 'png']);
const optionsSchema = z.object({
    quality: z.number().min(1).max(100).optional(),
    lossless: z.boolean().optional()
});
type optionsType = z.infer<typeof optionsSchema>;
const ruleSchema = z.object({
    format: formatSchema, formatOptions: optionsSchema.optional()
});
type ruleType = z.infer<typeof ruleSchema>;


class FormatRule extends AssetRule<ruleType> {

    public static readonly category = ruleCategory.LOCAL;

    private readonly format: extType;
    private readonly options?: optionsType;

    public static readonly schema = ruleSchema;

    constructor(data: ruleType) {
        super(data);
        this.format = data.format;
        this.options = data.formatOptions;
    }
    enforce(asset: Asset, sharpAsset: sharp.Sharp) {
        if (asset.ext === this.format) return sharpAsset;
        asset.outExt = this.format;
        return sharpAsset.toFormat(this.format, this.options);
    }
}
allRuleClasses.add(FormatRule);
