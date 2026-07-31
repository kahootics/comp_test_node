import type { HashRouterEventInit, route, title } from "../../types/router-types.js";

export class HashRouterEvent extends HashChangeEvent implements HashRouterEventInit {
    public readonly reset?: boolean;
    public readonly route?: route;
    public readonly title?: title;
    constructor(type: string, eventInitDict?: HashRouterEventInit) {
        super(type, eventInitDict);
        this.reset = eventInitDict?.reset;
        this.route = eventInitDict?.route;
        this.title = eventInitDict?.title;
    }
}
