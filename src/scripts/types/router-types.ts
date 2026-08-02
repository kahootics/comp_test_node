import type { HashRouterRequestEvent } from "../sync/routing/hash-router-request-event.js";
import type { HashRouterEvent } from "../sync/routing/hash-router-event.js";
import type { Response } from "../sync/routing/routes-data-enums.js";
import type { Request } from "../sync/routing/routes-data-enums.js";
import type { Brand } from "./general-types.js";

export const hashRouterEvent: hashroutechange = "hashroutechange";
export type hashroutechange = "hashroutechange";
export const hashRouterRequestEvent: hashroutechangerequest = "hashroutechange:request";
export type hashroutechangerequest = "hashroutechange:request";

// Branded safety nets
export type route = Brand<string,'Route'>;
export type title = Brand<string,'Title'>;
export type hash = Brand<string,'Hash'>;
export type bundleID = Brand<string,'Bundle'>;

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
