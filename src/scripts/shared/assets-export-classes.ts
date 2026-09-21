import { IllegalArgumentError, IllegalStateError } from "../../errors/common-errors.mjs";
import type { nameString } from "./general-types.js";

export function pathFromDist(path: string) {
    path = path.replaceAll(`\\`, '/');
    const res = path.split(/[\W]?(?:dist\/)/);
    if (res.length > 2)
        throw new IllegalArgumentError(`${path} contains dist in too many places, please use the resolved path`);

    if (res.length === 1) return res[0]!;
    if (res.length === 2) return res[1]!;


    // Defensive
    throw new IllegalStateError("'split' method cannot return undefined");
}

export interface ExportOutput {
    readonly name: nameString;
    readonly src: string;
    readonly width: number;
    readonly height: number;
}

export class AssetOutput implements ExportOutput {
    readonly #path: string;
    constructor(
        readonly name: nameString,
        readonly src: string,
        readonly width: number,
        readonly height: number
    ) {
        this.name = name;
        this.#path = src;
        this.src = pathFromDist(src);
        this.width = width;
        this.height = height;
    }
    get path() {
        return this.#path;
    }
}

export class SrcsetOutput extends AssetOutput {
    readonly #srcsetPaths: { [width_w: string]: string; } = {};
    readonly srcset: { [width_w: string]: string; } = {};
    add(width: number, assetPath: string) {
        this.srcset[`${width}w`] = pathFromDist(assetPath);
        this.#srcsetPaths[`${width}w`] = assetPath;
    }
    public static from(output: AssetOutput) {
        const { name, width, height } = output;
        return new this(name, output.path, width, height);
    }
}

