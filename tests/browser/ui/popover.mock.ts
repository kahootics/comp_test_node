/**
 * Test doubles for the Expandable and Popover mixins, written from their documented behaviour:
 * - `open` is a boolean attribute telling the state; `show()` and `close()` do what they say;
 * - `addController(el, { toggleOnClick })` registers a controller whose click opens the popover,
 *   keeps its `aria-controls` / `aria-expanded` in sync, and is idempotent for the same settings;
 * - the popover closes on any interaction outside its boundaries.
 */
type Ctor<T extends HTMLElement = HTMLElement> = new (...args: any[]) => T;

export function Expandable<T extends Ctor>(Base: T) {
    return class ExpandableElement extends Base {
        get open(): boolean { return this.hasAttribute('open'); }
        set open(v: boolean) { this.toggleAttribute('open', v); }
        show(): void { this.open = true; }
        close(): void { this.open = false; }
    };
}

export interface ControllerOptions { toggleOnClick?: boolean }

let nextId = 0;

export function Popover<T extends Ctor<HTMLElement & { open: boolean; show(): void; close(): void }>>(Base: T) {
    return class PopoverElement extends Base {
        readonly #controllers = new Map<HTMLElement, { toggleOnClick: boolean }>();

        readonly #onControllerClick = () => { if (!this.open) this.show(); };
        readonly #onOutside = (e: Event) => {
            const target = e.target as Node;
            if (!this.open || this.contains(target)) return;
            for (const controller of this.#controllers.keys()) 
                if (controller.contains(target)) return;
            this.close();
        };

        constructor(...args: any[]) {
            super(...args);
            document.addEventListener('click', this.#onOutside);
        }
        
        static get observedAttributes(): string[] {
            return [             'open'         ];
        }

        _onExpandableOpen() {}
        _onExpandableClose() {}
        _onExpandableTransitionEnd() {}
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
            if (
                name === 'open' &&
                (oldValue === null) !== (newValue === null)
            ) {
                if (!this.isConnected) return;
                if (this.open)
                this._onExpandableOpen?.();
                else 
                    this._onExpandableClose?.();
                this._onExpandableTransitionEnd?.();
            }
        }

        override show(): void { super.show(); this.#syncControllers(); }
        override close(): void { super.close(); this.#syncControllers(); }

        addController(el: HTMLElement, options: ControllerOptions = {}): void {
            const toggleOnClick = options.toggleOnClick ?? false;
            const previous = this.#controllers.get(el);
            if (previous && previous.toggleOnClick === toggleOnClick) return; // idempotent
            if (previous?.toggleOnClick) el.removeEventListener('click', this.#onControllerClick);
            this.#controllers.set(el, { toggleOnClick });
            if (toggleOnClick) el.addEventListener('click', this.#onControllerClick);
            if (!this.id) this.id = `popover-${nextId++}`;
            el.setAttribute('aria-controls', this.id);
            el.setAttribute('aria-expanded', String(this.open));
        }

        #syncControllers() {
            for (const controller of this.#controllers.keys())
                controller.setAttribute('aria-expanded', String(this.open));
        }
    };
}