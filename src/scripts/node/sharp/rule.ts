import z from "zod";
import type { directoryString, hashString } from "../../types/general-types.js";
import type { Asset } from "./asset.js";
import { stableHash } from "../writers/hash.js";
import type { ExportOutput } from "../../shared/assets-export-classes.js";
import type { Sharp } from "sharp";

type from1to10 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type zobject = z.ZodObject<{
    [x: string]: any;
}, z.z.core.$strip>;

type Constructor = new (...args: any[]) => Rule<object>;

export const ruleConstructorStaticShape = z.custom<RuleConstructor>(cstr =>
    typeof cstr === 'function' &&
    typeof (cstr as any).ownName === 'string' &&
    (cstr as any).schema instanceof z.ZodObject &&
    typeof (cstr as any).priority === 'number' &&
    (cstr as any).priority > 0 && (cstr as any).priority <= 10,
    { error: 'errrr' }
);
export interface RuleConstructor extends Constructor {
    readonly ownName: string;
    readonly schema: zobject;
    readonly priority: from1to10;
}
export abstract class Rule<T extends object = object> {
    /** Class name identifier; this is the key for the rule data object in a rule file. */
    public static readonly ownName: string;
    /** Zod schema of the rule data (the ones passed to the constructor). */
    public static readonly schema: zobject;
    /** Determines the order for rule enforcing. */
    public static readonly priority: from1to10 = 3;

    /** A unique per-instance hash generated from the rule's data. */
    public readonly hash: hashString;
    constructor(data: T) {
        this.hash = stableHash<T>(data);
    }
    abstract enforce(...args: any[]): any;
}
/**
 * Plain asset rules edit the sharp instance of a single asset
 * and return the edited instance correcting the asset 'out' properties.
 */
export abstract class AssetRule<T extends object> extends Rule<T> {
    abstract override enforce(asset: Asset, sharpAsset: Sharp): Sharp | Promise<Sharp>;
}
/**
 * Batch rules edit a group of assets in place;
 * 
 * the editing is only performed on a specific subset of assets and 
 * in a specific order correcting the asset 'out' properties.
 */
export abstract class BatchRule<T extends object> extends Rule<T> {
    abstract override enforce(assetsList: Asset[]): void;
}


/**
 * Export rules don't edit the original file but create a clone
 * or a modified copy to another directory and return the file metadata.
 * 
 * These rules cannot be enforced in group and they do not contribute
 * to a ruleset's hash signature.
 * 
 * The exported files from these rules are expected to be used in a temporary
 * folder or cleared after use.
 * 
 * The Asset instance will be left untouched.
 * 
 * @see {@link ExportOutput} for details on the base output of an export rule's enforce.
 */
export abstract class ExportRule<T extends object> extends Rule<T> {
    abstract override enforce(asset: Asset, dest: directoryString): ExportOutput | Promise<ExportOutput>;
}

