import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import z from "zod";
import { Log } from "../../../tools/console.js";
import type { directoryString, hashString } from "../../types/general-types.js";
import { createHashFromBuffer, createHashFromFile } from "../writers/hash.js";
import type { Asset } from "./asset.js";
import { AssetsHashRecords } from "./assets-hash-records.js";
import { AssetRule, BatchRule, ruleCategory, allRuleClasses, type RuleConstructor, Rule, ExportRule } from "./rule.js";
import { NullPointerError } from "../../../errors/common-errors.js";

// Helpers
function stableStringify(obj: {}) {
    return JSON.stringify(obj, Object.keys(obj).sort());
}
export function hashFromRule(rule: {}) {
    const buffer = stableStringify(rule);
    return createHashFromBuffer(buffer) as hashString;
}
// Class =================================================================================
/**
 * Stores a set of rules of a certain category and allows to enforce 
 * all of them at once on a group of assets
 */
export class RuleSet {
    readonly #rules: AssetRule<any>[] = [];
    readonly #batchRules: BatchRule<any>[] = [];
    readonly #exportRule?: ExportRule<any,any>;
    readonly directory: directoryString;
    readonly hash: hashString;
    readonly #localHashSet: Set<hashString>;

    /**
     * @param directory - Directory of the assets and rule file.
     * @param rulesetFileName - Name of the `json` file containing the rules in question.
     * @param ruleCategory - Category of the rules to use from the file.
     */
    constructor(directory: directoryString, rulesetFileName: string) {
        const rulePath = path.join(directory, rulesetFileName + '.json');
        if (!fs.existsSync(rulePath))
            throw new NullPointerError("No ruleset exist at " + rulePath);

        this.directory = directory;

        const availableRules = new Map([...allRuleClasses]
            .sort((a, b) => a.priority - b.priority)
            .map(ruleClass => [ruleClass.ownName, ruleClass]));

        const innerParser: { [className: string]: any; } = {};
        availableRules.forEach(ruleClass => {
            innerParser[ruleClass.ownName] = ruleClass.schema.optional();
        });

        const rawRuleset = fs.readFileSync(rulePath, 'utf-8');
        const parsed = z.object(innerParser).parse(JSON.parse(rawRuleset));

        let exportRule: ExportRule<any,any> | undefined;
        Object.keys(parsed).forEach(className => {

            const ruleClass = availableRules.get(className);
            if (!ruleClass) throw new Error();

            const rule = new ruleClass(parsed[className]);

            if (rule instanceof AssetRule) this.#rules.push(rule);
            else if (rule instanceof BatchRule) this.#batchRules.push(rule);
            else if (rule instanceof ExportRule) 
                if(exportRule) throw new Error(
                    "A ruleset can only have one export rule\n"
                    + `directory at ${this.directory} has more`
                );
                else exportRule = rule;
            else throw new Error("Cannot recognize Rule instance");
        });
        this.#exportRule = exportRule;

        const sorter = (a: Rule, b: Rule) => (a.constructor as RuleConstructor).priority - (b.constructor as RuleConstructor).priority;
        this.#rules.sort(sorter);
        this.#batchRules.sort(sorter);

        this.hash = createHashFromBuffer(this.#buildRulesetHashString());

        this.#localHashSet = new Set(AssetsHashRecords.open().getHashRecord(this.directory, this.hash));

    }

    /**
     * @returns the sorted and joined hashes of all its internal rules
     */
    #buildRulesetHashString() {
        const rules = this.#rules.map(rule => rule.hash);
        const bRules = this.#batchRules.map(rule => rule.hash);
        return [...rules, ...bRules].sort().join("");
    }
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

    async #writeAsset(sharpAssetObj: { asset: Asset; sharp: sharp.Sharp; }) {

        const { asset, sharp } = sharpAssetObj;
        const outPath = path.resolve(asset.outPath);

        const res = await sharp.toFile(outPath);

        // Delete old file (if it hasn't been overwritten)
        // Won't delete file if it has been moved to new location
        if (asset.path !== outPath && asset.dir === asset.outDir) {
            fs.unlinkSync(asset.path);
            Log.msg(`Removed asset at ${asset.path}`);
        }

        Log.file(outPath, res.size);
        return outPath;
    }
    #writeAllAssets(sharpAssetsList: { asset: Asset; sharp: sharp.Sharp; }[]) {

        // FINAL STEPS TO REWRITE
        return sharpAssetsList.map(asset => this.#writeAsset(asset));
    }

    async enforce(assetsList: Asset[]) {

        // Exclude all assets that are already registered as conforming
        const nonConformingAssets = assetsList.filter(asset => {
            const innerHash = createHashFromFile(asset.path) as hashString;
            return !this.#localHashSet.has(innerHash);
        });

        // Validate directories
        nonConformingAssets.forEach(asset => {
            if (asset.dir !== this.directory)
                throw new Error();
        });

        // Enforce Batch rules
        this.#enforceBatchRules(nonConformingAssets);

        // Enforce Single Asset Rules
        const sharpAssetsList = await Promise.all(nonConformingAssets.map(asset => this.#enforceAssetRules(asset)));

        // Write assets
        const outPaths = await Promise.all(this.#writeAllAssets(sharpAssetsList));

        // Add written files hashes to set
        outPaths.forEach(outPath => {
            const hash = createHashFromFile(outPath);
            this.#localHashSet.add(hash);
        });

        // Update register with the new conforming assets
        AssetsHashRecords.open()
            .setHashRecord(this.directory, this.hash, Array.from(this.#localHashSet))
            .write();
    }
}
