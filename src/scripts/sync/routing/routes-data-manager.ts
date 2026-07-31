import { IllegalArgumentError, NullPointerError } from "../../../errors/common-errors.mjs";
import { type bundleID, type route, type routeData } from "../../types/router-types.js";
import { Request, Response } from "./routes-data-enums.js";
import type { RequestMessage, ResponseMessage } from "../../types/router-types.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";


function extractbundleID(route: route) {
    return route.charAt(0) as bundleID;
}
export class RoutesDataManager {
    readonly #pendingRequests = new Map<bundleID, { routeDataResolves: Map<route, { resolve: (value: routeData | PromiseLike<routeData>) => void, reject: (reason?: any) => void }[]>, timer: number }>();
    readonly #bundleCache = new Map<bundleID, Map<route, routeData>>();
    readonly #worker: Worker;
    readonly #THRESHOLD: number;

    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    static #instance: RoutesDataManager | null = null;
    static get #self() {
        if (this.#instance) return this.#instance;
        throw new NullPointerError("RoutesDataManager instance", { cause: "needs to be initialized first" });
    }

    private constructor(token: symbol, threshold: number, dataWorkerPath: string) {
        // Privacy of constructor
        if (token !== RoutesDataManager.#constructionToken)
            throw new PrivateConstructorError("RoutesDataManager");
        if (threshold % 1 !== 0)
            throw new IllegalArgumentError("Threshold must be an integer");
        this.#THRESHOLD = threshold;
        this.#worker = new Worker(dataWorkerPath, { type: 'module' });
        this.#worker.addEventListener('message', (e) => this.#onWorkerMessage(e));
    }
    // change to no init
    public static build(threshold: number, dataWorkerPath: string) {
        if (!this.#instance)
            this.#instance = new RoutesDataManager(
                RoutesDataManager.#constructionToken,
                threshold, dataWorkerPath
            );
        else throw new Error("Cannot initialize singleton twice");
        return this;
    }

    public static get(route: route): Promise<routeData> {
        return this.#self.#get(route);
    }

    #get(route: route): Promise<routeData> {
        const bundleID = extractbundleID(route);
        const bundleCache = this.#bundleCache;
        // Check if the data bundle is already in memory
        if (bundleCache.has(bundleID)) {
            return Promise.resolve(bundleCache.get(bundleID)!.get(route)!);
        }

        const pending = this.#pendingRequests;
        // Check if the data requested is from a bundle
        // already requested, but still pending; makes a prefetch
        // request for it in case it is not
        if (!pending.has(bundleID)) {
            pending.set(bundleID, { routeDataResolves: new Map(), timer: 0 });
            this.#worker.postMessage({ bundleID, type: Request.PREFETCH, routes: [] } as RequestMessage);
        }

        const entry = pending.get(bundleID)!;

        if (!entry.routeDataResolves.has(route)) {
            entry.routeDataResolves.set(route, []);
            clearTimeout(entry.timer);
            entry.timer = window.setTimeout(() => this.#flush(bundleID), 0);
        }

        const promise = new Promise<routeData>((resolve, reject) => {
            entry.routeDataResolves.get(route)!.push({ resolve, reject });
        });

        return promise;
    }

    #flush(bundleID: bundleID) {
        const entry = this.#pendingRequests.get(bundleID)!;
        const routesRequested = [...entry.routeDataResolves.keys()];

        if (routesRequested.length >= this.#THRESHOLD) {
            this.#worker.postMessage({ bundleID, type: Request.FULL, routes: [] } as RequestMessage);
        } else {
            this.#worker.postMessage({ bundleID, type: Request.GET, routes: routesRequested } as RequestMessage);
        }
    }

    #onWorkerMessage(e: MessageEvent<ResponseMessage>) {
        const { bundleID, type, payload, error } = e.data;
        const entry = this.#pendingRequests.get(bundleID);
        if (!entry) return;

        if (type === Response.ERROR) {
            for (const [, resolvers] of entry.routeDataResolves) {
                resolvers.forEach(({ reject }) =>
                    reject(error!));
            }
        }
        if (type === Response.FULL) this.#bundleCache.set(bundleID, payload);

        for (const [route, resolvers] of entry.routeDataResolves) {
            resolvers.forEach(({ resolve }) =>
                resolve(payload.get(route)!));
        }
        this.#pendingRequests.delete(bundleID);
    }

}