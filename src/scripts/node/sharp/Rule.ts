import type sharp from "sharp";
import z from "zod";
import type { hashString } from "../../types/general-types.js";
import type { Asset } from "./asset.js";
import { hashFromRule } from "./ruleset.js";

type Constructor = new (...args: any[]) => Rule<{}>;
type zobject = z.ZodObject<{
    [x: string]: any;
}, z.z.core.$strip>;

export enum ruleCategory { LOCAL = 'local', EXPORT = 'export' }
type from1to10 = 1|2|3|4|5|6|7|8|9|10;
export interface RuleConstructor extends Constructor {
    readonly ownName: string;
    readonly schema: zobject;
    readonly priority: from1to10;
}
export abstract class Rule<T extends {} = {}> {
    public static readonly priority: from1to10 = 3;
    public readonly hash: hashString;
    abstract enforce(...args: any[]): any;
    constructor(data: T) {
        this.hash = hashFromRule(data);
    }
}
/**
 * Plain asset rules edit the sharp instance of a single asset
 * and return the edited instance correcting the asset 'out' properties
 */
export abstract class AssetRule<T extends {}> extends Rule<T> {
    abstract override enforce(asset: Asset, sharpAsset: sharp.Sharp): sharp.Sharp | Promise<sharp.Sharp>;
}
/**
 * Batch rules edit a group of assets in place;
 * 
 * the editing is only performed on a specific subset of assets and 
 * in a specific order correcting the asset 'out' properties
 */
export abstract class BatchRule<T extends {}> extends Rule<T> {
    abstract override enforce(assetsList: Asset[]): void;
}
/**
 * Export rules don't edit the original file but create a clone
 * or a modified copy to another directory and return the file data
 * 
 * These rules cannot be enforced in group and they do not contribute
 * to a ruleset's hash signature
 * 
 * The exported files from these rules are expected to be used in a temporary
 * folder or cleared after use.
 * 
 * The Asset instance will be left untouched
 */
export abstract class ExportRule<T extends {},E extends {}> extends Rule<T> {
    abstract override enforce(asset: Asset): E | Promise<E>;
}

export const allRuleClasses: Set<RuleConstructor> = new Set();
