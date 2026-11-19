import { createMixin } from "../../../../../tools/create-mixin.mjs";
import { _getPrivateProp, _initPrivateProp } from "../../../../../tools/encapsulation.mjs";
import { getAllFocusables } from "../../../utilities/get-focusable-extremities.js";
import type { Constructor } from "../../../../../tools/create-mixin.mjs";

// EXTENDED CONSTRUCTOR ================================================================
type Constructed = HTMLElement & {
    connectedCallback?(): void;
    attributeChangedCallback?(n: string, o: string | null, v: string | null): void;
}
// HELPERS =============================================================================
export interface InertCapable { inert: boolean }
var polyfillStylesInjected: boolean;

// PRIVATE FIELDS ======================================================================
const _focusables = new WeakMap<Constructed & InertCapable, Map<Element, string | null>>()

function _applyInert(self: Constructed & InertCapable): void {
    InertPolyfill.assertBranded(self);
    const focusables = getAllFocusables(self);
    const myFocusables = _getPrivateProp(self, _focusables);
    myFocusables.clear;
    focusables.forEach(f => {
        myFocusables.set(f, f.getAttribute('tabindex'));
        f.setAttribute('tabindex', '-1');
    })
}

function _removeInert(self: Constructed & InertCapable): void {
    InertPolyfill.assertBranded(self);
    _getPrivateProp(self, _focusables).forEach((tabI, el) => {
        if (tabI) el.setAttribute('tabindex', tabI);
        else el.removeAttribute('tabindex');
    })
}

// MIXIN FUNCTION ======================================================================
/**
 * Polyfill Inert Mixin to generate a new custom HTMLElement with inert if it is not defined.
 * 
 * @remarks
 * This does not redefine `HTMLElement` in case it did not implement `inert`
 */
export const InertPolyfill = createMixin<
    Constructed, InertCapable & Constructed
>('InertPolyfill', (brand) => <
    TBase extends Constructor<Constructed> & {
        observedAttributes?: readonly string[]
    }
>(Base: TBase): TBase & Constructor<InertCapable> => {
    if ('inert' in HTMLElement.prototype)
        return class extends Base implements InertCapable {
            constructor(...args: any[]) {
                super(...args);
                brand.add(this);
            }
        } as TBase & Constructor<InertCapable>;

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

        constructor(...args: any[]) {
            super(...args);
            brand.add(this);

            _initPrivateProp(this, _focusables, new Map());
        }

        public override get inert(): boolean { 
            return this.hasAttribute('inert'); 
        }
        public override set inert(v: boolean) { 
            this.toggleAttribute('inert', v); 
        }

        /** Element's observed attributes. */
        static override get observedAttributes(): string[] {
            return [
                ...(super.observedAttributes ?? []),
                'open', 'hidden'
            ];
        }

        override connectedCallback() {
            super.connectedCallback?.();
            // eslint-disable-next-line baseline-js/use-baseline
            if (this.inert) _applyInert(this);
        }

        override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
            super.attributeChangedCallback?.(name, oldValue, newValue);
            if (name === 'inert' &&
                (oldValue === null) !== (newValue === null)
            ) {
                if (newValue === null) _applyInert(this);
                else _removeInert(this);
            }
        }
    }
});