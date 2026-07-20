import type { nameType, extType, directoryType } from "./no.js";
import path from "path";

export class Asset {
    public readonly fullName: nameType;
    public readonly name: nameType;
    public _outName: nameType;
    public readonly dir: directoryType;
    public _outDir: directoryType;
    public readonly ext: extType;
    public _outExt: extType;
    public readonly path: string;
    public _outPath: string

    constructor(
        assetPath: string,
        outPath?: string
    ) {
        this.path = assetPath;
        this.dir = path.dirname(assetPath) as directoryType;
        this.ext = path.extname(assetPath).replace('.','') as extType; // .{jpg,png...}
        this.fullName = path.basename(assetPath, this.ext) as nameType;
        this.name = this.fullName.split('.')[0] as nameType;
        if (outPath) {
            this._outPath = outPath;
            this._outDir = path.dirname(outPath) as directoryType;
            this._outExt = path.extname(outPath).replace('.','') as extType; // .{jpg,png...}
            this._outName = path.basename(outPath, this._outExt) as nameType;
        } else {
            this._outName = this.fullName;
            this._outExt = this.ext;
            this._outDir = this.dir;
            this._outPath = this.path
        }
    }

    public get outName(): nameType {
        return this._outName;
    }
    public get outExt(): extType {
        return this._outExt;
    }
    public get outDir(): directoryType {
        return this._outDir;
    }
    public get outPath(): string {
        return path.join(this.outDir, this.outName + '.' + this.outExt);
    }
    public set outName(name: nameType) {
        this._outName = name;
    }
    public set outExt(ext: extType) {
        this._outExt = ext;
    }
    public set outDir(dir: directoryType) {
        this._outDir = dir;
    }
}
