import type { bundleData, bundleID, RequestMessage, ResponseMessage, ResponseType, route, routeData } from "../../types/router-types.js";
import { Response, Request } from "./routes-data-enums.js";
declare const register: Map<bundleID, string>; // temp (will be static import)

const cache = new Map<bundleID, Promise<bundleData>>();

function _respond(bundleID: bundleID, type: ResponseType, payload: Map<route, routeData>, error?: any) {
    self.postMessage({ bundleID, type, payload, error } as ResponseMessage);
}

async function ensureBundle(bundleID: bundleID): Promise<bundleData> {
    if (!cache.has(bundleID)) {
        const url = register.get(bundleID);
        if (!url) throw new Error("Cannot find bundle with ID " + bundleID);

        cache.set(bundleID, (async () => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Bundle's fetch failed with status: ${res.status}`);
            return res.json();
        })());
    }
    return cache.get(bundleID)!;
}


function assertRouteData(data: routeData | undefined): routeData {
    if (!data) throw new Error("Missing route data");
    return data;
}
function extractBundleSubset(
    bundle: Map<route, routeData>,
    routes: route[]
): [route, routeData][] {
    if (routes.length < 1) throw new Error()
    return routes.map(route =>
        [route, assertRouteData(bundle.get(route))]);
}


self.onmessage = async (e: MessageEvent<RequestMessage>) => {
    const { type, bundleID, routes } = e.data;
    try {
        const bundle = new Map(await ensureBundle(bundleID));
        switch (type) {
            case Request.PREFETCH:
                // the fetching has already started
                break;

            case Request.GET:
                const subset = new Map(extractBundleSubset(bundle, routes))
                _respond(bundleID, Response.PARTIAL, subset);
                break;

            case Request.FULL:
                _respond(bundleID, Response.FULL, bundle);
                break;

            default:
                break;
        }
    } catch (e) {
        _respond(bundleID, Response.ERROR, new Map(), e);
    }
};