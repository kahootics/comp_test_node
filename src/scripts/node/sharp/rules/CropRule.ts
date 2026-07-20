import sharp from "sharp";
import z from "zod";
import { IllegalArgumentError } from "../../../../errors/common-errors.js";
import type { hashString } from "../../../types/general-types.js";
import { type nameType } from "../no.js";
import { AssetRule, ruleCategory, allRuleClasses } from "../Rule.js";
import { Asset } from "../Asset.js";

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

/**
 * @param name - Full name of the asset
 * @returns a crop hash from filename
 */
function extractHash(name: nameType): hashString | null {
    const { hash } = name.match(/\.crop(?<hash>[0-9a-zA-Z]{8})/)?.groups ?? {};
    return hash ? z.hash('md5').parse(hash) as hashString : null;
}

function injectHash(name: nameType, hash: hashString): nameType {
    const current = extractHash(name);
    if (current)
        return name.replace(current, hash) as nameType;

    else
        return name + '.crop' + hash as nameType;
}


// ================================================================================
export class CropRule extends AssetRule<ruleType> {
    public static readonly category = ruleCategory.LOCAL;

    private readonly use: useType;
    private readonly extract: extractType;

    public static readonly schema = ruleSchema;

    constructor(data: ruleType) {
        super(data);
        this.use = data.use;
        this.extract = data.extract;
    }

    async enforce(
        asset: Asset,
        sharpAsset: sharp.Sharp
    ): Promise<sharp.Sharp> {

        const { fullName, name } = asset;

        const cropHash = extractHash(fullName);

        // If alredy cropped according to current rule, exit
        if (cropHash === this.hash) return sharpAsset;
        if (cropHash && cropHash !== this.hash)
            throw new Error(`Asset ${name} has already been cropped according to a different rule, \nan asset can oly be cropped once`);

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
        asset.outName = injectHash(asset.outName, this.hash);
        return result;
    }
}
allRuleClasses.add(CropRule);
