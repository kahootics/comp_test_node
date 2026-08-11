import z from "zod"
import fs from 'node:fs/promises'
import * as ffs from 'node:fs'
import writeAsJsonAt from "./write-as-json-at.js"
import { createHashFromBuffer, stableHash } from "./hash.js";
import { Log } from "../../../tools/console.js";

const REGISTER_PATH = 'src/data/schemas/schemas-register.json';

export async function writeZodAsSchema(fileName: string, zod: z.ZodObject<{
    [x: string]: any;
}, z.z.core.$strip>
): Promise<string> {
    const path = `src/schemas/${fileName}-schema.json`;
    const schema = zod.extend({
        $schema: z.string().regex(/^(?:[a-zA-Z0-9_.-\/]).+schema\.json$/)
    }).toJSONSchema()

    if (ffs.existsSync(path)) {
        const curr = await fs.readFile(path, { encoding: 'utf-8' });
        const that = JSON.parse(curr);
        if (typeof that === 'object') {
            const thatOne = stableHash(that);
            const thisOne = stableHash(schema);
            if (thatOne === thisOne) {
                Log.msg(`Did not overwrite file at ${path} because no edits to the file were made`);
                return path};
        }
    }

    const res = writeAsJsonAt(schema, path);
    await registerNewSchema(path);
    return res;

}

async function registerNewSchema(src: string): Promise<string> {
    let register: string =
        ffs.existsSync(REGISTER_PATH)
            ? await fs.readFile(REGISTER_PATH, { encoding: 'utf-8' })
            : '[]';

    const reg = JSON.parse(register);
    if (!Array.isArray(reg))
        throw new Error()
    const act = new Set(reg);
    act.add(src);
    return writeAsJsonAt(Array.from(act), REGISTER_PATH);
}