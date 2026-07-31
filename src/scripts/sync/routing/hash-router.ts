
import { IllegalArgumentError, ValidationError } from "../../../errors/common-errors.mjs";
import { RouterInitializationError, RouterInvalidRequestError } from "../../../errors/route-errors.js";
import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { escapeRegExp } from "../../../tools/string-parsers.js";
import { hashRouterEvent, hashRouterRequestEvent, type hash, type HashRouterOptions, type route, type title } from "../../types/router-types.js";
import { HashRouterEvent } from "./hash-router-event.js";
import type { HashRouterRequestEvent } from "./hash-router-request-event.js";


/**
 * Hash based router entity to manage dynamic routes
 */
export class HashRouter {

    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol("Hash Router");

    /** RegularExpression to extract route and title from hash */
    readonly #validHashRE: RegExp;
    /** Regular Expression (String) a route must match */
    static readonly #routeCapture: string = "(?<route>[A-Za-z0-9_\\-.~!()]+)";
    /** Regular Expression a route must match */
    static readonly #routeCaptureRegExp: RegExp = new RegExp(HashRouter.#routeCapture);

    /** Any hash route's complete prefix (including `#`) */
    private readonly hashStaticBeginning: string;

    /** Map that links each route to the corresponding title */
    private readonly routes: Map<route, title>;
    /** List of all available titles */
    private readonly titles: Set<title>;

    /** Singleton class instance */
    static #instance: HashRouter | null = null;
    static get #self(): HashRouter {
        if (!this.#instance) throw new RouterInitializationError("HashRouter is not initialized yet");
        return this.#instance;
    }
    /** Returns the `singleton` instance of the router. */
    public static get instance(): HashRouter {
        if (!this.#self) throw new RouterInitializationError("HashRouter is not initialized yet");
        return this.#self;
    }

    // LAST NON ROUTE STATE
    private readonly lastNonRoute: {
        hash: hash,
        title: title
    };
    /** Document's original title */
    private readonly documentOgTitle: title;
    // NON ROUTE STATE HELPERS FUNCTIONS
    private reset() {
        this.restoreLastTitle();
        this.restoreLastHash();
    }
    private restoreLastHash(): void {
        const lastLoc = this.getURLWithNewHash(this.lastNonRoute.hash);
        history.pushState(null, '', lastLoc.href);
    }
    private restoreLastTitle(): void {
        document.title = this.lastNonRoute.title
    }
    private restoreOriginalTitle(): void {
        document.title = this.documentOgTitle;
    }
    private storeCurrentHash(): void {
        this.lastNonRoute.hash = location.hash as hash;
    }
    private storeLastHash(hash: hash): void {
        this.lastNonRoute.hash = hash;
    }
    private storeCurrentTitle(): void {
        this.lastNonRoute.title = document.title as title;
    }
    /** Returns the last stored hash that did not contain a route. */
    public get lastNonRouteHash() {
        return this.lastNonRoute.hash;
    };
    /** Returns the last stored title when the page was not in a recognized route. */
    public get lastNonRouteTitle() {
        return this.lastNonRoute.title;
    };


    private constructor(
        token: symbol,
        documentOriginalTitle: string,
        routesMap: Map<string, string>,
        routerOptions?: HashRouterOptions
    ) {
        // Privacy of constructor
        if (token !== HashRouter.#constructionToken)
            throw new PrivateConstructorError("HashRouter", { init: { method: 'build', type: 'singleton' } });
        // RUN ONCE
        this.lastNonRoute = { title: document.title as title, hash: location.hash as hash };
        this.documentOgTitle = documentOriginalTitle as title;
        const { hashPrefix, slashAfterHash } = routerOptions ?? {};

        /** Hash prefix (after #) */
        const prefix = hashPrefix ?? '';
        if (prefix.includes('#'))
            throw new IllegalArgumentError("A fragment cannot contain another '#' character");
        const regPrefix = escapeRegExp(prefix);

        this.routes = HashRouter.getValidatedRoutesMap(routesMap);
        this.titles = new Set(this.routes.values());

        this.hashStaticBeginning = `#${slashAfterHash ? '/' : ''}${prefix}`;
        this.#validHashRE = new RegExp(
            `^#${slashAfterHash ? '\\/' : ''}${regPrefix}`
            + `${HashRouter.#routeCapture}\\/$`
        );

        this.init();
    }

    /** 
     * Builds a singleton instance of the router and returns a reference to it. 
     * 
     * @param documentOriginalTitle - Document's original title
     * @param routesMap - [Route -> Title] map for all of the routes
     * @param [routerOptions] - (optional) a set of options to configure for the router;   
     * see {@link HashRouterOptions} for available options
     * 
     * @throws {IllegalArgumentError} If an optional prefix is passed but contains a `#` character
     * @throws {ValidationError} If the routes map is invalid;
     * see {@link getValidatedRoutesMap} for more information about the validation
     */
    public static build(
        documentOriginalTitle: string,
        routesMap: Map<string, string>,
        routerOptions?: HashRouterOptions
    ): HashRouter {
        if (HashRouter.#instance)
            throw new RouterInitializationError("HashRouter cannot be initialized twice");

        this.#instance = new HashRouter(
            this.#constructionToken, documentOriginalTitle, routesMap, routerOptions
        );
        return this.#self;
    }


    /**
     * @param e - HashChangeEvent
     * @returns the hash from the oldUrl prop of the event
     */
    private getOldHash(e: HashChangeEvent): hash {
        return (new URL(e.oldURL)).hash as hash;
    }

    /**
     * Verifies if the given hash contains a valid route
     * 
     * @param hash - hash to extract a route from
     * @returns `true` if it was possible to extract a valid route from the hash
     */
    public isAHashRoute(hash: hash): boolean {
        const route = this.getRouteIfValid(hash);
        return route ? true : false;
    }
    /** Returns the validated route; 
     * @throws {ValidationError} If the given route is invalid
     */
    public getValidatedRoute(route: string): route {
        if (!this.routes.has(route as route))
            throw new ValidationError(`${route} is not a route`);
        return route as route;
    }

    /** Extracts and validates a route from a hash, returns `undefined` if it is not valid */
    private getRouteIfValid(hash: hash): route | undefined {
        const match = hash.match(this.#validHashRE);
        const { route } = match?.groups ?? {};
        if (route && this.routes.has(route as route))
            return route as route;
        // undefined is returned by default
    }

    /**
     * Retrieves the title of a given route
     * 
     * @param route - route to find a title for
     * @returns the corresponding title
     * @throws {IllegalArgumentError} If a string was passed but it was not a route
     * @remarks
     * Validate a route beforehand if uncertain
     */
    public getTitle(route: route): title {
        const title = this.routes.get(route);
        if (!title)
            throw new IllegalArgumentError("You must pass a valid route to this function");
        return title as title;
    }

    /** Builds a hash according to specifics of the router using a route. */
    public buildHashFrom(route: route): hash {
        return this.hashStaticBeginning + route + '/' as hash;
    }

    /** Builds an URL from a hash using current location as reference. */
    public getURLWithNewHash(hash: hash): URL {
        const newLoc = new URL(location.href);
        newLoc.hash = hash;
        return newLoc;
    }

    /** 
     * ON hashChange & DOMContentLoaded:
     * 
     * IF *a route is found* and *last hash was a route*:
     * - the title is changed to the one of the route according to the map
     * - an `HashRouterEvent` communicating the route and title is emitted
     * 
     * IF *a route is found* and *last hash was NOT a route*:
     * - the title is stored
     * - the title is changed to the one of the route according to the map
     * - an `HashRouterEvent` communicating the route and title is emitted
     * 
     * IF *a route is NOT found* and *last hash was a route*:
     * - the title is restored (only if it wasn't also changed) to the document original one
     * - the hash is stored
     * - an `HashRouterEvent` with reset is emitted
     * 
     * IF *a route is NOT found* and *last hash was NOT a route*:
     * - the title is stored
     * - the hash is stored
     * - no event is emitted 
     */
    private handleHashChange = (e?: HashChangeEvent) => {

        const route = this.getRouteIfValid(location.hash as hash);
        const lastHash = e && this.getOldHash(e);
        const itWasNotARoute = (lastHash || lastHash === '') && !this.isAHashRoute(lastHash);
        if (route) {
            // a route was found
            if (itWasNotARoute) {
                // store title if it is not a route one
                this.storeCurrentTitle();
                this.storeLastHash(lastHash);
            }

            const title = this.getTitle(route);
            document.title = title;
            this.dispatchRouteChangeEvent(route, title);
        } else {
            // no route found
            if (itWasNotARoute) {
                // we were not in a route
                this.storeCurrentTitle();
            } else {
                // we were in a route
                if (this.titles.has(document.title as title))
                    // restore title to initial
                    this.restoreOriginalTitle();

                this.dispatchRouteResetEvent();
            }
            this.storeCurrentHash();
        }
    }

    /** Sends route and title as an event to listeners. */
    private dispatchRouteChangeEvent(route: route, title: title) {
        const routerDataEvent = new HashRouterEvent(hashRouterEvent, {
            route,
            title
        });
        document.dispatchEvent(routerDataEvent);
    }
    /** Sends a reset as an event to listeners. */
    private dispatchRouteResetEvent() {
        const routerDataEvent = new HashRouterEvent(hashRouterEvent, {
            reset: true
        });
        document.dispatchEvent(routerDataEvent);
    }



    // HASH CHANGE REQUEST

    /** 
     * Handles a request to the router:
     * - a *reset* request restores the hash and title before the routing started
     * - a *terminate* request resets routes and removes all listeners
     * - a *route* request makes necessary changes to push the requested route
     */
    private handleRouteChangeRequest = (
        e: HashRouterRequestEvent
    ) => {
        const { newRoute, reset, terminate } = e;
        if (terminate) {
            this.reset();
            this.#terminate();
        }
        else if (reset) {
            this.reset();
        }
        else if (newRoute) {
            this.pushRouteChange(newRoute);
        }
    }

    /**
     * Adds a new entry to history if a valid route is passed
     * @param newRoute - Route to be enforced
     */
    private pushRouteChange(newRoute: route) {

        const newHash = this.buildHashFrom(newRoute);
        const route = this.getRouteIfValid(newHash);

        if (route === newRoute) {
            const title = this.getTitle(newRoute);
            document.title = title;
            const newLoc = this.getURLWithNewHash(newHash);
            // after title change (or won't be right in history)
            history.pushState({ route, title }, '', newLoc);

        } else throw new RouterInvalidRequestError('Invalid request at Router');
    }

    /** Activate event listeners on router. */
    public init(): void {
        if (!HashRouter.#instance)
            window.addEventListener('DOMContentLoaded', () => this.handleHashChange(), { once: true });

        window.addEventListener("hashchange", this.handleHashChange);
        document.addEventListener(hashRouterRequestEvent, this.handleRouteChangeRequest);
    }

    /** Remove event listeners from router. */
    #terminate(): void {
        window.removeEventListener("hashchange", this.handleHashChange);
        document.removeEventListener(hashRouterRequestEvent, this.handleRouteChangeRequest);
    }
    private static terminate() {
        this.#self.#terminate();
    }

    /** Destroys singleton; will require new build. */
    private static destroy() {
        this.#instance = null;
    }

    /**
     * Verifies that 
     * - a route must match the class regular expression (must only contain characters compatible with a url fragment)
     * - a title must not be blank
     * @see {@link #routeCapture} for the specific regex a route must match against
     * 
     * @returns test results as validated map
     * @throws {ValidationError} If any key or value of the map is not compatible with restrictions
     */
    private static getValidatedRoutesMap(map: Map<string, string>): Map<route, title> {
        const routeRegExp = this.#routeCaptureRegExp;
        for (const [route, title] of map) {
            // route validation
            const mRoute = route.match(this.#routeCaptureRegExp)?.groups?.route;
            if (!mRoute)
                throw new ValidationError(`Route ${route} contains illegal syntax for a hash`);
            if (mRoute !== route)
                throw new ValidationError(`Route ${route} ends or starts with illegal characters for a hash`);
            // title validation
            if (title.trim().length <= 0)
                throw new ValidationError(`Title for route ${route} cannot be blank`);
        }
        return map as Map<route, title>;
    }
}

