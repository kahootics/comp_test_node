import sharp from "sharp";
import path from "path";
import fs from 'node:fs'
import { Asset } from "./Asset.js";
import { ruleCategory } from "./Rule.js";
import { glob } from "glob";
import { RuleSet } from "./RuleSet.js";

// Branded types
declare const DirectorySymbol: unique symbol;
export type directoryType = string & { [DirectorySymbol]: void }
declare const NameSymbol: unique symbol;
export type nameType = string & { [NameSymbol]: void }
export type extType = keyof sharp.FormatEnum;

class Directory {
    readonly path: directoryType;
    readonly ruleset: RuleSet;
    readonly assets: Asset[];

    constructor(path: string, assets: Asset[], rulesetName: string, rulesetCategory: ruleCategory) {
        this.path = path as directoryType;
        this.assets = assets;
        this.ruleset = new RuleSet(this.path, rulesetName, rulesetCategory);
    }

    //validate(): void { ... }        // ex validatAssetsDir
    //public async enforce(hashRecordFileName: string): Promise<void> { ... }  // ex enforce.localRule
}

/**
 * Async function that creates a map of asset directories and relative rules
 * @param pattern - glob pattern to all the rules files
 * @returns a promise containing a collection of rules + empty asset lists (name + path) indexed by their directory
 * @requires glob
 */
async function getRules(
    pattern: string
): Promise<Map<directoryType, { rulesStr: string, assets: Asset[] }>> {

    const allAssetsRulesPaths = await glob(pattern);

    return new Map(
        allAssetsRulesPaths.map(rulePath => {
            const directory = path.dirname(rulePath) as directoryType;
            const rulesStr = fs.readFileSync(rulePath, 'utf-8');

            return [directory, { rulesStr, assets: new Array<Asset>() }];
        })
    );
}


/**
 * Async function that creates a map of asset directories and relative rules paired with the assets contained in that directory
 * 
 * @param assetsRootDirectory - Root directory from where start fetching the assets
 * @param rulesFileName - Name (without extension) of the rules file name
 * @param assetsExtensions - An array of all fetchable assets extensions
 * @returns a promise containing a collection of rules + asset lists (name + path) indexed by their directory
 * @requires glob
 */
export async function getAssetsWithRules(
    assetsRootDirectory: string,
    rulesFileName: string,
    assetsExtensions: extType[]
): Promise<Map<directoryType, { rulesStr: string, assets: Asset[] }>> {

    const assetsGlob = path.join(assetsRootDirectory, '**', `*.{${assetsExtensions.join(',')}}`);
    const rulesGlob = path.join(assetsRootDirectory, '**', `${rulesFileName}.json`);

    const allAssetsPathsRaw = await glob(assetsGlob);
    const allAssetsRules = await getRules(rulesGlob);

    allAssetsPathsRaw.forEach(assetPath => {

        const item = new Asset(assetPath);
        const assetRuleObj = allAssetsRules.get(item.dir);

        if (!assetRuleObj)
            throw new Error(
                `There is no rule for images in directory: ${item.dir}`
            );

        assetRuleObj.assets.push(item);
    })

    return allAssetsRules;
}

export async function getAssetDirectories(
    assetsRootDirectory: string,
    rulesFileName: string,
    assetsExtensions: extType[],
    rulesetCategory: ruleCategory
) {
    const temp = await getAssetsWithRules(assetsRootDirectory, rulesFileName, assetsExtensions);
    const result: Directory[] = [];
    for (const [dir, obj] of temp.entries()) {
        result.push(new Directory(dir, obj.assets, obj.rulesStr, rulesetCategory));
    }
    return result;
}