import { glob } from "glob/raw";
import { pathToFileURL } from "node:url";
import { NotFoundError, IllegalStateError } from "../../../errors/common-errors.mjs";
import { Bundler } from "./bundler.js";
import path from "node:path/posix";

const bundlersGlob = path.join(path.dirname(import.meta.url), '**/*-bundler.{js,ts,mjs}');

class BundlersRegister {
    #bundlers: Map<string, Bundler> | null = null;
    #loading: Promise<Map<string, Bundler>> | null = null;

    /**
     * Retrieves a specific bundler for use.
     * 
     * @param bundlerID - Identifier character of the requested bundle (case-sensitive).
     * @returns the requested bundler instance (initialized or cached).
     * 
     * @throws {NotFoundError} If the requested bundler does not exist.
     */
    public async get(bundlerID: string): Promise<Bundler> {
        const bundlers = await this.#ensureBundlers();
        const requested = bundlers.get(bundlerID);
        if (!requested) throw new NotFoundError(bundlerID, { type: 'bundler' });
        return requested;
    }

    /**
     * @returns a list of the ids of all the existing bundlers.
     */
    public async getAllAvailableBundlerIds(): Promise<string[]> {
        return Array.from((await this.#ensureBundlers()).keys());
    }

    /**
     * Helper for `ensureBundlers`, does not check whether it's
     * been already called or not.
     * 
     * This function:
     * - Searches all the `-bundler` scripts in the project,
     * - executes the script and finds all the Bundler instances,
     * - verifies only 1 instance is exported per script and 
     * all have unique ids,
     * finally returns the map of bundlerId -> Bundler
     * 
     * @throws {NotFoundError} If no module that respects the bundler pattern is found.
     * @throws {IllegalStateError} If a module does not export exactly 1 bundler instance or if it does but has the same id of an already registered bundler.
     */
    async #loadBundlers(): Promise<Map<string, Bundler>> {
        // Bundlers search
        const bundlerPaths = await glob(bundlersGlob);
        if (bundlerPaths.length === 0)
            throw new NotFoundError(bundlersGlob, { type: 'file pattern per bundler' });

        // Modules resolution
        const modules = await Promise.all(
            bundlerPaths.map(path => import(pathToFileURL(path).href))
        );

        const result = new Map<string, Bundler>();
        // Find the exported bundler in each module
        modules.forEach((mod, i) => {
            const bundlerExports = Object.values(mod as Record<string, unknown>)
                .filter((v): v is Bundler => v instanceof Bundler);
            // Verify only 1 bundle per file is exported
            if (bundlerExports.length !== 1)
                throw new IllegalStateError(
                    `File '${bundlerPaths[i]}' must export exactly one instance of Bundler, found: ${bundlerExports.length}`
                );
            const bundler = bundlerExports[0]!;
            // Check against id duplicates
            if (result.has(bundler.id))
                throw new IllegalStateError(`Duplicate Bundler with id '${bundler.id}' (file: '${bundlerPaths[i]}')`);
            result.set(bundler.id, bundler);
        });
        return this.#bundlers = result;
    }

    /**
     * Ensures a promise of the map bundlerId -> Bundler instance.
     * 
     * @remarks
     * Avoids multiple requests being handled separatedly; only the
     * first starts the operations, all the following ones are 
     * given the same promise.
     * 
     */
    async #ensureBundlers(): Promise<Map<string, Bundler>> {
        if (this.#bundlers) return this.#bundlers;
        if (this.#loading) return this.#loading;
        this.#loading = this.#loadBundlers()
            .catch(err => {
                this.#loading = null; // trigger retry
                throw err;
            });
        return this.#loading;
    }
}

export const BundlersRegistry = new BundlersRegister();