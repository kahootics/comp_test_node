import { IllegalArgumentError } from "../../../errors/common-errors.mjs";
//import { MicrotaskScheduler } from "../../../tools/microtask-scheduler.mjs";

export interface GetAboveOptions {
    /** SSSS */
    fromTop: boolean;
}

function _validateCSSVar(cssVar: string) {
    if(!cssVar.startsWith('--'))
            throw new IllegalArgumentError(`A CSS variable must begin with "--", but "${cssVar}" does not`);
        if(cssVar.length < 3) {
            throw new IllegalArgumentError(`A CSS variable must have at least 3 characters, but "${cssVar}" does not`);
        }
        
}

export class ContextStack {
    #stackVar;
    get stackVar() { return this.#stackVar; }
    set stackVar(sVar: string) {
        _validateCSSVar(sVar);
        this.#prune();
        this.#stackVar = sVar;
        this.#prune();
        this.#refreshVars();
    }
    readonly #stack: HTMLElement[] = [];

    #removeAt(start: number, deleteCount?: number): HTMLElement[] {
        const _stack = this.#stack;
        if (start < 0 || _stack.length <= start) return [];
        //this.#refresher.schedule();
        const deleted = _stack.splice(start, deleteCount ?? 1);
        deleted.forEach(
            d => d.style.removeProperty(this.#stackVar)
        );
        this.#refreshVars();
        return deleted;
    }
    #prune(): void {
        const _stack = this.#stack;
        for (let i = _stack.length - 1; i >= 0; i--) {
            const pop = _stack[i];
            if (!pop || !pop.isConnected || pop.hidden)
                this.#removeAt(i);
        }
    }
    //#refresher = new MicrotaskScheduler(() => this.#refreshVars());
    #refreshVars() {
        const stackVar = this.#stackVar;
        this.#stack.forEach((pop, i) => {
            pop.style.setProperty(stackVar, String(i+1));
        });
    }

    // SETUP ==================================
    public constructor(stackingVariableName: string) {
        _validateCSSVar(stackingVariableName);
        this.#stackVar = stackingVariableName;
    }

    // ACCESSORS ===============================

    get size(): number {
        this.#prune();
        return this.#stack.length;
    }
    get top(): HTMLElement | undefined {
        const maxI = this.size - 1;
        return this.#stack[maxI];
    }
    public isTop(el: HTMLElement): boolean {
        return this.top === el;
    }
    public indexOf(el: HTMLElement) {
        this.#prune();
        return this.#stack.indexOf(el);
    }

    public remove(el: HTMLElement): boolean {
        const i = this.#stack.indexOf(el);
        const res = this.#removeAt(i);
        if (res.length === 1 && res[0] === el) 
            return true;
        return false;
    }

    public push(el: HTMLElement): number {
        const i = this.indexOf(el);
        this.#removeAt(i);
        const res = this.#stack.push(el);
        this.#refreshVars();
        return res;
    }

    public above(
        el: HTMLElement, 
        options: GetAboveOptions = { 
            fromTop: true 
        }
    ): HTMLElement[] {
        const i = this.indexOf(el);
        return i >= 0
            ? (options.fromTop ? this.#stack.slice(i + 1).reverse() : this.#stack.slice(i + 1))
            : [];
    }

    public clear(): void {
        this.#stack.splice(0)
            .forEach(d => d.style.removeProperty(this.#stackVar));
    }

}