import type { HashRouterRequestEventInit, route } from "../../types/router-types.js";
import { HashRouter } from "./hash-router.js";



export class HashRouterRequestEvent extends Event implements HashRouterRequestEventInit {
    public readonly newRoute?: route;
    public readonly reset?: boolean;
    public readonly terminate?: boolean;
    constructor(type: string, eventInitDict?: HashRouterRequestEventInit) {
        super(type, eventInitDict);
        const newRoute = eventInitDict?.newRoute;
        if (newRoute) this.newRoute = HashRouter.instance.getValidatedRoute(newRoute);
        this.reset = eventInitDict?.reset;
        this.terminate = eventInitDict?.terminate;
    }
}
