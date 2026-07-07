// @vitest-environment jsdom

import { describe, expect, beforeEach, afterEach, vi, test } from "vitest";
import { LockableElement } from "../../src/scripts/sync/ui/expandables/expandible-element.js";
//import { Lockify } from "../../src/scripts/sync/shared/utilities.js";

// HELPERS ==============================================================================

function getExpandableElement(): HTMLElement | null {
    return document.getElementById("test-me");
}

// SETUP & TEARDOWN =====================================================================

class MockElementWithLock extends LockableElement {};

vi.mock('../../src/scripts/sync/shared/utilities.js', () => {
    
  return {
    requestTransitionFrame: (cb: () => void) => cb(),
  };
});

// Import DOPO i mock (vi.mock viene comunque hoistato da vitest)
//const { default: ExpandableElement, OPEN } = await import('../../src/scripts/sync/dom/expandables/expandable-element.js');
const { Expandable, OPEN } = await import('../../src/scripts/sync/ui/expandables/expandable-element.mixin.js');

const ExpandableElement = Expandable(MockElementWithLock);
customElements.define('expandable-element',ExpandableElement);

function createElement(): InstanceType<typeof ExpandableElement> {
  return document.createElement('expandable-element') as InstanceType<typeof ExpandableElement>;
}

function fireTransitionEnd(el: Element) {
  el.dispatchEvent(new Event('transitionend'));
}

  afterEach(() => {
    document.body.innerHTML = '';
  });



// TAG TESTING ==========================================================================

describe('customElement.define and attributes', () => {

    test('is defined as custom element', () => {
        expect(customElements.get('expandable-element')).toBe(ExpandableElement);
    });

    test('observedAttributes includes "open" and "hidden"', () => {
        expect(ExpandableElement.observedAttributes).toEqual(
            expect.arrayContaining(['open', 'hidden'])
        );
    });

    test('open getter controls corresponding attribute', () => {
        const el = createElement();
        expect(el.open).toBe(false);
        el.setAttribute('open', '');
        expect(el.open).toBe(true);
    });

    test('open setter adds/removes the attribute', () => {
        const el = createElement();
        el.open = true;
        expect(el.hasAttribute('open')).toBe(true);
        el.open = false;
        expect(el.hasAttribute('open')).toBe(false);
    });
});

describe("custom element tag", () => {
    
    test("is defined and hydrated as an instance of ExpandableElement", () => {
        document.body.innerHTML = 
            `<expandable-element id="test-me">
            </expandable-element>`
        const el = getExpandableElement();
        expect(el).toBeInstanceOf(ExpandableElement);
    });

    test("automatically starts as 'hidden' if it has no 'open' attribute", () => {
        document.body.innerHTML = 
            `<expandable-element id="test-me">
            </expandable-element>`
        const el = getExpandableElement() as any;
        expect(el.open).toBe(false);
        expect(el.hidden).toBe(true);
    });

    test("automatically removes 'hidden' if it has 'open' attribute", () => {
        document.body.innerHTML = 
            `<expandable-element id="test-me" open hidden>
            </expandable-element>`
        const el = getExpandableElement() as any;
        expect(el.open).toBe(true);
        expect(el.hidden).toBe(false);
    });

    test("can be inspected with query selector", () => {
        document.body.innerHTML = 
            `<expandable-element id="test-me">
            <div>I am internal</div>
            </expandable-element>`
        const el = getExpandableElement() as any;
        const child = el.querySelector('div');
        expect(child).toBeInstanceOf(HTMLElement);
        expect(child?.textContent).toBe("I am internal");
    });

    test("can be created with `createElement()`", () => {
        const el = document.createElement('expandable-element');
        expect(el).toBeInstanceOf(ExpandableElement);

        expect((el as any).open).toBe(false);
        expect(el.hidden).toBe(false);

        document.body.appendChild(el);

        expect(document.querySelector('expandable-element')).toEqual(el);
        expect(el.hidden).toBe(true);
    });

    test("can be created with new operator", () => {
        const el = new ExpandableElement();
        
        expect(el.open).toBe(false);
        expect(el.hidden).toBe(false);

        document.body.appendChild(el);

        expect(document.querySelector('expandable-element')).toEqual(el);
        expect(el.hidden).toBe(true);

    });
});

// ATTRIBUTE STATE COHERENCY ============================================================

describe("editing hidden reflects on open", () => {

    test("when hidden is set to false, open is true", () => {
        const el = createElement();
        expect(el.open).toBe(false);
        document.body.appendChild(el);
        el.hidden = false;
        expect(el.open).toBe(true);
    });

    test("when hidden is set to true, open is false", () => {
        const el = createElement();
        el.hidden = false;
        el.hidden = true;
        expect(el.open).toBe(false);
    });

    test('setting hidden=true while open=true sets open to false', () => {
        const el = createElement();
        el.setAttribute('open', '');
        document.body.appendChild(el);

        el.hidden = true;
        expect(el.open).toBe(false);
    });

    test('setting hidden=false while open=false sets open to true', () => {
        const el = createElement();
        document.body.appendChild(el);

        el.hidden = false;
        expect(el.open).toBe(true);
    });
});

describe('connectedCallback', () => {

    test('sets hidden = !open when injected into the document (close)', () => {
        const el = createElement();
        el.removeAttribute('open');
        document.body.appendChild(el);
        expect(el.hidden).toBe(true);
    });

    test('sets hidden = !open when injected into the document (open)', () => {
        const el = createElement();
        el.setAttribute('open', '');
        document.body.appendChild(el);
        expect(el.hidden).toBe(false);
    });
});


describe('editing open reflects on hidden', () => {

    test("when open is set to true, hidden is immediately set to false", () => {
        const el = createElement();
        el.open = true;
        expect(el.hidden).toBe(false);
    });

    test("when open is set to false, hidden is set to true only after the transition", () => {
        const el = createElement();
        el.open = true;
        fireTransitionEnd(el);

        el.open = false;
        expect(el.hidden).toBe(false);
        fireTransitionEnd(el);
        expect(el.hidden).toBe(true);
    });

    test("when open is set to true and hidden is set to true during transition, open is reset to false and transition becomes a closing one", () => {
        const el = createElement();

        el.open = true;

        el.hidden = true;
        expect(el.open).toBe(false);

        fireTransitionEnd(el);

        expect(el.open).toBe(false);
        expect(el.hidden).toBe(true);

    });

    test("when open is set to false and hidden is set to true, transition plays as normal (but is hidden early)", () => {
        const el = createElement();
        el.open = true;
        fireTransitionEnd(el);
    
        el.open = false;
        expect(el.hidden).toBe(false);

        el.hidden = true;
        expect(el.open).toBe(false);

        fireTransitionEnd(el);

        expect(el.open).toBe(false);
        expect(el.hidden).toBe(true);
    });

});


// OPENING AND CLOSING ==================================================================

describe('during opening (attributeChangedCallback on "open" <> null)', () => {
    let el: InstanceType<typeof ExpandableElement>;

    beforeEach(() => {
        el = createElement();
        document.body.appendChild(el);
    });

    test('removes hidden and sets a callback to add the `OPEN` class', () => {
        el.open = true;
        expect(el.hidden).toBe(false);
        // callback is mocked as synchronous
        expect(el.classList).toContain(OPEN);
    });

    test('locks element during transition (isLocked true)', () => {
        el.open = true;
        expect(el.isLocked).toBe(true);
    });

    test('unlocks element after transition (transitionend)', () => {
        el.open = true;
        expect(el.isLocked).toBe(true);
        fireTransitionEnd(el);
        expect(el.isLocked).toBe(false);
    });

    test('on transition end, `OPEN` is still on the element', () => {
        el.open = true;
        expect(el.classList).toContain(OPEN);
        fireTransitionEnd(el);
        expect(el.classList).toContain(OPEN);
    });

    test('on transition end, hidden is set to be opposite of open', () => {
        el.open = true;
        expect(el.hidden).toBe(false);
        fireTransitionEnd(el);
        expect(el.hidden).toBe(false);
    });

    test("when a transitions is reversed before end, onTransitionEnd is called exactly once", () => {
        const el = createElement();
        const spy = vi.spyOn(el as any, "onTransitionEnd");
        const spy2 = vi.spyOn(el as any, "setupOnTransitionEnd");

        el.open = true;
        el.hidden = true;

        fireTransitionEnd(el);

        expect(spy).toHaveBeenCalledOnce();
        expect(spy2).toHaveBeenCalledTimes(2);

    });

    test("when multiple transitions are initiated, onTransitionEnd is called exactly once", () => {
        const el = createElement();
        const spy = vi.spyOn(el as any, "onTransitionEnd");
        const spy2 = vi.spyOn(el as any, "setupOnTransitionEnd");

        el.open = true;
        el.open = false;
        el.open = true;

        fireTransitionEnd(el);

        expect(spy).toHaveBeenCalledOnce();
        expect(spy2).toHaveBeenCalledTimes(3);

    });

});

describe('during closure (attributeChangedCallback on "open" -> null)', () => {
    let el: InstanceType<typeof ExpandableElement>;

    beforeEach(() => {
        el = createElement();
        el.setAttribute('open', '');
        document.body.appendChild(el);
        el.classList.add(OPEN);
    });

    test('class OPEN is removed immediately', () => {
        el.open = false;
        expect(el.classList).not.toContain(OPEN);
    });

    test("class OPEN is not present at end of transition", () => {
        el.open = false;
        expect(el.classList).not.toContain(OPEN);
        fireTransitionEnd(el);
        expect(el.classList).not.toContain(OPEN);
    })

    test('element is hidden only at end of transition', () => {
        el.open = false;
        expect(el.hidden).toBe(false);
        fireTransitionEnd(el);
        expect(el.hidden).toBe(true);
    });

});

// OPENING AND CLOSING METHODS ==========================================================

describe('show()', () => {
    let el: InstanceType<typeof ExpandableElement>;
 
    beforeEach(() => {
        el = createElement();
        document.body.appendChild(el);
    });
 
    test('sets open=true and adds OPEN', () => {
        el.show();
        expect(el.open).toBe(true);
        expect(el.classList).toContain(OPEN);
    });
 
    test('calls scheduled callbacks functions at the end of transition', () => {
        const cb = vi.fn();
        el.show(cb);
        expect(cb).not.toHaveBeenCalled();
        fireTransitionEnd(el);
        expect(cb).toHaveBeenCalledOnce();
    });
 
    test('silently fails if called twice without arguments', () => {
        el.open = true;
        fireTransitionEnd(el);
 
        expect(() => el.show()).not.toThrow();
        expect(el.open).toBe(true); 
    });
 
    test('throws InvalidStateError if called while already open with arguments', () => {
        el.open = true;
        fireTransitionEnd(el); 
 
        const cb = vi.fn();
        expect(() => el.show(cb)).toThrowWithName('InvalidStateError');
        expect(cb).not.toHaveBeenCalled(); 
    });
 
    test('throws InvalidStateError while a transition is playing', () => {
        el.open = true;
        expect(el.isLocked).toBe(true);
 
        expect(() => el.show()).toThrowWithName('InvalidStateError');
    });
 
    test('throws InvalidStateError if called with arguments while a transition is playing; all arguments are flushed', () => {
        el.open = true;
        expect(el.isLocked).toBe(true);
 
        const cb = vi.fn();
        expect(() => el.show(cb)).toThrowWithName('InvalidStateError');
 
        fireTransitionEnd(el); 
        expect(cb).not.toHaveBeenCalled();
    });
});
 
describe('close()', () => {
    let el: InstanceType<typeof ExpandableElement>;
 
    beforeEach(() => {
        el = createElement();
        el.setAttribute('open', '');
        document.body.appendChild(el);
        el.classList.add(OPEN);
        fireTransitionEnd(el); 
    });
 
    test('sets open=false and removes class OPEN', () => {
        el.close();
        expect(el.open).toBe(false);
        expect(el.classList.contains(OPEN)).toBe(false);
    });
 
    test('esegue le callback pianificate a fine transizione', () => {
        const cb = vi.fn();
        el.close(cb);
        expect(cb).not.toHaveBeenCalled();
        fireTransitionEnd(el);
        expect(cb).toHaveBeenCalledOnce();
    });
 
    test('fallisce silenziosamente se già chiuso e chiamato senza argomenti', () => {
        el.close();
        fireTransitionEnd(el); // stato stabile: chiuso, non locked
 
        expect(() => el.close()).not.toThrow();
        expect(el.open).toBe(false); // nessun cambio di stato
    });
 
    test('lancia InvalidStateError se già chiuso e chiamato con callback', () => {
        el.close();
        fireTransitionEnd(el); // stato stabile: chiuso, non locked
 
        const cb = vi.fn();
        expect(() => el.close(cb)).toThrowWithName('InvalidStateError');
        expect(cb).not.toHaveBeenCalled();
    });
 
    test('lancia InvalidStateError se chiamato durante una transizione in corso', () => {
        el.close(); // avvia la chiusura -> isLocked true
        expect(el.isLocked).toBe(true);
 
        expect(() => el.close()).toThrowWithName('InvalidStateError');
    });
 
    test('lancia InvalidStateError se chiamato con callback durante una transizione', () => {
        el.close();
        expect(el.isLocked).toBe(true);
 
        const cb = vi.fn();
        expect(() => el.close(cb)).toThrowWithName('InvalidStateError');
 
        fireTransitionEnd(el);
        expect(cb).not.toHaveBeenCalled();
    });
});

describe('error handling in scheduled callbacks', () => {

    test("callback Errors do not stop execution", () => {
        const el = createElement();
        document.body.appendChild(el);

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const throwing = vi.fn(() => {
            throw new Error('boom');
        });
        const following = vi.fn();

        el.show(throwing, following);
        fireTransitionEnd(el);

        expect(throwing).toHaveBeenCalledOnce();
        expect(following).toHaveBeenCalledOnce();
        expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));

        errorSpy.mockRestore();
    });

    test('callbacks are flushed once executed', () => {
        const el = createElement();
        document.body.appendChild(el);

        const cb = vi.fn();
        el.show(cb);
        fireTransitionEnd(el);
        expect(cb).toHaveBeenCalledOnce();

        el.close();
        fireTransitionEnd(el);

        expect(cb).toHaveBeenCalledOnce();
    });
});

describe("safeCall()", () => {
    let el: InstanceType<typeof ExpandableElement>;

    beforeEach(() => {
        el = createElement();
        document.body.appendChild(el);
    });

    test('returns true when silently failing', () => {
        el.open = true;
        fireTransitionEnd(el);
 
        expect(el.safeCall('show')).toBe(true);
        expect(el.open).toBe(true); 

        fireTransitionEnd(el); 
        el.open = false;
        fireTransitionEnd(el);

        expect(el.safeCall('close')).toBe(true);
        expect(el.open).toBe(false);
    });
 
    test('returns false if called while already open with arguments', () => {
        el.open = true;
        fireTransitionEnd(el); 
 
        const cb = vi.fn();
        expect(el.safeCall('show',cb)).toBe(false);
        expect(cb).not.toHaveBeenCalled(); 

        fireTransitionEnd(el); 
        el.open = false;
        fireTransitionEnd(el); 
 
        expect(el.safeCall('close',cb)).toBe(false);
        expect(cb).not.toHaveBeenCalled(); 
    });
 
    test('returns false while a transition is playing', () => {
        el.open = true;
        expect(el.isLocked).toBe(true);
 
        expect(el.safeCall('show')).toBe(false);

        fireTransitionEnd(el);

        el.open = false;
        expect(el.isLocked).toBe(true);
 
        expect(el.safeCall('close')).toBe(false);
    });
 
    test('returns false if called with arguments while a transition is playing; all arguments are flushed', () => {
        el.open = true;
        expect(el.isLocked).toBe(true);
 
        const cb = vi.fn();
        expect(el.safeCall('show',cb)).toBe(false);
 
        fireTransitionEnd(el); 
        expect(cb).not.toHaveBeenCalled();

        fireTransitionEnd(el); 
        el.open = false;
        expect(el.isLocked).toBe(true);
 
        expect(el.safeCall('close',cb)).toBe(false);
 
        fireTransitionEnd(el); 
        expect(cb).not.toHaveBeenCalled();
    });
});