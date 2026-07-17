import path from "node:path";
import z from "zod";
import { getFileBirthTime } from "../../../../tools/companion-util.js";
import { type nameType } from "../no.js";
import { BatchRule, ruleCategory, allRuleClasses } from "../Rule.js";
import { Asset } from "../Asset.js";

function reorderScreenshotName(filename: string): string {
    const regex = /^Screenshot (\d{2})_(\d{2})_(\d{4}) (\d{2})_(\d{2})_(\d{2})/;
    const regexFinal = /^Screenshot (\d{4})_(\d{2})_(\d{2}) (\d{2})_(\d{2})_(\d{2})/;
    const match = filename.match(regex);
    if (!match) {
        if (!filename.match(regexFinal))
            throw new Error(`${filename} cannot be sorted by screenshot name due to wrong formatting`);
        // return if already correctly formatted
        return filename;
    };

    const [, dd, mm, yyyy, hh, min, ss] = match;
    return filename.replace(
        regex,
        `Screenshot ${yyyy}_${mm}_${dd} ${hh}_${min}_${ss}`
    );
}
function sString(a: string, b: string) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
function sDate(a: Date, b: Date) {
    return a > b ? 1 : a < b ? -1 : 0
}

const sortby = {
        name(a: Asset, b: Asset) {
            return sString(a.name, b.name);
        },
        date(a: Asset, b: Asset) {
            const c = getFileBirthTime(a.path);
            const d = getFileBirthTime(b.path);
            return sDate(c, d);
        },
        screenshot(c: Asset, d: Asset) {
            const a = reorderScreenshotName(c.name);
            const b = reorderScreenshotName(d.name);
            return sString(a, b);
        },
        none(a: Asset, b: Asset) { return 0; }
    };
    const sortKeys = Object.keys(sortby) as [keyof typeof sortby, ...(keyof typeof sortby)[]];

const includeSchema = z.instanceof(RegExp).default(/.*/s);
type includeType = z.infer<typeof includeSchema>;
    const sortSchema = z.enum(sortKeys);
type sortType = z.infer<typeof sortSchema>;
    const renameSchema = z.array(z.string().trim().nonempty()).nonempty();
    type renameType = z.infer<typeof renameSchema>
    type namesType = Set<nameType>;
    const ruleSchema = z.object({
        include: includeSchema, sort: sortSchema, names: renameSchema
    });
type ruleType = z.infer<typeof ruleSchema>;


class RenameRule extends BatchRule<ruleType> {

    public static readonly category = ruleCategory.LOCAL;  
    public static readonly schema = ruleSchema;

    private readonly include: includeType;
    private readonly sort: sortType;
    private readonly names: namesType;
    private readonly rename: renameType;

    constructor(data: ruleType) {
        super(data);
        this.include = data.include;
        this.sort = data.sort;
        this.rename = data.names;
        this.names = new Set(data.names) as namesType;
    }

    /**
     * Filters and sorts a list of `Asset` according to
     * the rule and assigns to each's `outName` property
     * the corresponding name out of a same-sized list
     *
     * @param assetsList - A list of assets to rename members of
     * @param renameRule - A rename rule containing the names to assign
     */
    enforce(
        assetsList: Asset[]
    ): void {
        if (assetsList.length < 1) return;

        const assetsSortedList = assetsList
            .filter(asset => asset.name.match(this.include))
            .filter(asset => this.names.has(asset.name) )
            .sort(sortby[this.sort]);

        if (assetsSortedList.length !== this.names.size)
            throw new Error(`Assets at ${path.dirname(assetsList[0]!.path)} do not match final names size`);

        assetsSortedList.forEach((asset, i) => {
            const outName = this.rename[i];
            if (!outName) throw new Error("Cannot assign empty name");
            asset.outName = outName as nameType;
        });
    }
}
allRuleClasses.add(RenameRule);
