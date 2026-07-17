import type { nameType, extType } from "./no.js";


export class Asset {
    public readonly fullName: nameType;
    public readonly name: nameType;
    public _outName: nameType;
    public readonly ext: extType;
    public _outExt: extType;
    public readonly path: string;

    constructor(
        fullName: nameType,
        ext: extType,
        path: string,
        outName?: nameType,
        outExt?: extType
    ) {
        this.fullName = fullName;
        this.name = fullName.split('.')[0] as nameType;
        this._outName = outName ?? fullName;
        this.ext = ext;
        this._outExt = outExt ?? ext;
        this.path = path;
    }

    public get outName(): nameType {
        return this._outName;
    }
    public get outExt(): extType {
        return this._outExt;
    }
    public set outName(name: nameType) {
        this._outName = name;
    }
    public set outExt(ext: extType) {
        this._outExt = ext;
    }
}
