import type sharp from "sharp";
import z from "zod";
import type { hashString } from "../../types/general-types.js";
import type { Asset } from "./Asset.js";
import { hashFromRule } from "./RuleSet.js";
import { NEVER, number } from "zod";

type Constructor = new (...args: any[]) => Rule<{}>;
type zobject = z.ZodObject<{
    [x: string]: any;
}, z.z.core.$strip>;

export enum ruleCategory { LOCAL = 'local', EXPORT = 'export' }
type from1to10 = 1|2|3|4|5|6|7|8|9|10;
interface RuleConstructor extends Constructor {
    readonly category: ruleCategory;
    readonly schema: zobject;
    readonly priority: from1to10;
}
export abstract class Rule<T extends {} = {}> {
    public static readonly priority: from1to10 = 1;
    public readonly hash: hashString;
    abstract enforce(...args: any[]): any;
    constructor(data: T) {
        this.hash = hashFromRule(data);
    }
}
export abstract class AssetRule<T extends {}> extends Rule<T> {
    abstract override enforce(asset: Asset, sharpAsset: sharp.Sharp): sharp.Sharp | Promise<sharp.Sharp>;
}
export abstract class BatchRule<T extends {}> extends Rule<T> {
    abstract override enforce(assetsList: Asset[]): void;
}

export const allRuleClasses: Set<RuleConstructor> = new Set();
