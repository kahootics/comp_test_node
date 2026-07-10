// @vitest-environment jsdom

import { describe, expect, beforeEach, afterEach, vi, test } from "vitest";
import { HashRouter, HashRouterEvent, HashRouterRequestEvent } from '../../src/scripts/sync/ui/hash-router.js';
import { hashRouterRequestEvent, route, hashRouterEvent, title } from "../../src/scripts/types/router-types.js";
import { resetSingleton } from "../utils.js";


// HELPERS ==============================================================================

/** Build a default router with three routes */
function buildRouter(options?: Parameters<typeof HashRouter.build>[2]) {
    const routes = new Map<string, string>([
        ["home", "Home Page"],
        ["about", "About Us"],
        ["contact", "Contact"],
        ["00-AFZ98", "Mystification"],
        ["lenovo", "Lenovo"],
        ["Ss00!", "Sos"],
        ["oo)oO", "Yolo"],
        ["cos", "Cosin"]
    ]);
    return HashRouter.build("Original Title", routes, options);
}

/** Fire a native hashchange event; also updates location.hash */
function fireHashChange(oldHash: string, newHash: string) {
    location.hash = newHash;
    const event = new HashChangeEvent("hashchange", {
        oldURL: `http://localhost/${oldHash}`,
        newURL: `http://localhost/${newHash}`,
    });
    window.dispatchEvent(event);
}

/** Dispatch a router-request event */
function requestRoute(newRoute?: string, reset?: boolean, terminate?: boolean) {
    const event = new HashRouterRequestEvent(hashRouterRequestEvent, {
        newRoute: newRoute as route | undefined,
        reset,
        terminate,
    });
    document.dispatchEvent(event);
}


// SETUP & TEARDOWN =====================================================================

beforeEach(() => {
    resetSingleton(HashRouter as any, "self");
    location.hash = "";
    document.title = "Original Title";
    vi.spyOn(history, "pushState")//.mockImplementation(() => {});
});

afterEach(() => {
    try { (HashRouter as any).instance.terminate(); } catch { /* not initialized */ }
    vi.restoreAllMocks();
    resetSingleton(HashRouter as any, "self");
});

// SINGLETON LIFECYCLE ==================================================================

describe("HashRouter: singleton & lifecycle", () => {

    test("build() returns a HashRouter instance", () => {
        const router = buildRouter();
        expect(router).toBeInstanceOf(HashRouter);
    });

    test("instance getter returns the same object after build", () => {
        const router = buildRouter();
        expect(HashRouter.instance).toBe(router);
    });
// @ts-ignore
    test("instance getter throws RouterInitializationError when not yet built", () => {
// @ts-ignore
        expect(() => HashRouter.instance).toThrowWithName("RouterInitializationError");
    });

    test("build() throws RouterInitializationError when called a second time", () => {
        buildRouter();
// @ts-ignore
        expect(() => buildRouter()).toThrowWithName("RouterInitializationError");
    });

    test("build() throws IllegalArgumentError when the prefix contains a hash character", () => {
        const routesMap = new Map([["cos", 'Cos'], ["   ", "at"]]);
// @ts-ignore
        expect(() => HashRouter.build('T', routesMap, { hashPrefix: "perf#-" })).toThrowWithName("IllegalArgumentError");
    });

    test("request terminate() removes listeners so hashchange no longer fires events", () => {
        const router = buildRouter();
        const spy = vi.fn();
        document.addEventListener(hashRouterEvent, spy);

        requestRoute(undefined, false, true);
        fireHashChange("", "#home/");

        expect(spy).not.toHaveBeenCalled();
        document.removeEventListener(hashRouterEvent, spy);
    });

});

// ROUTE VALIDATION =====================================================================

describe("getValidatedRoutesMap(routesMap) & build()", () => {

    test("throws ValidationError when a key contains an invalid character", () => {
        resetSingleton(HashRouter as any, "self");
        const routesMap = new Map([["cos", 'Cos'], ["&atmora", "at"]]);
// @ts-ignore
        expect(() => HashRouter.build("T", routesMap)).toThrowWithName("ValidationError");
    });

    test("throws ValidationError when a key is blank", () => {
        resetSingleton(HashRouter as any, "self");
        const routesMap = new Map([["cos", 'Cos'], ["   ", "at"]]);
// @ts-ignore
        expect(() => HashRouter.build("T", routesMap)).toThrowWithName("ValidationError");
    });

    test("throws ValidationError when a title is blank", () => {
        resetSingleton(HashRouter as any, "self");
        const routesMap = new Map([["cos", 'Cos'], ["mos", ""]]);
// @ts-ignore
        expect(() => HashRouter.build("T", routesMap)).toThrowWithName("ValidationError");

        resetSingleton(HashRouter as any, "self");
        const routesMap1 = new Map([["cos", 'Cos'], ["mos", "          "]]);
// @ts-ignore
        expect(() => HashRouter.build("T", routesMap1)).toThrowWithName("ValidationError");
    });

    test("doesn't throw when a key contains allowed special characters", () => {
        resetSingleton(HashRouter as any, "self");
        const routesMap = new Map([["cos", 'Cos'], ["~_-.~!()", "specials"]]);
        HashRouter.build("T", routesMap);
        expect(HashRouter.instance.getTitle("~_-.~!()" as route)).toStrictEqual("specials");
    });

    test("running build() throws ValidationError when the route map has invalid keys", () => {
        resetSingleton(HashRouter as any, "self");
// @ts-ignore
        expect(() => HashRouter.build("T", new Map([["@home", "Home"]]))).toThrowWithName("ValidationError");

        resetSingleton(HashRouter as any, "self");
// @ts-ignore
        expect(() => HashRouter.build("T", new Map([["[]{}", "Symbols"]]))).toThrowWithName("ValidationError");
    });

    test("running build() throws ValidationError when the route map has empty titles", () => {
        resetSingleton(HashRouter as any, "self");
// @ts-ignore
        expect(() => HashRouter.build("T", new Map([["home", ""]]))).toThrowWithName("ValidationError");

        resetSingleton(HashRouter as any, "self");
// @ts-ignore
        expect(() => HashRouter.build("T", new Map([["home", "   "]]))).toThrowWithName("ValidationError");
    });

});

// IS A ROUTE ===========================================================================

describe("isAHashRoute()", () => {

    test("returns true for a hash that matches a known route", () => {
        const router = buildRouter();
        expect(router.isAHashRoute("#home/" as any)).toBe(true);
    });

    test("returns false for a hash that does not match any route", () => {
        const router = buildRouter();
        expect(router.isAHashRoute("#unknown/" as any)).toBe(false);
    });

    test("returns false for a hash that does not have the right terminator", () => {
        const router = buildRouter();
        expect(router.isAHashRoute("#home" as any)).toBe(false);
        expect(router.isAHashRoute("#home/e" as any)).toBe(false);
        expect(router.isAHashRoute("#home/e/" as any)).toBe(false);
    });

    test("returns false for an empty hash", () => {
        const router = buildRouter();
        expect(router.isAHashRoute("" as any)).toBe(false);
    });

    test("respects the hashPrefix option", () => {
        const router = HashRouter.build("T", new Map([["home", "Home"]]), { hashPrefix: "app-" });
        expect(router.isAHashRoute("#app-home/" as any)).toBe(true);
        expect(router.isAHashRoute("#home/" as any)).toBe(false);
    });

    test("escapes the hashPrefix option", () => {
        const router = HashRouter.build("T", new Map([["home", "Home"]]), { hashPrefix: "$a/pp-" });
        expect(router.isAHashRoute("#$a/pp-home/" as any)).toBe(true);
        expect(router.isAHashRoute("#app-home/" as any)).toBe(false);
    });

    test("respects the slashAfterHash option", () => {
        resetSingleton(HashRouter as any, "self");
        const router = HashRouter.build("T", new Map([["home", "Home"]]), { slashAfterHash: true });
        expect(router.isAHashRoute("#/home/" as any)).toBe(true);
        expect(router.isAHashRoute("#home/" as any)).toBe(false);
    });

    test("respects all valid characters", () => {
        resetSingleton(HashRouter as any, "self");
        const router = HashRouter.build("T", new Map([["~_-.~!()", "Symbols"]]), { slashAfterHash: true });
        expect(router.isAHashRoute("#/~_-.~!()/" as any)).toBe(true);
    });

    test("respects the slashAfterHash option AND trailing slash", () => {
        resetSingleton(HashRouter as any, "self");
        const router = HashRouter.build("T", new Map([["home", "Home"]]), { slashAfterHash: true });
        expect(router.isAHashRoute("#/home/" as any)).toBe(true);
        expect(router.isAHashRoute("#/home/e" as any)).toBe(false);
        expect(router.isAHashRoute("#/home" as any)).toBe(false);
        expect(router.isAHashRoute("#/home/e/" as any)).toBe(false);
        expect(router.isAHashRoute("#home/home/" as any)).toBe(false);
        expect(router.isAHashRoute("#/home/home/" as any)).toBe(false);
    });

    test("respects the hashPrefix AND slashAfterHash option", () => {
        const router = HashRouter.build("T", new Map([["home", "Home"]]), {
            hashPrefix: "$$ap*p-", slashAfterHash: true
        });
        expect(router.isAHashRoute("#/$$ap*p-home/" as any)).toBe(true);
        expect(router.isAHashRoute("#home/" as any)).toBe(false);
    });

});

// GET TITLE ============================================================================

describe("getTitle()", () => {

    test("returns the correct title for a known route", () => {
        const router = buildRouter();
        expect(router.getTitle("home" as route)).toBe("Home Page");
    });

    test("throws IllegalArgumentError for an unknown route", () => {
        const router = buildRouter();
// @ts-ignore
        expect(() => router.getTitle("nonexistent" as route)).toThrowWithName("IllegalArgumentError");
    });
});

// HANDLE HASH CHANGE ===================================================================

describe("handleHashChange(): route found, last hash was a route", () => {

    test("updates document.title to the new route's title", () => {
        buildRouter();
        fireHashChange("#home/", "#about/");
        expect(document.title).toBe("About Us");
    });

    test("dispatches a HashRouterEvent with correct route & title", () => {
        buildRouter();
        // Settle into a first route so oldHash is also a route
        fireHashChange("#home/", "#home/");

        const spy = vi.fn();
        document.addEventListener(hashRouterEvent, spy);
        fireHashChange("#home/", "#about/");

        expect(spy).toHaveBeenCalledOnce();
        const evt: HashRouterEvent = spy.mock.calls[0][0];
        expect(evt.route).toBe("about");
        expect(evt.title).toBe("About Us");
        expect(evt.reset).toBeUndefined();

        document.removeEventListener(hashRouterEvent, spy);
    });
});

describe("handleHashChange(): route found, last hash was NOT a route", () => {

    test("stores the previous non-route title before changing it", () => {
        const router = buildRouter();
        document.title = "Custom Page";
        fireHashChange("#custom-page", "#home/");
        expect(document.title).toBe("Home Page");
        expect(router.lastNonRouteTitle).toBe("Custom Page");
    });

    test("stores the previous non-route hash from the event", () => {
        const router = buildRouter();
        fireHashChange("#custom-page", "#home/");
        expect(router.lastNonRouteHash).toBe("#custom-page");
        fireHashChange("#home/", "#about/");
        expect(router.lastNonRouteHash).toBe("#custom-page");
        fireHashChange("#about/", "#another-page");
        expect(router.lastNonRouteHash).toBe("#another-page");
    });

    test("dispatches a route-change event", () => {
        buildRouter();
        const spy = vi.fn();
        document.addEventListener(hashRouterEvent, spy);
        fireHashChange("", "#home/");

        expect(spy).toHaveBeenCalledOnce();
        const evt: HashRouterEvent = spy.mock.calls[0][0];
        expect(evt.route).toBe("home");

        document.removeEventListener(hashRouterEvent, spy);
    });
});

describe("handleHashChange(): route NOT found, last hash was a route", () => {

    test("restores the document title to the original when it was a route title", () => {
        buildRouter();
        fireHashChange("", "#home/");
        expect(document.title).toBe("Home Page");

        fireHashChange("#home/", "#unknown-page");
        expect(document.title).toBe("Original Title");
    });

    test("dispatches a HashRouterEvent with reset: true", () => {
        buildRouter();
        fireHashChange("", "#home/");

        const spy = vi.fn();
        document.addEventListener(hashRouterEvent, spy);
        fireHashChange("#home/", "#non-route");

        expect(spy).toHaveBeenCalledOnce();
        const evt: HashRouterEvent = spy.mock.calls[0][0];
        expect(evt.reset).toBe(true);
        expect(evt.route).toBeUndefined();

        document.removeEventListener(hashRouterEvent, spy);
    });
});

describe("handleHashChange(): route NOT found, last hash was NOT a route", () => {

    test("does NOT dispatch any router event", () => {
        const router = buildRouter();
        const spy = vi.fn();
        document.addEventListener(hashRouterEvent, spy);

        document.title = "Another Title";
        fireHashChange("#some-anchor", "#another-anchor");

        expect(router.lastNonRouteHash).toBe("#another-anchor");
        expect(router.lastNonRouteTitle).toBe("Another Title");

        expect(spy).not.toHaveBeenCalled();
        document.removeEventListener(hashRouterEvent, spy);
    });

});

// HANDLE HASH ROUTER REQUEST

describe("route-change request events", () => {

    test("buildHashFromRoute() returns a hash that contains the route", () => {
        const router = buildRouter();
        expect(router.buildHashFrom('about' as any)).toBe("#about/");
    });

    test("pushes history state when a valid new route is requested", () => {
        buildRouter();
        requestRoute("about");
        expect(history.pushState).toHaveBeenCalledOnce();
        const [state] = (history.pushState as any).mock.calls[0];
        expect(state.route).toBe("about");
        expect(state.title).toBe("About Us");
    });

    test("updates document.title on a valid route request", () => {
        const router = buildRouter();
        requestRoute("contact");
        expect(document.title).toBe("Contact");
        expect(router.lastNonRouteTitle).toBe("Original Title");
        requestRoute("home");
        expect(document.title).toBe("Home Page");
        expect(router.lastNonRouteTitle).toBe("Original Title");
    });


    test("event constructor throws ValidationError for an unknown route request", () => {
        buildRouter();
// @ts-ignore
        expect(() => requestRoute("nonexistent")).toThrowWithName("ValidationError");
    });

    test("reset request restores the last non-route state via pushState", () => {
        const router = buildRouter();
        document.title = "last";
        fireHashChange("", "#not");

        fireHashChange("#not", "#home/");
        expect(router.lastNonRouteHash).toBe("#not");
        expect(document.title).toBe('Home Page');

        requestRoute(undefined, true);
        expect(history.pushState).toHaveBeenCalled();

        expect(router.lastNonRouteHash).toBe("#not");
        expect(location.hash).toBe("#not");
        expect(location.href).toBe(router.getURLWithNewHash("#not" as any).href);

        expect(router.lastNonRouteTitle).toBe('last');
        expect(document.title).toBe("last");
    });
});

// ===========================================================================
// 7. Custom event classes
// ===========================================================================

describe("HashRouterEvent", () => {

    test("carries route and title from init dict", () => {
        const evt = new HashRouterEvent(hashRouterEvent, {
            route: "home" as route,
            title: "Home Page" as title,
        });
        expect(evt.route).toBe("home");
        expect(evt.title).toBe("Home Page");
        expect(evt.reset).toBeUndefined();
    });

    test("carries reset flag", () => {
        const evt = new HashRouterEvent(hashRouterEvent, { reset: true });
        expect(evt.reset).toBe(true);
    });

    test("is an instance of HashChangeEvent", () => {
        const evt = new HashRouterEvent(hashRouterEvent, {});
        expect(evt).toBeInstanceOf(HashChangeEvent);
    });
});

describe("HashRouterRequestEvent", () => {

    test("carries newRoute from init dict", () => {
        buildRouter();
        const evt = new HashRouterRequestEvent(hashRouterRequestEvent, {
            newRoute: "about" as route,
        });
        expect(evt.newRoute).toBe("about");
        expect(evt.reset).toBeUndefined();
    });

    test("carries reset flag", () => {
        const evt = new HashRouterRequestEvent(hashRouterRequestEvent, { reset: true });
        expect(evt.reset).toBe(true);
        expect(evt.newRoute).toBeUndefined();
    });

    test("is an instance of Event", () => {
        const evt = new HashRouterRequestEvent(hashRouterRequestEvent, {});
        expect(evt).toBeInstanceOf(Event);
    });
});