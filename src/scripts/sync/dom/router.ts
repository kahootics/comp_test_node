
import { escapeRegExp } from "../../shared/utilities/string-parsers.js";
import { hashRouterEvent, hashRouterRequestEvent, type HashRouterRequest, type HashRouterOptions, type HashRouterData } from "../../types/router-types.js";

export class HashRouter {
    /** RegularExpression to extract route and title from hash */
    private readonly validHashRE: RegExp;
    /** Hash prefix (after #) */
    private readonly prefix: string;
    /** Document's original title */
    private readonly docOgTitle: string;

    private readonly hashStaticBeginning: string;

    private readonly routes: Map<string,string>;

    private static self: HashRouter;

    private lastNonRoute: {
        hash: string,
        title: string
    } = { hash: '', title: '' };

    /**
     * @param routeCaptureRE - Regular Expression for use in capture group for route
     * @param titleCaptureRE - Regular Expression for use in capture group for title
     * @param [routerOptions] - (optional) a set of options to configure for the router;   
     * see {@link HashRouterOptions} for available options
     */
    private constructor(
        routeCaptureRE: string | RegExp,
        routeMap: Map<string,string>,
        documentOriginalTitle: string,
        routerOptions?: HashRouterOptions
    ) {
        // RUN ONCE
        this.docOgTitle = documentOriginalTitle; 
        const { hashPrefix, slashAfterHash } = routerOptions ?? {};

        this.prefix     = hashPrefix ?? '';
        const regPrefix = escapeRegExp(this.prefix);
        const routeCap: string = routeCaptureRE.toString();
        this.routes = routeMap;

        this.hashStaticBeginning = `#${slashAfterHash ? '/' : ''}${this.prefix}`;
        this.validHashRE = new RegExp(
            `^#${slashAfterHash ? '\\/' : ''}${regPrefix}`
            + `(?<route>${routeCap})` 
        );
        
        this.init();
    }

    private getRoute(hash: string): string | undefined {
        const match = hash.match(this.validHashRE);
        const { route } = match?.groups ?? {};
        return route;
    }

    public getTitle(route: string): string | undefined {
        return this.routes.get(route);
    }

    public getRouteAndTitle(hash: string): {
        route?: string;
        title?: string;
    } {
        const route = this.getRoute(hash);
        const title = this.getTitle(route ?? '');
        return { route, title };
    }

    public static build(
        routeCaptureRE: string | RegExp,
        routeMap: Map<string,string>,
        documentOriginalTitle: string,
        routerOptions?: HashRouterOptions
    ): HashRouter {
        if(this.self) throw new Error("HashRouter is already initialized");
        this.self = new HashRouter(routeCaptureRE, routeMap, documentOriginalTitle, routerOptions);
        return this.self;
    }

    public static get instance(): HashRouter {
        if(!this.self) throw new Error("HashRouter is not initialized yet");
        return this.self;
    }

    private buildHashFrom(route: string) {
        return this.hashStaticBeginning + route;
    }
    
    

    private handleHashChange = () => {
        const {route,title} = this.getRouteAndTitle(location.hash);
        if(route && title) {
            document.title = title;
            this.dispatchHashChangeEvent(route, title);
        } else document.title = this.docOgTitle; // TODO
    }

    private setTitleOn(route: string) {
        const title = this.routes.get(route);
        if(!title) 
            throw new Error(`Route ${route} has no corresponding title in routes map`);
        return title;
    }

    private dispatchHashChangeEvent(route: string, title: string) {
        const routerDataEvent = new HashRouterEvent(hashRouterEvent, {
            route,
            title
        });
        document.dispatchEvent(routerDataEvent);
    }

    private handleHashChangeRequest = (
        e: HashRouterRequestEvent
    ) => {
        const { newRoute, reset } = e;
        if(reset) this.reset()
        else if(newRoute) {
            this.pushHashChange(newRoute);
        }
    }

    /**
     * Reset to no-hash
     * Title to original one
     */
    private reset(): void {
        // TODO
        this.pushState('', this.docOgTitle);
    }
    /**
     * Push back history to last hash before the first route was sent
     * *same with title
     * While routing is occurring, these two should exist
     * While routing is non happening, these two should be memorized
     * Flag: are we en route? to know if they should change
     */
    private loadLastNonRoute() {
        const { hash, title } = this.lastNonRoute;
        this.pushState(hash, title);
    } // TODO
    private saveCurrentNonRoute() {
        this.lastNonRoute.hash  = location.hash;
        this.lastNonRoute.title = document.title;
    } 



    private pushHashChange(newRoute: string) {

        const newHash = this.buildHashFrom(newRoute);
        const route = this.getRoute(newHash);
        if(route === newRoute) {
            const title = this.setTitleOn(newRoute);

        
        // refactor
            const newLoc = new URL(location.href);
            newLoc.hash = newHash;
            document.title = title;
            // after title change (or won't be right in history)
            history.pushState({ route, title }, '', newLoc);

        } else throw new Error('Invalid request at Router');
    }

    private pushState(hash: string, title: string, route?: string) {
        const newLoc = new URL(location.href);
        newLoc.hash = hash;
        document.title = title;
        // after title change (or won't be right in history)
        history.pushState({ route, title }, '', newLoc);
    }

    /** zinne */
    public init(): void {
        window.addEventListener("hashchange", this.handleHashChange);
        document.addEventListener(hashRouterRequestEvent, this.handleHashChangeRequest);
    }

    public terminate(): void {
        window.removeEventListener("hashchange", this.handleHashChange);
        document.removeEventListener(hashRouterRequestEvent, this.handleHashChangeRequest);
    }

    /**
     * Verifies that every key (route) of the routes map 
     * matches against the hash validator regular expression
     * provided at build time AND that the corresponding title
     * does exist and is not blank
     * 
     * @returns test results as a boolean value
     */
    public async testRoutes(): Promise<boolean> {
        const testRoutes = Array.from(this.routes);
        return testRoutes.every((entry: [string,string]) => {
            const [ route, title ] = entry;
            const hash = this.buildHashFrom(route);
            return hash.match(this.validHashRE)?.groups?.route === route
                && this.getTitle(route) === title.trim() && title.trim().length > 0
        });
    }
}


export class HashRouterEvent extends HashChangeEvent implements HashRouterEventInit {
    public readonly route?: string;
    public readonly title?: string;
    constructor(type: string, eventInitDict?: HashRouterEventInit | undefined) {
        super(type, eventInitDict);
        this.route = eventInitDict?.route;
        this.title = eventInitDict?.title;
    }
}

interface HashRouterEventInit extends HashChangeEventInit {
    route?: string,
    title?: string,
}

export class HashRouterRequestEvent extends Event implements HashRouterRequestEventInit {
    public readonly newRoute?: string
    public readonly reset?: boolean
    constructor(type: string, eventInitDict?: HashRouterRequestEventInit | undefined) {
        super(type, eventInitDict);
        this.newRoute = eventInitDict?.newRoute;
        this.reset = eventInitDict?.reset;
    }
}

interface HashRouterRequestEventInit extends EventInit {
    newRoute?: string,
    reset?: boolean
}

