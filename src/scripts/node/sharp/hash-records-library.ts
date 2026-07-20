import fs from "node:fs";
import path from "node:path";
import z from "zod";
import type { hashString } from "../../types/general-types.js";
import type { directoryType } from "./no.js";

const LIB_PATH = "src/data/assets-hash-records-library.json"; // move to config
const passwordRecords = Symbol("AssetsHashRecords");

const HashSchema = z.hash('md5').length(8);
const hashRecordSchema = z.record(
    HashSchema,
    z.array(HashSchema)
);
export type hashRecordType = { [key: hashString]: hashString[] };
const hashLibrarySchema = z.array(z.tuple([z.string(), hashRecordSchema]));
type assetsHashRecordsType = Map<directoryType, hashRecordType>

let _instance: AssetsHashRecords;

export class AssetsHashRecords {
    readonly #records: assetsHashRecordsType;
    private constructor(password: symbol) {
        if (password !== passwordRecords)
            throw new Error("Cannot use class constructor; use static method `open` to initialize singleton")

        const libPath = path.resolve(LIB_PATH);

        let hashStr = "[[,{}]]";
        if (fs.existsSync(libPath))
            hashStr = fs.readFileSync(libPath, 'utf-8')
        else {
            fs.mkdirSync(path.dirname(libPath));
            fs.writeFileSync(libPath,hashStr);
        }

        const RecordsRaw = JSON.parse(hashStr);
        this.#records = new Map(hashLibrarySchema.parse(RecordsRaw)) as assetsHashRecordsType;
        _instance = this;
    }

    public static get instance() {
        return _instance;
    }

    public static open(): AssetsHashRecords {
        if (this.instance) return this.instance;
        return new AssetsHashRecords(passwordRecords);
    }

    public write(): AssetsHashRecords {
        const RecordsRaw = Array.from(this.#records);
        const hashStr = JSON.stringify(RecordsRaw);

        const libPath = path.resolve(LIB_PATH);

        fs.writeFileSync(libPath, hashStr);

        return this;
    }
    public getHashRecord(directory: directoryType, ruleHash: hashString): hashString[] {
        let records = this.#records.get(directory);
        if (!records) {
            records = this.#records
                .set(directory, { [ruleHash]: [] })
                .get(directory)!;
        }
        if (!records[ruleHash]) {
            records[ruleHash] = [];
        }
        return Array.from(records[ruleHash]);
    }
    public setHashRecord(directory: directoryType, ruleHash: hashString, hashes: hashString[]) {
        let records = this.#records.get(directory);
        if (!records) {
            this.#records
                .set(directory, { [ruleHash]: hashes })
        } else {
            records[ruleHash] = hashes;
        }
        return this;
    }
}

