import { toAbsolutePublicUrl, toPublicUrl } from "../../tools/companion-util.js";
import type { nameString } from "../types/general-types.js";


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
        this.src = toAbsolutePublicUrl(src);
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
        this.srcset[`${width}w`] = toAbsolutePublicUrl(assetPath);
        this.#srcsetPaths[`${width}w`] = assetPath;
    }
    public static from(output: AssetOutput) {
        const { name, width, height } = output;
        return new this(name, output.path, width, height);
    }
}

