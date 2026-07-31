import { toPublicUrl } from "../../tools/companion-util.js";
import type { nameString } from "../types/general-types.js";


export interface ExportOutput {
    readonly name: nameString;
    readonly src: string;
    readonly width: number;
    readonly height: number;
}

export class AssetOutput implements ExportOutput {
    constructor(
        readonly name: nameString,
        readonly src: string,
        readonly width: number,
        readonly height: number
    ) {
        this.name = name;
        this.src = toPublicUrl(src);
        this.width = width;
        this.height = height;
    }
}

export class SrcsetOutput extends AssetOutput {
    readonly srcset: { [width_w: string]: string; } = {};
    add(width: number, assetPath: string) {
        this.srcset[`${width}w`] = toPublicUrl(assetPath);
    }
    public static from(output: AssetOutput) {
        const { name, src, width, height } = output;
        return new this(name, src, width, height);
    }
}

