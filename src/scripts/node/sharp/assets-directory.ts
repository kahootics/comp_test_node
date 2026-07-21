import path from "path";
import { Asset } from "./asset.js";
import { glob } from "glob";
import { RuleSet } from "./ruleset.js";
import type { extType, directoryString } from "../../types/general-types.js";


export class AssetsDirectory {
    readonly path: directoryString;
    readonly assets: Asset[];

    constructor(directoryPath: string, assets: Asset[]) {
        this.path = directoryPath as directoryString;
        this.assets = assets;
    }

    /**
     * Async function that creates an array of asset directories
     * 
     * @param assetsRootDirectory - Root directory from where start fetching the assets
     * @param assetsExtensions - An array of all fetchable assets extensions
     * @returns a promise containing a collection of directories with their assets
     * @requires glob
     */
    static async buildAll(
        assetsRootDirectory: string,
        assetsExtensions: extType[]
    ): Promise<AssetsDirectory[]> {
        const assetsGlob = path.join(assetsRootDirectory, '**', `*.{${assetsExtensions.join(',')}}`);
        const allAssetsPathsRaw = await glob(assetsGlob);

        const AssetsByDir: Map<directoryString, Asset[]> = new Map();

        allAssetsPathsRaw.forEach(assetPath => {

            const asset = new Asset(assetPath);
            const dest = AssetsByDir.get(asset.dir);
            if (!dest) AssetsByDir.set(asset.dir, [asset]);
            else dest.push(asset);

        });

        return Array.from(AssetsByDir).map(
            ([dir, assetList]) => new AssetsDirectory(dir, assetList)
        );
    }
    async enforceRuleset(rulesetFilename: string) {
        const ruleset = new RuleSet(this.path, rulesetFilename);
        await ruleset.enforce(this.assets);
        return this.assets;
    }
}
