import sharp from "sharp";
import z from "zod";
import { IllegalArgumentError } from "../../../../errors/common-errors.mjs";
import { AssetRule } from "../rule.js";
import { Asset } from "../asset.js";

enum Use {
    PERCENTAGE = "percentage",
    FLAT = "flat",
}
const useSchema = z.enum(Use);
type useType = z.infer<typeof useSchema>;
const extractSchema = z.object({
    top: z.number(),
    left: z.number(),
    width: z.number(),
    height: z.number()
}).refine(
    extract => Object.values(extract).every(param => (0 <= param && param <= 1)),
    {
        error: 'If using percentage values for extracting sub-image, values of '
            + 'extraction parameters must be within [0;1]'
    }
);
type extractType = z.infer<typeof extractSchema>;
const ruleSchema = z.object({
    use: useSchema,
    extract: extractSchema
});
type ruleType = z.infer<typeof ruleSchema>;


// ================================================================================
export class CropRule extends AssetRule<ruleType> {
    
    public static override readonly ownName = 'CropRule';

    private readonly use: useType;
    private readonly extract: extractType;

    public static override readonly schema = ruleSchema;

    constructor(data: ruleType) {
        super(data);
        this.use = data.use;
        this.extract = data.extract;
    }

    async enforce(
        asset: Asset,
        sharpAsset: sharp.Sharp
    ): Promise<sharp.Sharp> {

        const cropHash = asset.getParam('crop');
        // If alredy cropped according to current rule, exit
        if (cropHash === this.hash) return sharpAsset;
        if (cropHash && cropHash !== this.hash)
            throw new Error(`Asset ${asset.name} has already been cropped according to a different rule, \nan asset can only be cropped once`);

        const { width, height } = await sharpAsset.clone().metadata();

        let result: sharp.Sharp;
        switch (this.use) {

            case Use.FLAT:
                result = sharpAsset.extract(this.extract);
                break;

            case Use.PERCENTAGE:
                result = sharpAsset.extract({
                    top: Math.floor(height * this.extract.top),
                    left: Math.floor(width * this.extract.left),
                    width: Math.floor(width * this.extract.width),
                    height: Math.floor(height * this.extract.height)
                });
                break;

            default:
                throw new IllegalArgumentError('A type for extraction parameters must be passed in the rule');
        }
        asset.setOutParam('crop',this.hash);
        return result;
    }
}
