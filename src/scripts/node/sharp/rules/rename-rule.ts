import path from "node:path";
import z from "zod";
import { getFileBirthTime } from "../../../../tools/companion-util.js";
import { BatchRule } from "../rule.js";
import { Asset } from "../asset.js";
import type { nameString } from "../../../types/general-types.js";
import { ValidationError } from "../../../../errors/common-errors.mjs";

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



const sortby/* : {[x: string]: (a: Asset, b: Asset) => number}  */ = {
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
type SortKey = keyof typeof sortby;

// z.enum vuole una tupla non vuota, non un semplice string[]
const sortKeys = Object.keys(sortby) as [SortKey, ...SortKey[]];

const includeSchema = z
    .string()
    .default(".*")
    .refine((s) => new RegExp(s, "s"));
type includeType = RegExp;
const sortSchema = z.enum(sortKeys);
type sortType = z.infer<typeof sortSchema>;
const renameSchema = z.array(z.string().trim().nonempty()).nonempty();
const ruleSchema = z.object({
    include: includeSchema, sort: sortSchema, names: renameSchema
});
type ruleType = z.infer<typeof ruleSchema>;


export class RenameRule extends BatchRule<ruleType> {

    public static override readonly ownName = 'RenameRule';

    public static override readonly priority = 9;

    public static override readonly schema = ruleSchema;

    private readonly include: includeType;
    private readonly sort: sortType;
    private readonly names: nameString[];

    constructor(data: ruleType) {
        super(data);
        this.include = new RegExp(data.include);
        this.sort = data.sort;
        this.names = data.names as nameString[];
    }

    /**
     * Filters and sorts a list of `Asset` according to
     * the rule and assigns to each's `outName` property
     * the corresponding name out of a same-sized list
     *
     * @param assetsList - A list of assets to rename the members of
     */
    enforce(
        assetsList: Asset[]
    ): void {
        if (assetsList.length < 1) return;
        // List of names to replace
        if (this.names.some(name => name.trim() === ''))
            throw new ValidationError('Cannot rename a file to empty string');
        const namesToReplace = new Set(this.names.slice());
        if (namesToReplace.size !== this.names.length)
            throw new ValidationError('Must provide a list of unique names to rename rule');

        const assetsSortedList = assetsList
            // removes files with names from the list
            .filter(asset => {
                if (namesToReplace.has(asset.name)) {
                    namesToReplace.delete(asset.name);
                    return false;
                }
                return true;
            })
            // excludes non-matching names
            .filter(asset => asset.name.match(this.include))
            // sorts according to rule
            .sort(sortby[this.sort]);

        if (assetsSortedList.length !== namesToReplace.size)
            throw new ValidationError(`Assets at ${assetsList[0]!.dir} do not match final names list size of rename rule`);

        const rename = Array.from(namesToReplace);
        assetsSortedList.forEach((asset, i) => {
            const outName = rename[i];
            asset.outName = outName as nameString;
        });
    }
}
