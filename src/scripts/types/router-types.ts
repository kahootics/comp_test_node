import type { HashRouterEvent, HashRouterRequestEvent } from "../sync/dom/router.js";

export const hashRouterEvent: hashroutechange = "hashroutechange";
export type hashroutechange = "hashroutechange";
export const hashRouterRequestEvent: hashroutechangerequest = "hashroutechange:request";
export type hashroutechangerequest = "hashroutechange:request";

export interface HashRouterRequest {
    newRoute: string,
    newTitle: string,
}

export interface HashRouterData {
    route: string,
    title: string
}

export interface HashRouterOptions {
    slashAfterHash?: boolean,
    hashPrefix?: string,
}

declare global {
    interface DocumentEventMap {
        [hashRouterEvent]: HashRouterEvent
        [hashRouterRequestEvent]: HashRouterRequestEvent
    }
}