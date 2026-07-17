import fs from "node:fs";
import path from "node:path";
import z from "zod";
import type { hashString } from "../../types/general-types.js";
import type { directoryType } from "./no.js";
import type { Rule } from "./Rule.js";

const LIB_PATH = "src/assets/hash-records-library.json";
const HashRecordPassword = Symbol('HashRecord');

const HashSchema = z.hash('md5').length(8);
const hashRecordSchema = z.record(
    HashSchema,
    z.array(HashSchema)
);
type hashRecordType = z.infer<typeof hashRecordSchema>;
const hashLibrarySchema = z.map(z.string(), hashRecordSchema);
type hashLibraryType = Map<directoryType, hashRecordType>

class HashRecord {
    public readonly path: string;
    private readonly schema = z.record(
        HashSchema,
        z.array(HashSchema)
    );
    private readonly record: Record<hashString, hashString[]>;

    private constructor(directory: directoryType, recordName: string) {

        this.path = path.resolve(path.join(directory, `${recordName}.json`));

        let hashStr = "{}";
        if (fs.existsSync(this.path))
            hashStr = fs.readFileSync(this.path, 'utf-8');

        const hashRecordRaw = JSON.parse(hashStr);
        const hashRecord = this.schema.parse(hashRecordRaw);
        // Record<ruleHash,assetsHashes[]>
        this.record = hashRecord as Record<hashString, hashString[]>;
    }

    public getHashesSet(rule: Rule): Set<hashString> | undefined {
        const res = this.record[rule.hash];
        if (res) return new Set(res);
    }

    private static readonly records: Map<directoryType, HashRecord>;

    public static of(directory: directoryType, recordName: string) {
        const maybeRecord = this.records.get(directory);
        if (maybeRecord) return maybeRecord;
        const record = new this(directory, recordName);
        this.records.set(directory, record);
        return record;
    }
}

export namespace HashRecordsLibrary {
    const libPath = path.resolve(LIB_PATH);

    let hashStr = "[[]]";
    if (fs.existsSync(libPath))
        hashStr = fs.readFileSync(libPath, 'utf-8');

    const hashRecordRaw = JSON.parse(hashStr);
}