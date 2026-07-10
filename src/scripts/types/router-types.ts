import type { HashRouterEvent, HashRouterRequestEvent } from "../sync/ui/routing/hash-router.js";

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