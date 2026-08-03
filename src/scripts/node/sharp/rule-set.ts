import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import z, { json } from "zod";
import { Log } from "../../../tools/console.js";
import type { directoryString, hashString } from "../../types/general-types.js";
import { createHashFromBuffer, createHashFromFile } from "../writers/hash.js";
import type { Asset } from "./asset.js";
import { AssetsHashRecords } from "./assets-hash-records.js";
import { AssetRule, BatchRule, Rule, ExportRule, type RuleConstructor } from "./rule.js";
import { _stabilizePath } from "../../../tools/companion-util.js";
import { FileNotFoundError, NullPointerError } from "../../../errors/common-errors.mjs";
import { rulesetSchema, allRuleClassesMap } from "./rule-registry.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";

// Class =================================================================================
/**
 * Stores a set of rules of a certain category and allows to enforce 
 * all of them at once on a group of assets
 */
export class RuleSet {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    /** Cache register of rulesets associated with their paths. */
    static readonly #cache = new Map<string, RuleSet>();
    /** Sorts the rules by priority. */
    static readonly #sorter = (a: Rule, b: Rule) =>
        (a.constructor as RuleConstructor).priority - (b.constructor as RuleConstructor).priority;

    readonly #rules: AssetRule<any>[] = [];
    readonly #batchRules: BatchRule<any>[] = [];
    readonly #exportRule?: ExportRule<any>;
    readonly #directory: directoryString;
    /** Directory of the assets and rule files. */
    get directory() { return this.#directory; }
    readonly #hash: hashString;
    /** 
     * Ruleset's hash obtained from the sorted 
     * and joined hashes of all its internal rules. 
     */
    get hash() { return this.#hash; }
    readonly #localHashSet: Set<hashString>;

    // PRIVATE CONSTRUCTOR =====================================================
    private constructor(token: symbol, rulePath: string, directory: directoryString) {
        // Enforce privacy
        if (token !== RuleSet.#constructionToken)
            throw new PrivateConstructorError("RuleSet", { init: { method: 'build', type: 'factory' } });

        // The ruleset file must already exist
        if (!fs.existsSync(rulePath))
            throw new FileNotFoundError(rulePath, { name: 'ruleset', type: 'json' });

        this.#directory = _stabilizePath(directory) as directoryString;

        const rawRuleset = fs.readFileSync(rulePath, 'utf-8');
        const parsed = z.object(rulesetSchema).parse(JSON.parse(rawRuleset));

        // Rules sorting
        let exportRule: ExportRule<any> | undefined;
        Object.keys(parsed).forEach(className => {

            const ruleClass = allRuleClassesMap.get(className);
            if (!ruleClass) throw new Error(`Cannot find rule class "${className}"`);

            const rule = new ruleClass(parsed[className]);

            if (rule instanceof AssetRule) this.#rules.push(rule);
            else if (rule instanceof BatchRule) this.#batchRules.push(rule);
            else if (rule instanceof ExportRule)
                if (exportRule) throw new Error(
                    "A ruleset can only have one export rule\n"
                    + `directory at "${this.directory}" has more`
                );
                else exportRule = rule;
            else throw new Error(`Cannot recognize Rule instance of ${className}`);
        });
        this.#exportRule = exportRule;

        // Create hash for ruleset
        this.#rules.sort(RuleSet.#sorter);
        this.#batchRules.sort(RuleSet.#sorter);

        this.#hash = createHashFromBuffer(this.#buildRulesetHashString());

        // Load register of past operations
        this.#localHashSet = new Set(AssetsHashRecords.getHashRecord(this.directory, this.hash));

    }
    /**
     * Class factory method.
     * @param directory - Directory of the assets and rule files.
     * @param rulesetFileName - Name of the `json` file containing the rules at the given directory.
     * @returns an instance of `RuleSet`.
     */
    public static build(directory: directoryString, rulesetFileName: string): RuleSet {
        const rulePath = _stabilizePath(path.join(directory, rulesetFileName + '.json'));
        const cached = RuleSet.#cache.get(rulePath);
        if (cached) return cached;
        const ruleset = new RuleSet(RuleSet.#constructionToken, rulePath, directory);
        RuleSet.#cache.set(rulePath, ruleset);
        return ruleset;
    }

    // Private helpers ===============================
    /**
     * @returns the sorted and joined hashes of all its internal rules.
     */
    #buildRulesetHashString() {
        const rules = this.#rules.map(rule => rule.hash);
        const bRules = this.#batchRules.map(rule => rule.hash);
        return [...rules, ...bRules].sort().join("");
    }

    // Enforce helpers ====================================================
    /** Enforces all batch rules of directory */
    #enforceBatchRules(assetsList: Asset[]): void {
        this.#batchRules.forEach(batchRule => batchRule.enforce(assetsList));
    }
    async #enforceAssetRules(asset: Asset): Promise<{ asset: Asset; sharp: sharp.Sharp; }> {

        let sharpAsset = sharp(asset.path);

        for (const rule of this.#rules) {
            sharpAsset = await rule.enforce(asset, sharpAsset);
        }

        return { asset, sharp: sharpAsset };
    }

    // Permanence ======================================================
    /**
     * * Saves on disk an asset's `sharp` instance
     * * Updates the data structure to reflect the asset's state
     * * Removes old instance of the file unless it was moved to a different directory
     * @param sharpAssetObj - contains an asset's data structure and corresponding `sharp` instance.
     * @returns the path where the file was written
     */
    async #assetToFile(sharpAssetObj: { asset: Asset; sharp: sharp.Sharp; }) {

        const { asset, sharp } = sharpAssetObj;
        const outPath = path.resolve(asset.outPath);
        fs.mkdirSync(path.resolve(asset.outDir), { recursive: true });

        const res = await sharp.toFile(outPath);

        // Delete old file (if it hasn't been overwritten already)
        // Won't delete file if it has been moved to new location
        if (path.resolve(asset.path) !== outPath && asset.dir === asset.outDir) {
            fs.unlinkSync(asset.path);
            Log.msg(`Removed asset at ${asset.path}`);
        }

        Log.file(outPath, res.size);
        asset.saveEdits();
        return outPath;
    }
    /**
     * * Saves on disk an asset's `sharp` instance
     * * Updates the data structure to reflect the asset's state
     * * Removes old instance of the file unless it was moved to a different directory
     * @param sharpAssestList - Contains a list of assets' data structures and their corresponding `sharp` instances.
     * @returns a promi
     */
    async #allAssetsToFile(sharpAssetsList: { asset: Asset; sharp: sharp.Sharp; }[]) {
        // FINAL STEPS TO REWRITE
        return Promise.all(sharpAssetsList.map(asset => this.#assetToFile(asset)));
    }

    // PUBLIC INTERFACE ==========================================================

    /**
     * Enforces the entire (non-export) ruleset 
     * on the provided assets.
     * @param assetsList - List of hashes to enforce the ruleset on.
     * @param [writeHashes] - (optional) Whether to save on disk (through the hashes records) the hashes of edited assets.
     */
    async enforce(assetsList: Asset[], writeHashes?: boolean) {

        // Exclude all assets that are already registered as conforming
        const nonConformingAssets = assetsList.filter(asset => {
            const innerHash = createHashFromFile(asset.path) as hashString;
            return !this.#localHashSet.has(innerHash);
        });

        if (!(nonConformingAssets.length > 0)) return;

        // Validate directories
        nonConformingAssets.forEach(asset => {
            if (asset.dir !== this.directory)
                throw new Error(`${asset.name} is at ${asset.dir} but should be at ${this.directory}`);
        });

        // Enforce Batch rules
        this.#enforceBatchRules(nonConformingAssets);

        // Enforce Single Asset Rules
        const sharpAssetsList = await Promise.all(
            nonConformingAssets.map(asset =>
                this.#enforceAssetRules(asset))
        );

        // Write assets
        const outPaths = await this.#allAssetsToFile(sharpAssetsList);

        // Add written files hashes to set
        outPaths.forEach(outPath => {
            const hash = createHashFromFile(outPath);
            this.#localHashSet.add(hash);
        });

        // Update register with the new conforming assets
        AssetsHashRecords
            .setHashRecord(this.directory, this.hash, Array.from(this.#localHashSet))
        if (writeHashes) AssetsHashRecords.write();
    }
    /**
     * Exports an asset to a given directory and enforces a rule on such asset;
     * the original asset is not edited in any way whatsoever and the
     * corresponding data structure will be left untouched.
     * @param asset - Asset to enforce the ruleset's ExportRule on.
     * @param dest - Directory where the asset should be exported to.
     * @returns an `ExportOutput` object, containing metadata on the exported asset.
     * @throws {Error} If the ruleset does not have an export rule.
     */
    async export(asset: Asset, dest: directoryString) {
        if (this.#exportRule) {
            // make a fresh copy of the asset
            const clone = asset.clone();
            clone.discardEdits();
            return this.#exportRule.enforce(clone, dest);
        } else throw new Error("No export rule is available for this ruleset")
    }
}

