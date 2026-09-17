import { _getPrivateProp } from "../../../../../tools/encapsulation.js";
import { getAllFocusables } from "../../../shared/getFocusableExtremities.js";

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends object> = new (...args: any[]) => T;

// HELPERS =============================================================================
interface InertCapable { inert: boolean }
var polyfillStylesInjected: boolean;

// MIXIN FUNCTION ======================================================================
/**
 * Polyfill Inert Mixin to generate a new custom HTMLElement with inert if it is not defined
 * 
 * @remarks
 * This does not redefine `HTMLElement` in case it did not implement `inert`
 */

export function InertPolyfill<
    TBase extends Constructor<HTMLElement>
>(Base: TBase): TBase & Constructor<InertCapable> {
    if ('inert' in HTMLElement.prototype)
        return Base as TBase & Constructor<InertCapable>;

    if (!polyfillStylesInjected) {
        const style = document.createElement('style');
        style.textContent = [
            '[inert] {',
            'pointer-events: none;',
            'cursor: default;}',
            '[inert], [inert] * {',
            '-webkit-user-select: none;',
            '-moz-user-select: none;',
            '-ms-user-select: none;',
            'user-select: none;}'
        ].join(' ');
        polyfillStylesInjected = true;
    }

    return class InertPolyfilled extends Base implements InertCapable {

        #focusables: Map<Element, string | null> = new Map();

        public override get inert(): boolean {
            return this.hasAttribute('inert');
        }
        public override set inert(value: boolean) {
            if (value) {
                this.setAttribute('inert', '');
            } else {
                this.removeAttribute('inert');
            }
        }

        /** Element's observed attributes. */
        static get observedAttributes(): string[] {
            return ['inert'];
        }

        #applyInert(): void {
            const focusables = getAllFocusables(this);
            const myFocusables = this.#focusables;
            myFocusables.clear;
            focusables.forEach(f => {
                myFocusables.set(f, f.getAttribute('tabindex'));
                f.setAttribute('tabindex', '-1');
            })
        }
        #removeInert(): void {
            this.#focusables.forEach((tabI, el) => {
                if (tabI) el.setAttribute('tabindex', tabI);
                else el.removeAttribute('tabindex');
            })
        }

        connectedCallback() {
            if (this.inert) this.#applyInert();
        }

        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
            if (name === 'inert'
                && typeof oldValue === typeof newValue
            ) {
                if (newValue === null) this.#applyInert();
                else this.#removeInert();
            }
        }


    } as unknown as TBase & Constructor<InertCapable>
}