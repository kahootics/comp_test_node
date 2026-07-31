import type { HashRouterRequestEvent } from "../sync/routing/hash-router-request-event.js";
import type { HashRouterEvent } from "../sync/routing/hash-router-event.js";
import type { Response } from "../sync/routing/routes-data-enums.js";
import type { Request } from "../sync/routing/routes-data-enums.js";

export const hashRouterEvent: hashroutechange = "hashroutechange";
export type hashroutechange = "hashroutechange";
export const hashRouterRequestEvent: hashroutechangerequest = "hashroutechange:request";
export type hashroutechangerequest = "hashroutechange:request";

// Branded safety nets
declare const RouteSymbol: unique symbol;
export type route = string & { [RouteSymbol]: void };
declare const TitleSymbol: unique symbol;
export type title = string & { [TitleSymbol]: void };
declare const HashSymbol: unique symbol;
export type hash = string & { [HashSymbol]: void };
declare const BundleSymbol: unique symbol;
export type bundleID = string & { [BundleSymbol]: void };

export type bundleData = [route, routeData][]

export declare interface routeData { }

export interface HashRouterOptions {
    slashAfterHash?: boolean,
    hashPrefix?: string,
}

export interface HashRouterEventInit extends HashChangeEventInit {
    reset?: boolean,
    route?: route,
    title?: title,
}

export interface HashRouterRequestEventInit extends EventInit {
    newRoute?: route,
    reset?: boolean,
    terminate?: boolean
}

declare global {
    interface DocumentEventMap {
        [hashRouterEvent]: HashRouterEvent
        [hashRouterRequestEvent]: HashRouterRequestEvent
    }
}

export type RequestType = (typeof Request)[keyof typeof Request]
export type ResponseType = (typeof Response)[keyof typeof Response];
export interface ResponseMessage {
    bundleID: bundleID;
    type: ResponseType;
    payload: Map<route, routeData>;
    error?: any;
}
export interface RequestMessage {
    bundleID: bundleID;
    type: RequestType;
    routes: route[];
}
