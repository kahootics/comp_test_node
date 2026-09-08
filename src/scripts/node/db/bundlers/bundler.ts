import { glob } from "glob";
import { pathToFileURL } from "node:url";
import { IllegalStateError, NotFoundError } from "../../../../errors/common-errors.mjs";
import { DataBase, type dbType } from "../data-base.js";
import type { FlatRecord } from "../views/flat-record.js";

type BundlerProcess = () => AsyncGenerator<FlatRecord>;

export class Bundler {
    static #bundlers: Map<string, Bundler> | null = null;
    static #loading: Promise<Map<string, Bundler>> | null = null;

    readonly #id: string;
    readonly #requires: dbType[];
    readonly #process: BundlerProcess;

    get id() { return this.#id; }
    get requires(): readonly dbType[] { return this.#requires; }

    constructor(id: string, required: dbType[], process: BundlerProcess) {
        this.#id = id;
        this.#requires = required;
        this.#process = process;
    }

    public async *run(): AsyncGenerator<FlatRecord> {
        // Initialize all required databases
        await Promise.all(this.#requires.map(t => { DataBase.get(t).ready }));
        
        for await (const record of this.#process()) {
            //DataBase.get(record.type).assertValidRecordData(record.data, record.editables);
            yield record;
        }
    }

    public static async get(bundlerID: string): Promise<Bundler> {
        const bundlers = await this.#ensureBundlers();
        const requested = bundlers.get(bundlerID);
        if (!requested) throw new NotFoundError(bundlerID, { type: 'bundler' });
        return requested;
    }

    public static async list(): Promise<string[]> {
        return Array.from((await this.#ensureBundlers()).keys());
    }

    static async #loadBundlers(): Promise<Map<string, Bundler>> {
        const bundlerPaths = await glob('**/*-bundler.{js,ts,mjs}');
        if (bundlerPaths.length === 0)
            throw new NotFoundError('**/*-bundler.{js,ts,mjs}', { type: 'file pattern per bundler' });

        const modules = await Promise.all(
            bundlerPaths.map(path => import(pathToFileURL(path).href))
        );

        const result = new Map<string, Bundler>();
        modules.forEach((mod, i) => {
            const bundlerExports = Object.values(mod as Record<string, unknown>)
                .filter((v): v is Bundler => v instanceof Bundler);
            if (bundlerExports.length !== 1)
                throw new IllegalStateError(
                    `Il file '${bundlerPaths[i]}' deve esportare esattamente un'istanza di Bundler, trovate: ${bundlerExports.length}`
                );
            const bundler = bundlerExports[0]!;
            if (result.has(bundler.id))
                throw new IllegalStateError(`Bundler duplicato con id '${bundler.id}' (file: '${bundlerPaths[i]}')`);
            result.set(bundler.id, bundler);
        });
        return this.#bundlers = result;
    }

    static async #ensureBundlers(): Promise<Map<string, Bundler>> {
        if (this.#bundlers) return this.#bundlers;
        if (this.#loading) return this.#loading;
        this.#loading = this.#loadBundlers().catch(err => {
            this.#loading = null; // trigger retry
            throw err;
        });
        return this.#loading;
    }
}