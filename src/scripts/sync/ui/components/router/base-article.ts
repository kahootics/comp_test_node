import { IllegalStateError, NotFoundError } from "../../../../../errors/common-errors.mjs";
import { _assertRegistered, _getPrivateProp, _initPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.js";
import type { route } from "../../../../types/router-types.js";

declare const ROUTE_ANCHOR_CLASS: string;
declare const DDD: string;
declare interface RoutesDataset {
    get(route: route): Promise<RouteData>;
}
declare const RoutesDataset: RoutesDataset;
declare const HASH_ROUTE_PREFIX: string;
declare type RouteData = {} // temp

declare const ROUTE_DATA_ATTRIBUTE = 'data-route-address';




// CLASS =====================================================
export class CompanionArticle extends HTMLElement {
    public static thereIsError: boolean = false;

    public readonly routeAnchor: HTMLAnchorElement;
    public readonly fullPage: HTMLElement & { init(data: RouteData): void };
    #shortArticle: HTMLElement | undefined;
    #data: RouteData | undefined;
    #route: route | undefined;
    #ready: Promise<boolean> | undefined

    get data(): RouteData {
        const data = this.#data;
        if (!data)
            throw new IllegalStateError('Cannot access "Data" before connectedCallback has been called!');
        return data;
    }

    get route(): route {
        const route = this.#route;
        if (!route)
            throw new IllegalStateError('Cannot read "route" before connectedCallback has been called!');
        return route;
    }

    get shortArticle(): HTMLElement {
        if (!this.#shortArticle)
            throw new IllegalStateError('Cannot access before connectedCallback has been called!');
        return this.#shortArticle;
    }
    public async isReady(): Promise<boolean> {
        const ready = this.#ready;
        if(!ready) return false;
        return ready;
    }

    constructor() {
        super();

        const routeAnchor = document.createElement('a');
        routeAnchor.classList.add(ROUTE_ANCHOR_CLASS);
        routeAnchor.setAttribute('aria-label', 'Click to view full article');
        this.routeAnchor = routeAnchor;

        this.fullPage = document.createElement(DDD) as typeof this.fullPage; // temp

    }

    #initRoute(): route {
        const route = this.getAttribute(ROUTE_DATA_ATTRIBUTE);
        if (!route) throw new NotFoundError(ROUTE_DATA_ATTRIBUTE, { type: 'attribute' });
        this.removeAttribute(ROUTE_DATA_ATTRIBUTE);
        return this.#route = route as route;
    }

    #initShortArticle() {
        const article = this.closest('article');
        if (!article) throw new NotFoundError('article', { type: 'wrapper' });
        return this.#shortArticle = article;
    }

    connectedCallback() {
        try {
            const route = this.#initRoute();
            this.#initShortArticle();

            this.#ready = RoutesDataset.get(route)
                .then((routeData: RouteData) => {
                    if (!this.isConnected)
                        return false;
                    if (!routeData) {
                        this.setAttribute('data-error', 'route-not-found');
                        return false;
                    }

                    this.#data = routeData;
                    this.routeAnchor.href = '#' + HASH_ROUTE_PREFIX + route;
                    this.append(this.routeAnchor);
                    this.fullPage.init(routeData);
                    return true;
                })
                .catch((err: Error) => {
                    if (!this.isConnected)
                        return false;
                    console.error(err);
                    this.setAttribute('data-error', 'fetch-failed');
                    return false;
                });

        } catch (e) {
            if (e instanceof Error) {
                console.error(e);
                this.setAttribute('data-error', e.message);
                CompanionArticle.thereIsError = true;
            }
        }
    }


    // SHARED INTERFACE PROPERTIES ========================
    public setHiddenState(state: boolean) {
        if (state) {
            this.shortArticle.hidden = true;
            this.fullPage.hidden = true;
        } else {
            this.shortArticle.hidden = false;
            this.fullPage.hidden = false;
        }
    }
}

/* 
.stretched-link {
  position: absolute;
  inset: 0;
  z-index: 1; 
} */


