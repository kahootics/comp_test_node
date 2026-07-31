import path from "path";
import type { nameString, directoryString, extType } from "../../types/general-types.js";
import { IllegalArgumentError } from "../../../errors/common-errors.mjs";
import { parseQueryString } from "../../../tools/string-parsers.js";
import { _stabilizePath, type $stable } from "./tmp-rule.js";

/**
 * @param str - string to parse.
 * @returns an object containing the base path and a map ot the query parameters
 */
function _parseQueryParamsAt$(str: string): { base: string, params: Map<string, string> } {
    if (!str.includes('$')) return { base: str, params: new Map() };

    const t = str.split('$');

    if (t.length > 2)
        throw new IllegalArgumentError("Cannot have more than one '$' character in a query string");
    else if (!t[1] || t[1].trim() === '') return { base: t[0]!, params: new Map() };

    return { base: t[0]!, params: parseQueryString(t[1]) };
}

const nameGuard = /^\w[\w\-_~]*$/;
const dirGuard = /^[\w\-_~\\/]+$/;
const queryValid = /^\w[\w\-_.~]*$/;

/**
 * Abstract data structure representing an asset (as in image)
 * and its properties through its system path.
 * 
 * The path is safely normalized but not resolved.
 */
export class Asset {
    #name: nameString;
    #outName: nameString;

    #dir: directoryString & $stable;
    #outDir: directoryString & $stable;

    #ext: extType;
    #outExt: extType;

    #path: string & $stable;
    #outPath: string & $stable;
    #rebuildPath: boolean = false;

    readonly #queryParams: Map<string, string>;
    readonly #outQueryParams: Map<string, string>;

    constructor(
        assetPath: string,
    ) {

        this.#path = _stabilizePath(assetPath);
        this.#dir = _stabilizePath(path.dirname(this.#path) as directoryString);
        const extWithDot = path.extname(this.#path);
        this.#ext = extWithDot.replace('.', '') as extType;
        const fullName = path.basename(this.#path, extWithDot);
        const { base, params } = _parseQueryParamsAt$(fullName);
        this.#queryParams = params;
        this.#name = base as nameString;

        this.#outPath = this.#path
        this.#outDir = this.#dir;
        this.#outExt = this.#ext;
        this.#outName = this.#name;
        this.#outQueryParams = new Map();
        this.#queryParams.forEach((val, key) => this.#outQueryParams.set(key, val));

    }

    // Getters (initial state) =======================================================================

    /** Original name of the asset (before '$'). */
    public get name(): nameString { return this.#name; }
    /** Original directory where the asset is saved. */
    public get dir(): directoryString & $stable { return this.#dir; }
    /** Asset's original extension. */
    public get ext(): extType { return this.#ext; }
    /** Full path to the original asset file. */
    public get path() { return this.#path; }
    /**
     * @param key - Of the query parameter.
     * @returns the value associated with the `key` in the original path's query string or `undefined`.
     */
    getParam(key: string): string | undefined {
        return this.#queryParams.get(key);
    }
    /** Checks if there is a value for the given key in the original path's query string. */
    hasParam(key: string): boolean {
        return this.#queryParams.has(key);
    }

    // Getters (final state) =======================================================================

    /** Name with which the edited asset will be saved. */
    public get outName(): nameString {
        return this.#outName;
    }
    /** Directory where the edited asset will be saved. */
    public get outDir(): directoryString & $stable {
        return this.#outDir;
    }
    /** Extension with which the edited asset will be saved. */
    public get outExt(): extType {
        return this.#outExt;
    }
    /** Full path at which the edited asset will be saved. */
    public get outPath(): string & $stable {
        if (this.#rebuildPath) {
            const queryStr = this.#outQueryParams.size > 0
                ? '$' + [...this.#outQueryParams]
                    .map(([key, value]) => `${key}=${value}`)
                    .join('&')
                : '';
            this.#outPath = _stabilizePath(path.join(this.outDir, this.outName + queryStr + '.' + this.outExt));
        }
        return this.#outPath;
    }
    /**
     * @param key - Of the query parameter.
     * @returns the value associated with the `key` in the edited asset's path's query string or `undefined`.
     */
    getOutParam(key: string) {
        return this.#outQueryParams.get(key);
    }
    /** Checks if there is a value for the given key in the edited asset's path's query string. */
    hasOutParam(key: string) {
        return this.#outQueryParams.has(key);
    }

    // Setters =======================================================================

    /** Declares what the final asset will be named as. */
    public set outName(name: nameString) {
        if (!name.match(nameGuard))
            throw new IllegalArgumentError(name + " contains illegal characters");
        if (this.#outName !== name) {
            this.#rebuildPath = true;
            this.#outName = name;
        }
    }
    /** Declares in which directory the final asset will be (moved to eventually). */
    public set outDir(dir: directoryString) {
        const normalized = _stabilizePath(dir);
        if (path.extname(normalized) !== '')
            throw new IllegalArgumentError("A directory path cannot have an extension");
        if (!normalized.match(dirGuard))
            throw new IllegalArgumentError(normalized + " contains illegal characters");
        if (this.#outDir !== normalized) {
            this.#rebuildPath = true;
            this.#outDir = normalized;
        }
    }
    /** Declares what extension the final asset will have. */
    public set outExt(ext: extType) {
        if (this.#outExt !== ext) {
            this.#rebuildPath = true;
            this.#outExt = ext;
        }
    }
    /** 
     * Declares (as new or by overwriting an existing one) 
     * a query string `key`-`value` pair that will be
     * on the final asset.
     */
    setOutParam(key: string, value: string) {
        if (!key.match(queryValid))
            throw new IllegalArgumentError("Invalid characters in key");
        if (!value.match(queryValid))
            throw new IllegalArgumentError("Invalid characters in value");
        if (this.#outQueryParams.get(key) !== value) {
            this.#rebuildPath = true;
            this.#outQueryParams.set(key, value);
        }
    }

    // Methods =======================================================================

    /**
     * Lets the out params overwrite the original/precedent ones.   
     * This is the only way to alter the asset's original path.
     * @remarks
     * This method expects the asset to actually have been 
     * removed from its original position and have been
     * edited to have the out params.
     */
    public saveEdits() {
        this.#path = this.outPath;
        this.#dir = this.outDir;
        this.#ext = this.outExt;
        this.#name = this.outName;
        this.#queryParams.clear();
        this.#outQueryParams.forEach((val, key) => this.#queryParams.set(key, val));
    }
    /** Resets all the out params to be the same as the initial ones. */
    public discardEdits() {
        this.#outPath = this.#path
        this.#outDir = this.#dir;
        this.#outExt = this.#ext;
        this.#outName = this.#name;
        this.#outQueryParams.clear();
        this.#queryParams.forEach((val, key) => this.#outQueryParams.set(key, val));
    }
    /**
     * @returns an exact copy of the instance that called the method
     */
    public clone(): Asset {
        const result = new Asset(this.path);
        result.#outPath = this.outPath;
        result.#outDir = this.outDir;
        result.#outExt = this.outExt;
        result.#outName = this.outName;
        result.#outQueryParams.clear();
        this.#outQueryParams.forEach((val, key) => result.#outQueryParams.set(key, val));
        return result;
    }
    /**
     * Compares the paths (initial and final) of thwo assets
     */
    public equals(that: Asset): boolean {
        return this.path === that.path && this.outPath === that.outPath;
    }
}
