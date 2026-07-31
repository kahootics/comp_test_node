import type sharp from "sharp";
import type { directoryString } from "../../types/general-types.js";
import { AssetsDirectory } from "./assets-directory.js";
import type { Asset } from "./tmp-asset.js";
import type { ExportOutput } from "../../shared/assets-export-classes.js";
import { DirectoryNotFoundError, NotFoundError, ValidationError } from "../../../errors/common-errors.mjs";
import { PrivateConstructorError, SingletonDuplicateError, SingletonNotInitializedError } from "../../../errors/specialized-errors.mjs";
import { duplicatesOfStringList, formatList } from "../../../tools/string-parsers.js";
import fs from "node:fs";
import { _stabilizePath, type $stable } from "./tmp-rule.js";

// PRIVATE HELPERS ====================================================================

/**
 * Validator function that extracts all the names 
 * of the assets within the directories and verifies
 * there is no duplicate.
 * 
 * @param dirs - Asset Directories to validate the names of.
 * @throws {ValidationError} If there are duplicate names and logs them all in the error message.
 */
function _validateLibraryUniqueNames(dirs: AssetsDirectory[]) {
    const dupes = duplicatesOfStringList(dirs.flatMap(dir => dir.getAllNames()));
    if (dupes.size > 0)
        throw new ValidationError(
            formatList([...dupes]) +
            " have duplicate names;\n" +
            "There can be only one asset per name in the library"
        );
}

export class AssetsLibrary {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    static #instance?: AssetsLibrary;
    /** Singleton instance. */
    static get #self(): AssetsLibrary {
        if (!this.#instance)
            throw new SingletonNotInitializedError("AssetsLibrary", { init: { method: 'build' } })
        return this.#instance
    };
    readonly #directories: Map<directoryString & $stable, AssetsDirectory>;
    /** Associates the directory paths to the corresponding `AssetDirectory` object. */
    static get #library(): Map<directoryString & $stable, AssetsDirectory> {
        return this.#self.#directories;
    };
    /** @returns an iterator of all the `AssetDirectory` objects in the library. */
    static get #directoriesList() { return this.#library.values(); }

    // BUILD & DESTROY =================================

    private constructor(token: symbol, dirs: AssetsDirectory[]) {
        // Privacy of constructor
        if (token !== AssetsLibrary.#constructionToken)
            throw new PrivateConstructorError("AssetsLibrary", { init: { method: 'build', type: 'singleton' } });

        // Verify uniqueness of names
        _validateLibraryUniqueNames(dirs);

        // Fill the library
        this.#directories = new Map();
        dirs.forEach(aDir =>
            this.#directories.set(aDir.path, aDir)
        );
    }
    /**
     * Builder function to initialize the singleton.
     * 
     * Required before any other operation.
     * 
     * @param rootDir - Root directory of asset files.
     * @param assetsExt - Allowed asset extensions.
     * @returns itself.
     */
    public static async build(rootDir: string, assetsExt: (keyof sharp.FormatEnum)[]) {
        if (!this.#instance) {
            const dirs = await AssetsDirectory.buildAll(rootDir, assetsExt);
            this.#instance = new AssetsLibrary(AssetsLibrary.#constructionToken, dirs);
            return this;
        }
        else throw new SingletonDuplicateError("AssetsLibrary");
    }

    /**
     * Remove singleton from memory.
     * @returns a boolean indicating the result of the operation.
     */
    public static destroy(): boolean {
        return Boolean(this.#instance) && !(this.#instance = undefined);
    }

    // PRIVATE HELPERS ================================================

    static #assertGetAssetsDirectory(directory: directoryString): AssetsDirectory {
        const dir = _stabilizePath(directory)
        const target = this.#library.get(dir);
        if (!target) {
            if (fs.existsSync(dir))
                throw new DirectoryNotFoundError(directory);
            throw new NotFoundError(directory);
        }
        return target;
    }
    /**
     * @param assetName - Name of the asset to search for.
     * @returns the path of the directory containing the specifies asset.
     * @throws {NotFoundError} If the asset isn't in any directory of the library.
     */
    static #assertFindDir(assetName: string) {
        const dir = this.findDir(assetName);
        if (dir) return dir;
        throw new NotFoundError(assetName, { type: 'asset' });
    }
    /**
     * @param assetsNamesList - A list of asset names.
     * @returns a map that associates directories from the library 
     * to an array of asset names from the provided list,
     * with each name matching an existing asset within
     * that same directory.
     */
    static #groupByDir(assetsNamesList: string[]): Map<directoryString & $stable, string[]> {
        const res = new Map<directoryString & $stable, string[]>();
        assetsNamesList.forEach(assetName => {
            const dir = this.#assertFindDir(assetName);
            if (!res.has(dir)) res.set(dir, []);
            res.get(dir)!.push(assetName);
        });
        return res;
    }

    // PUBLIC ACCESSORS ====================================================

    /**
     * @param asset - Either name or `Asset` instance of the asset to search.
     * @returns a boolean indicating whether the specified asset is in the library.
     */
    public static has(asset: Asset | string): boolean {
        for (const dir of this.#directoriesList) {
            if (dir.has(asset)) return true;
        }
        return false;
    }
    /**
     * @param asset - Name of the asset to search.
     * @returns `Asset` instance of the asset with the specified name if found; `undefined` otherwise.
     */
    public static get(assetName: string): Asset | undefined {
        for (const dir of this.#directoriesList) {
            const maybe = dir.get(assetName);
            if (maybe) return maybe;
        }
    }
    /**
     * @param assetName - Name of the asset to search for.
     * @returns the path of the directory containing the specifies asset or `undefined`.
     */
    public static findDir(assetName: string) {
        for (const [name, dir] of this.#library) {
            if (dir.has(assetName)) return name;
        }
    }

    // RULES RELATED METHODS ======================================================

    /**
     * Enforces a specified ruleset on the assets of a given directory.
     * 
     * @param localRulesFilename - Name of the file in the directory containing the rules to enforce.
     * @param directory - Directory on whose assets the rule must be enforced on.
     * @returns a promise containing the array of `Asset` finalized.
     */
    public static async enforceLocalRulesAt(
        localRulesFilename: string,
        directory: directoryString
    ): Promise<Asset[]> {
        const target = this.#assertGetAssetsDirectory(directory);
        return target.enforceLocalRuleset(localRulesFilename);
    }
    /**
     * Enforces a specified ruleset on all the assets of the library.
     * 
     * @param localRulesFilename - Name of the file in each directory containing the rules to enforce.
     * @returns a promise containing the array of `Asset` finalized.
     */
    public static async enforceLocalRulesLibraryAt(
        localRulesFilename: string
    ): Promise<Asset[]> {
        const buffer: Asset[] = [];
        for (const dir of this.#directoriesList) {
            const part = await dir.enforceLocalRuleset(localRulesFilename);
            buffer.push(...part);
        }
        return buffer;
    }

    /**
     * Exports a single asset from the library to a given destination following the rules specified in each directory.
     * 
     * @param assetName - Name of the asset to export.
     * @param rulesetFileName - Name of the file in the directory containing the rules for exporting.
     * @param dest - Directory where the asset should be exported to.
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     */
    public static async exportAssetTo(
        assetName: string,
        rulesetFileName: string,
        dest: directoryString
    ): Promise<ExportOutput> {
        const dir = this.#assertFindDir(assetName);

        return this.#library.get(dir)!.exportAssetTo(assetName, rulesetFileName, dest);
    }
    /**
     * Exports an entire given directory of assets of the library to a given destination following the rules specified in each directory.
     * 
     * @param directory - Path to the directory of assets to export.
     * @param rulesetFileName - Name of the file in the directory containing the rules for exporting.
     * @param dest - Directory where the asset should be exported to.
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     */
    public static async exportDirectoryTo(
        directory: directoryString,
        rulesetFileName: string,
        dest: directoryString
    ): Promise<ExportOutput[]> {
        const target = this.#assertGetAssetsDirectory(directory);

        return target.exportDirectoryTo(rulesetFileName, dest);
    }
    /**
     * Exports a list of assets from the library to a given destination following the rules specified in each directory.
     * The assets don't need to be all in the same directory, but must belong to the library.
     * 
     * @param assetsNamesList - List of names of the assets to export (may be from different directories).
     * @param rulesetFileName - Name of the file in each directory containing the rules for exporting.
     * @param dest - Directory where all the asset should be exported to (will be exported flat).
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     */
    public static async exportAssetsListTo(
        assetsNamesList: string[],
        rulesetFileName: string,
        dest: directoryString
    ): Promise<Map<directoryString & $stable, ExportOutput[]>> {
        const groups = this.#groupByDir(assetsNamesList);
        const output = new Map<directoryString & $stable, ExportOutput[]>();
        for (const [dir, names] of groups.entries()) {
            const part = await this.#library.get(dir)!.exportAssetsListTo(names, rulesetFileName, dest);
            output.set(dir, part);
        }
        return output
    }
    /**
     * Exports the entire library to a given destination following the rules specified in each directory.
     * 
     * @param rulesetFileName - Name of the file in each directory containing the rules for exporting.
     * @param dest - Directory where all the asset should be exported to (will be exported flat).
     * @returns a promise containing the export output metadata, such as final path, name, width... 
     */
    public static async exportLibraryTo(
        rulesetFileName: string,
        dest: directoryString
    ): Promise<Map<directoryString & $stable, ExportOutput[]>> {
        const output = new Map<directoryString & $stable, ExportOutput[]>();
        for (const [dirName, dirObj] of this.#library.entries()) {
            const part = await dirObj.exportDirectoryTo(rulesetFileName, dest);
            output.set(dirName, part);
        }
        return output;
    }
}