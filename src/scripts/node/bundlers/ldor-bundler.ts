import { Bundler, type BundlerProcess } from "./bundler.js";

const process: BundlerProcess<'LDOR',['LDOR']> = async function* (ldorDB) {
    for await (const record of ldorDB.streamFlatRecords()) {
        yield record;
    }
}

export const bundleLDOR = new Bundler('L', ['LDOR'], 'LDOR', process);