import z from "zod"
import {readFile} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import writeAsJsonAt from "./write-as-json-at.js"
import { createHashFromBuffer, stableHash } from "./hash.js";
import { Log } from "../../../tools/console.js";
import { IllegalStateError } from "../../../errors/common-errors.mjs";

const REGISTER_PATH = 'src/data/schemas/schemas-register.json';
const SCHEMA_PATH = (fileName: string) => `src/data/schemas/${fileName}-schema.json`;

/**
 * Turns a zod schema to JSON schema and writes it in the data folder.
 * 
 * @remarks
 * The schema is hashed, therefore it will be not overwritten without changes.
 * 
 * @param fileName - Name of the file that will hold the schema.
 * @param zod - Zod schema to write as JSON-Schema.
 * @returns the path at which the file with the schema was written.
 */
export async function writeZodAsSchema(
    fileName: string,
    zod: z.ZodObject<{
        [x: string]: any;
    }>
): Promise<string> {
    const path = SCHEMA_PATH(fileName);
    const schema = zod.extend({
        $schema: z.string().regex(/^(?:[a-zA-Z0-9_.-\/]).+schema\.json$/)
    }).toJSONSchema()

    if (existsSync(path)) {
        const curr = await readFile(path, { encoding: 'utf-8' });
        const that = JSON.parse(curr);
        if (typeof that === 'object') {
            const thatOne = stableHash(that);
            const thisOne = stableHash(schema);
            if (thatOne === thisOne) {
                Log.msg(`Did not overwrite file at ${path} because no changes to the schema were made`);
                return path;
            }
        }
    }

    const res = await writeAsJsonAt(schema, path);
    //await registerNewSchema(path);
    return res;

}

async function registerNewSchema(src: string): Promise<string> {
    let register: string =
        existsSync(REGISTER_PATH)
            ? await readFile(REGISTER_PATH, { encoding: 'utf-8' })
            : '[]';

    const reg = JSON.parse(register);
    if (!Array.isArray(reg))
        throw new IllegalStateError('Schema register file must be an array');
    const act = new Set(reg);
    act.add(src);
    return writeAsJsonAt(Array.from(act), REGISTER_PATH);
}