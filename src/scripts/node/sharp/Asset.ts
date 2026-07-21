import path from "path";
import type { nameString, directoryString, extType } from "../../types/general-types.js";

export class Asset {
    public readonly fullName: nameString;
    public readonly name: nameString;
    #outName: nameString;
    public readonly dir: directoryString;
    #outDir: directoryString;
    public readonly ext: extType;
    #outExt: extType;
    public readonly path: string;
    #outPath: string

    constructor(
        assetPath: string,
        outPath?: string
    ) {
        this.path = assetPath;
        this.dir = path.dirname(assetPath) as directoryString;
        this.ext = path.extname(assetPath).replace('.', '') as extType; // .{jpg,png...}
        this.fullName = path.basename(assetPath, this.ext) as nameString;
        this.name = this.fullName.split('.')[0] as nameString;
        if (outPath) {
            this.#outPath = outPath;
            this.#outDir = path.dirname(outPath) as directoryString;
            this.#outExt = path.extname(outPath).replace('.', '') as extType; // .{jpg,png...}
            this.#outName = path.basename(outPath, this.#outExt) as nameString;
        } else {
            this.#outPath = this.path
            this.#outDir = this.dir;
            this.#outExt = this.ext;
            this.#outName = this.fullName;
        }
    }

    public get outName(): nameString {
        return this.#outName;
    }
    public get outExt(): extType {
        return this.#outExt;
    }
    public get outDir(): directoryString {
        return this.#outDir;
    }
    public get outPath(): string {
        this.#outPath = path.join(this.outDir, this.outName + '.' + this.outExt);
        return this.#outPath;
    }
    public set outName(name: nameString) {
        this.#outName = name;
    }
    public set outExt(ext: extType) {
        this.#outExt = ext;
    }
    public set outDir(dir: directoryString) {
        this.#outDir = dir;
    }
    clone() {
        return new Asset(this.path, this.outPath);
    }
}
