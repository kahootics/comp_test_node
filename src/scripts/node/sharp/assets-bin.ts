import path from "node:path";
import appConfig from "../../../config/app-config.mjs";
import fs from 'node:fs'
import z from "zod";
import { Log } from "../../../tools/console.js";
import { IllegalArgumentError } from "../../../errors/common-errors.mjs";

const BIN_PATH = appConfig.paths.assetsToDelete;

class AssetsBins {
    readonly #toDelete: Set<string>;

    constructor() {
        let binList = "[]";
        if (fs.existsSync(BIN_PATH))
            binList = fs.readFileSync(BIN_PATH, 'utf-8')
        else {
            fs.mkdirSync(path.dirname(BIN_PATH), { recursive: true });
            fs.writeFileSync(BIN_PATH, binList);
        }

        const BinRaw = JSON.parse(binList);
        const BinValid = z.array(z.string()).parse(BinRaw);
        this.#toDelete = new Set(BinValid);

    }
    add(asset: string) {
        if (!fs.existsSync(asset)) {
            throw new IllegalArgumentError("Cannot delete asset that doesn't exist\nNo asset at " + asset);
        }
        if (this.#toDelete.has(asset)) return false;
        this.#toDelete.add(asset);
        return true;
    }
    remove(asset: string) {
        return this.#toDelete.delete(asset)
    }

    empty() {
        this.#toDelete.forEach(deadPath => {
            try {
                fs.unlinkSync(deadPath);
                Log.msg(`Removed asset at ${deadPath}`);
                this.#toDelete.delete(deadPath);
            } catch (e) {
                Log.wrn(`Failed to remove asset at ${deadPath}`);
            }
        })
        fs.writeFileSync(BIN_PATH, JSON.stringify(Array.from(this.#toDelete)));
        return !(this.#toDelete.size > 0);
    }

}

export interface AssetBin {
    add(path: string): boolean;
    remove(path: string): boolean;
    empty(): boolean
}

export const AssetBin: AssetBin = new AssetsBins();