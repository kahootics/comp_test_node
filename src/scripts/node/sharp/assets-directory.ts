import path from "path";
import { Asset } from "./asset.js";
import { glob } from "glob";
import { RuleSet } from "./rule-set.js";
import type { extType, directoryString, nameString } from "../../types/general-types.js";
import { IllegalArgumentError, NotFoundError, ValidationError } from "../../../errors/common-errors.mjs";
import { duplicatesOfStringList, formatList } from "../../../tools/string-parsers.js";
import fs from "node:fs";
import { AssetsHashRecords } from "./assets-hash-records.js";
import { _stabilizePath, type $stable } from "./rule.js";
import type { ExportOutput } from "../../shared/assets-export-classes.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";


// PRIVATE HELPERS =======================================================
function _batchExport(assetsList: Asset[], ruleset: RuleSet, dest: directoryString) {
    return Promise.all(assetsList.map(asset => _singleExport(asset, ruleset, dest)))
}
function _singleExport(asset: Asset, ruleset: RuleSet, dest: directoryString) {
    return ruleset.export(asset, dest);
}
function _validateDirectory(dir: string): asserts dir is directoryString {
    if (path.extname(dir) !== '')
        throw new IllegalArgumentError(`${dir} is not a directory`);
    if (!fs.existsSync(dir))
        throw new IllegalArgumentError(`${dir} does not exist`);
}
function _validateAssets(dir: directoryString, assetsList: Asset[]) {
    const absents = assetsList.filter(asset => asset.dir !== dir);
    if (absents.length > 0)
        throw new ValidationError(`${formatList(absents.map(a => a.name))} do not belong to ${dir}`);
    const dupes = duplicatesOfStringList(assetsList.map(asset => asset.name));
    if (dupes.size > 0)
        throw new ValidationError(
            formatList([...dupes]) +
            " have duplicate names;\n" +
            "There can be only one asset per name in the directory " +
            dir
        );
}

/**
 * Interface for a directory containing assets.
 */
export class AssetsDirectory {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    readonly #path: directoryString /* & $stable */;
    /** Directory's own path. */
    get path() { return this.#path; }
    readonly #assets: Asset[];

    private constructor(token: symbol, directoryPath: string, assets: Asset[]) {
        // Privacy of constructor
        if (token !== AssetsDirectory.#constructionToken)
            throw new PrivateConstructorError("AssetsDirectory", { init: { method: 'build', type: 'factory' } });

        _validateDirectory(directoryPath);
        this.#path = _stabilizePath(directoryPath);
        _validateAssets(this.path, assets);
        this.#assets = assets;
    }

    /**
     * @param asset - Either an `Asset` instance or an asset's name.
     * @returns a boolean indicating whether an asset exists in the directory or not.
     */
    has(asset: Asset | string): boolean {
        if (typeof asset === 'string')
            return this.#assets.some(ownAsset => ownAsset.name === asset);
        return this.#assets.some(ownAsset => ownAsset.equals(asset));
    }
    /**
     * @param assetName - The name of the asset to search
     * @returns the asset with the given name. If no element is found, undefined is returned. 
     */
    get(assetName: string): Asset | undefined {
        return this.#assets.find(ownAsset => ownAsset.name === assetName as nameString);
    }
    /**
     * @returns an array of all the names of the assets in the directory.
     */
    getAllNames() {
        return this.#assets.map(asset => asset.name);
    }
    /**
     * 
     * @param rulesetFileName - Name (without extension) of the ruleset file.
     * @returns the requested RuleSet as an object.
     * @throws {FileNotFoundError} If there is no rule file in the directory with that name.
     */
    #getRuleset(rulesetFileName: string): RuleSet {
        return RuleSet.build(this.path, rulesetFileName);
    }

    /**
     * Async function that creates an array of asset directories.
     * 
     * @param assetsRootDirectory - Root directory from where start fetching the assets.
     * @param assetsExtensions - An array of all fetchable assets' extensions.
     * @returns a promise containing a collection of directories with their assets.
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
            ([dir, assetsList]) =>
                new AssetsDirectory(AssetsDirectory.#constructionToken, dir, assetsList)
        );
    }

    /**
     * Async function that creates an array of asset directories.
     * 
     * @param assetsDirectory - Directory from where start fetching the assets.
     * @param assetsExtensions - An array of all fetchable assets' extensions.
     * @returns a promise containing the asset directory object.
     * @requires glob
     */
    static async build(
        assetsDirectory: string,
        assetsExtensions: extType[]
    ): Promise<AssetsDirectory> {
        const assetsGlob = path.join(assetsDirectory, `*.{${assetsExtensions.join(',')}}`);
        const allAssetsPathsRaw = await glob(assetsGlob);

        const assets = allAssetsPathsRaw.map(assetPath => new Asset(assetPath));
        return new AssetsDirectory(AssetsDirectory.#constructionToken, assetsDirectory, assets);
    }

    /**
     * Enforces a specified ruleset on all the assets of the directory.
     * 
     * @param rulesetFileName - Name (without extension) of the ruleset file.
     * @returns a promise containing the array of `Asset` finalized.
     */
    async enforceLocalRuleset(rulesetFileName: string): Promise<Asset[]> {
        const ruleset = this.#getRuleset(rulesetFileName);
        await ruleset.enforce(this.#assets);
        AssetsHashRecords.write();
        return this.#assets;
    }

    /**
     * Exports an asset from the directory to 
     * a given destination following the rules estabilished 
     * in the file with the specified name.
     * 
     * @param assetName - Name of the asset to export.
     * @param rulesetFileName - Name of the file in the directory containing the rules for exporting.
     * @param dest - Directory where the asset should be exported to.
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     * @throws {NotFoundError} If there is no asset with the specified name in the directory.
     */
    async exportAssetTo(
        assetName: string,
        rulesetFileName: string,
        dest: directoryString
    ): Promise<ExportOutput> {
        if (!this.has(assetName)) throw new NotFoundError(assetName, { type: 'asset' });
        const ruleset = this.#getRuleset(rulesetFileName);

        return _singleExport(this.get(assetName)!, ruleset, dest);
    }
    /**
     * Exports a list of assets from the directory to 
     * a given destination following the rules estabilished 
     * in the file with the specified name.
     * 
     * @param assetsNamesList - List of names of the assets to export.
     * @param rulesetFileName - Name of the file in the directory containing the rules for exporting.
     * @param dest - Directory where all the asset should be exported to.
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     */
    async exportAssetsListTo(
        assetsNamesList: string[],
        rulesetFileName: string,
        dest: directoryString
    ): Promise<ExportOutput[]> {
        const assets = assetsNamesList.map(asset => this.get(asset));
        if (assets.every(asset => asset instanceof Asset)) {
            const ruleset = this.#getRuleset(rulesetFileName);

            return _batchExport(assets, ruleset, dest);
        }
        throw new NotFoundError(assetsNamesList, { type: 'assets' });
    }
    /**
     * Exports the entire directory to 
     * a given destination following the rules estabilished 
     * in the file with the specified name.
     * 
     * @param rulesetFileName - Name of the file in the directory containing the rules for exporting.
     * @param dest - Directory where all the asset should be exported to.
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     */
    async exportDirectoryTo(rulesetFileName: string, dest: directoryString): Promise<ExportOutput[]> {
        const ruleset = this.#getRuleset(rulesetFileName);
        return _batchExport(this.#assets, ruleset, dest);
    }
}