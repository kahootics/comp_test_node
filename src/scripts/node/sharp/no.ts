import sharp from "sharp";
import type { hashString } from "../../types/general-types.js";
import z from "zod";
import { createHashFromBuffer, createHashFromFile } from "../writers/hash.js";
import path from "path";

declare const DirectorySymbol: unique symbol;
export type directoryType = string & { [DirectorySymbol]: void }
declare const NameSymbol: unique symbol;
export type nameType = string & { [NameSymbol]: void }
export type extType = keyof sharp.FormatEnum;



function stableStringify(obj: {}) {
    return JSON.stringify(obj, Object.keys(obj).sort());
}

export function hashFromRule(rule: {}) {
    const buffer = stableStringify(rule)
    return createHashFromBuffer(buffer) as hashString;
}

import fs from 'node:fs'
import { glob } from "glob";
import { Log } from "../../../tools/console.js";
import { CropRule } from "./rules/CropRule.js";
import { Asset } from "./Asset.js";
import { AssetRule, BatchRule, ruleCategory, allRuleClasses } from "./Rule.js";

/* class RuleSet {
    private readonly rules: Set<AssetRule> = new Set();
    private readonly batchRules: Set<BatchRule> = new Set();

    constructor(rawRuleset: string, ruleCategory: ruleCategory) {

        const availableRules = new Map([...allRuleClasses].filter(ruleClass =>
            ruleClass.category === ruleCategory
        ).map(ruleClass => [ruleClass.name, ruleClass]));

        const innerParser: { [className: string]: any } = {}
        availableRules.forEach(ruleClass => {
            innerParser[ruleClass.name] = ruleClass.schema.optional();
        });

        const parsed = z.object(innerParser).parse(JSON.parse(rawRuleset));
        Object.keys(parsed).forEach(className => {

            const ruleClass = availableRules.get(className);
            if (!ruleClass) throw new Error();

            const rule = new ruleClass(parsed[className]);

            if (rule instanceof AssetRule) this.rules.add(rule);
            else if (rule instanceof BatchRule) this.batchRules.add(rule);
            else throw new Error();
        });

    }

    public enforceBatchRules(assetsList: Asset[]): void {
        this.batchRules.forEach(batchRule => batchRule.enforce(assetsList));
    }
    async enforceAssetRules(directory: directoryType, asset: Asset): Promise<void> {

        const innerHash = createHashFromFile(asset.path) as hashString;
        if (localHashSet.has(innerHash)) return; // already conforms to the rule

        let sharpAsset = sharp(asset.path);

        this.rules.forEach(async rule => {
            sharpAsset = await rule.enforce(asset, sharpAsset)
        });

        // FINAL STEPS TO REWRITE

        const outPath = path.resolve(path.join(
            directory, `${asset.outName}${asset.outHash}.${asset.outExt}`));

        const res = await sharpAsset.toFile(outPath);

        // Delete old file (if it hasn't been overwritten)
        if (asset.path !== outPath) {
            fs.unlinkSync(asset.path);
            Log.msg(`Removed asset at ${asset.path}`);
        }
        Log.file(outPath, res.size);

        const hash = createHashFromFile(outPath) as hashString;
        localHashSet.add(hash);
    }

}

class Directory {
    readonly path: directoryType;
    readonly ruleset: RuleSet;
    readonly assets: Asset[];
    private hashSet: Set<hashType>;

    constructor() {}
    public static async of(rootDir: string, rulesFileName: string, hashRecordFileName: string, exts: extType[]): Promise<Directory[]> {

    }

    private loadHashSet(hashRecordFileName: string): Set<hashType> { ... }
    private saveHashSet(hashRecordFileName: string): void { ... }
    validate(): void { ... }        // ex validatAssetsDir
    public async enforce(hashRecordFileName: string): Promise<void> { ... }  // ex enforce.localRule
} */

/**
 * Async function that creates a map of asset directories and relative rules
 * @param pattern - glob pattern to all the rules files
 * @returns a promise containing a collection of rules + empty asset lists (name + path) indexed by their directory
 * @requires glob
 */
/* async function getRules(
    pattern: string
): Promise<Map<directoryType, RuleSet>> {

    const allAssetsRulesPaths = await glob(pattern);

    return new Map(
        allAssetsRulesPaths.map(rulePath => {
            const directory = path.dirname(rulePath) as directoryType;
            const ruleStr = fs.readFileSync(rulePath, 'utf-8');
            const ruleRaw = JSON.parse(ruleStr);
            const rule = .ruleFile().parse(ruleRaw);

            return [directory, rule];
        })
    );
} */


/**
 * Async function that creates a map of asset directories and relative rules paired with the assets contained in that directory
 * 
 * @param assetsRootDirectory - Root directory from where start fetching the assets
 * @param rulesFileName - Name (without extension) of the rules file name
 * @param assetsExtensions - An array of all fetchable assets extensions
 * @returns a promise containing a collection of rules + asset lists (name + path) indexed by their directory
 * @requires glob
 */
/* export async function getAssetsWithRules(
    assetsRootDirectory: string,
    rulesFileName: string,
    assetsExtensions: extType[]
): Promise<Map<directoryType, RuleWithAssets>> {

    const assetsGlob = path.join(assetsRootDirectory, '**', `*.{${assetsExtensions.join(',')}}`);
    const rulesGlob = path.join(assetsRootDirectory, '**', `${rulesFileName}.json`);

    const allAssetsPathsRaw = await glob(assetsGlob);
    const allAssetsRules = await getRules(rulesGlob);

    allAssetsPathsRaw.forEach(assetPath => {

        const assetDir = path.dirname(assetPath) as directoryType;
        const assetExt = path.extname(assetPath) as extType; // .{jpg,png...}
        const assetName = path.basename(assetPath, assetExt) as nameType;
        assetName
        const assetRuleObj = allAssetsRules.get(assetDir);

        if (!assetRuleObj)
            throw new Error(
                `There is no rule for images in directory: ${assetDir}`
            );

        const { name, hash } = CropRule.splitNameFromHash(assetName);

        assetRuleObj.assets.push(
            new Asset(name, assetExt, hash, assetPath)
        );
    })

    return allAssetsRules;
} */