import { IllegalArgumentError } from "../../../errors/common-errors.mjs";
import { DataBaseRegistry, type DataBase } from "../db/data-base.js";
import type { dbType } from "../db/data-base-types.js";
import type { FlatRecord } from "../db/records/flat-record.js";

export type BundlerProcess<
    T extends dbType, // output
    D extends dbType[]// dependencies
> = (...req: { [K in keyof D]: DataBase<D[K]> }) => AsyncGenerator<FlatRecord<T>>;

/**
 * Resolves connection and dependencies across two or more databases;
 * sets derived fields on the records in output.
 */
export class Bundler<
    T extends dbType = dbType,
    const D extends dbType[] = dbType[]
> {

    readonly #id: string;
    readonly #outputType: T;
    readonly #requires: D;
    readonly #process: BundlerProcess<T, D>;

    /** Identifier for each bundler. */
    get id() { return this.#id; }
    /** All the databases the bundler needs access to in order to complete its operations. */
    get requires(): readonly dbType[] { return this.#requires; }
    /** Type (same as one of the required databases) of the records bundled. */
    get outputType() { return this.#outputType; }

    /**
     * @param id - A unique 1 character string to identify the bundler with.
     * @param required - A list of databases needed to the bundler.
     * @param outputType - The type of datatabase whose records will be outputted.
     * @param process - An asynchronous generator function that produces records of the output type using the required ones.
     * 
     * @remarks
     * The order of the database types in the BundlerProcess must be respected!   
     * *Correct*:
     * ```ts
     * const process: BundlerProcess<'LDOR',['LDOR','TEST']> = async function* (ldorDB, testDB) {
     *      ... 
     * }
     * export const bundleLDOR = new Bundler('L', ['LDOR','TEST'], 'LDOR', process);
     * ```
     * *Throws TypeError*:
     * ```ts
     * const process: BundlerProcess<'LDOR',['LDOR','TEST']> = async function* (ldorDB, testDB) {
     *      ... 
     * }
     * export const bundleLDOR = new Bundler('L', ['TEST','LDOR'], 'LDOR', process);
     * ```
     */
    constructor(id: string, required: D, outputType: T, process: BundlerProcess<T, D>) {
        if (!required.includes(outputType))
            throw new IllegalArgumentError(
                `A bundler dependencies must include its output type: ${JSON.stringify(required)} does not include ${outputType}`);
        if (id.length !== 1)
            throw new IllegalArgumentError(`Cannot use ${id} as a bundler identifier; it must be 1 character long`);

        this.#id = id;
        this.#outputType = outputType;
        this.#requires = required;
        this.#process = process;
    }

    /**
     * Asynchronously generates records of the output type by running its internal process.
     * 
     * @remarks 
     * The first wait is going to be the longest due to the necessity
     * to load the necessary resources beforehand.
     */
    public async *run(): AsyncGenerator<FlatRecord<T>> {
        const dependencies = this.#requires.map(req => DataBaseRegistry.get(req));
        const ready = Promise.all(dependencies.map(d => d.ready));
        await ready;
        for await (const record of this.#process(...dependencies as { [K in keyof D]: DataBase<D[K]> })) {
            DataBaseRegistry.get(this.#outputType).assertValidDerived(record.derived);
            yield record;
        }
    }


}

