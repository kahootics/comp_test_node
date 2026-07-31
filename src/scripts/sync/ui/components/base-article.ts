import { _assertRegistered, _getPrivateProp, _initPrivateProp, SetOnceWeakMap } from "../../../../tools/encapsulation.js";
import type { route } from "../../../types/router-types.js";

declare const ROUTE_ANCHOR_CLASS: string;
declare const DDD: string;
declare interface RoutesDataset {
    get(route: route): Promise<RouteData>;
}
declare const RoutesDataset: RoutesDataset;
declare const HASH_ROUTE_PREFIX: string;
declare type RouteData = {} // temp

const ROUTE_DATA_ATTRIBUTE = 'data-route-address';

// PRIVATE FIELDS ==================================================================================
const _data = new SetOnceWeakMap<CompanionArticle, RouteData>();
const _route = new SetOnceWeakMap<CompanionArticle, route>();

const _register = new Set<CompanionArticle>();
function _registerEl(instance: CompanionArticle) { _register.add(instance); }

/**
 * @private 
 */
function initRoute(self: CompanionArticle): route {
    _assertRegistered(self, _register);
    const route = self.getAttribute(ROUTE_DATA_ATTRIBUTE);
    if (!route) throw new Error(`Missing ${ROUTE_DATA_ATTRIBUTE} attribute`);
    self.removeAttribute(ROUTE_DATA_ATTRIBUTE);
    return _initPrivateProp(self, _route, route as route);
}
/**
 * @private 
 */
function _initShortArticle(self: CompanionArticle): HTMLElement {
    const article = self.closest('article');
    if (!article) throw new Error('No article parent found');
    return self._shortArticle = article;
}

// CLASS =====================================================
export class CompanionArticle extends HTMLElement {
    public static thereIsError: boolean = false;

    public readonly routeAnchor: HTMLAnchorElement;
    public readonly fullPage: HTMLElement & { init(data: RouteData): void };
    public _shortArticle: HTMLElement | undefined;

    get data(): RouteData {
        const data = _getPrivateProp(this, _data);
        if (!data)
            throw new Error('Data cannot be accessed before connectedCallback has been called!');
        return data;
    }

    get route(): route {
        const route = _getPrivateProp(this, _route);
        if (!route)
            throw new Error('route cannot be read before connectedCallback has been called!');
        return route;
    }

    get shortArticle(): HTMLElement {
        if (!this._shortArticle)
            throw new Error('shortArticle cannot be accessed before connectedCallback has been called!');
        return this._shortArticle;
    }

    constructor() {
        super();
        _registerEl(this);

        this.routeAnchor = document.createElement('a');
        this.routeAnchor.classList.add(ROUTE_ANCHOR_CLASS);
        this.routeAnchor.setAttribute('aria-label', 'Click to view full article');

        this.fullPage = document.createElement(DDD) as typeof this.fullPage; // temp

    }

    connectedCallback() {
        try {
            const route = initRoute(this);
            _initShortArticle(this);

            RoutesDataset.get(route)
                .then((routeData: RouteData) => {
                    if (!this.isConnected) return;
                    if (!routeData) { this.setAttribute('data-error', 'route-not-found'); return; }

                    _initPrivateProp(this, _data, routeData);
                    this.routeAnchor.href = '#' + HASH_ROUTE_PREFIX + route;
                    this.append(this.routeAnchor);
                    this.fullPage.init(routeData);
                })
                .catch((err: Error) => {
                    if (!this.isConnected) return;
                    console.error(err);
                    this.setAttribute('data-error', 'fetch-failed');
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

  