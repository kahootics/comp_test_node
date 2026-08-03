import fs from "node:fs";
import path from "node:path";
import z from "zod";
import type { directoryString, hashString } from "../../types/general-types.js";
import appConfig from "../../../config/app-config.mjs";
import { _stabilizePath, type $stable } from "../../../tools/companion-util.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { Log } from "../../../tools/console.js";

const LIB_PATH = appConfig.paths.assetsHashLibrary;

const HashSchema = z.string().regex(/^[0-9a-zA-Z]{8}$/);
const hashRecordSchema = z.record(
    HashSchema,
    z.array(HashSchema)
);
export type hashRecordType = { [key: hashString]: hashString[] };
const hashLibrarySchema = z.array(z.tuple([z.string(), hashRecordSchema]));
type assetsHashRecordsType = Map<directoryString /* & $stable */, hashRecordType>

/**
 * Singleton that automatically reads and stores a 
 * directory's assets' hashes from a ruleset enforcement
 * in a json file at a predetermined location.
 */
export class AssetsHashRecords {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();
    /** All the records available at the path. */
    readonly #records: assetsHashRecordsType;
    /** Own singleton instance. */
    static #instance: AssetsHashRecords | null = null;

    private constructor(token: symbol) {
        // Privacy of constructor
        if (token !== AssetsHashRecords.#constructionToken)
            throw new PrivateConstructorError("AssetsHashRecords");
        // Read records
        const libPath = path.resolve(LIB_PATH);

        let hashStr = "[]";
        if (fs.existsSync(libPath))
            hashStr = fs.readFileSync(libPath, 'utf-8')
        else {
            fs.mkdirSync(path.dirname(libPath), { recursive: true });
            fs.writeFileSync(libPath, hashStr);
        }

        const RecordsRaw = JSON.parse(hashStr);
        this.#records = new Map(hashLibrarySchema.parse(RecordsRaw)) as assetsHashRecordsType;
    }

    static get #self(): AssetsHashRecords {
        if (this.#instance) return this.#instance;
        return (this.#instance = new this(this.#constructionToken));
    }

    // PUBLIC =============================================================================
    /**
     * Releases the records data from memory.
     * @remarks
     * **All changes made to the records that have not been written will be lost**.
     */
    public static terminate() {
        this.#instance = null;
    }
    /**
     * Saves on disk the current state of the records.
     * @returns itself
     */
    public static write() {
        const RecordsRaw = Array.from(this.#self.#records);
        const hashStr = JSON.stringify(RecordsRaw);

        const libPath = path.resolve(LIB_PATH);

        fs.writeFileSync(libPath, hashStr);

        return this;
    }
    /**
     * Fetches a directory's assets' hashes of a ruleset.
     * @param directory - directory of the assets AND rule.
     * @param rulesetHash - ruleset's hash.
     * @returns an array of hashes belonging to the assets on which the rule has been enforced (may be empty)
     */
    public static getHashRecord(directory: directoryString, rulesetHash: hashString): hashString[] {
        const dir = _stabilizePath(directory);
        let records = this.#self.#records.get(dir);
        if (!records) {
            records = this.#self.#records
                .set(dir, { [rulesetHash]: [] })
                .get(dir)!;
        }
        if (!records[rulesetHash]) {
            records[rulesetHash] = [];
        }
        return Array.from(records[rulesetHash]);
    }
    /**
     * Overwrites a directory's assets' hashes of a ruleset.
     * @param directory - directory of the assets AND rule.
     * @param rulesetHash - ruleset's hash.
     * @param hashes - New hash list to overwrite the old one.
     * @returns itself
     */
    public static setHashRecord(directory: directoryString, rulesetHash: hashString, hashes: hashString[]) {
        const dir = _stabilizePath(directory);
        let records = this.#self.#records.get(dir);
        if (!records) {
            this.#self.#records
                .set(dir, { [rulesetHash]: hashes })
        } else {
            records[rulesetHash] = hashes;
        }
        return this;
    }
}

