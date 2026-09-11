import { DataBaseRegistry } from "../data-base.js";
import { Bundler, type BundlerProcess } from "./bundler.js";

const process: BundlerProcess<'LDOR'> = async function* () {
    const ldorDB = DataBaseRegistry.get('LDOR');
    await ldorDB.ready;
    for await (const record of ldorDB.streamFlatRecords()) {
        yield record;
    }
}

export const bundleLDOR = new Bundler('L', ['LDOR'], process);