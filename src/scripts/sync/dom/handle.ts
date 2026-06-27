import { getValidatedElement } from "../shared/utilities.js";
import Modal from "./modal.js";

interface HandleTarget {
    style: CSSStyleDeclaration,
    id: string,
    close: () => void,
    open: () => void
}

abstract class Handle<
    H extends HTMLElement = HTMLElement,
    T extends HandleTarget = HandleTarget
> {
    protected readonly handle: H;
    protected readonly target: T;

    private readonly onPointerDown = (e: PointerEvent) => this.handleTouchStart(e);
    private readonly onPointerMove = (e: PointerEvent) => this.handleTouchMove(e);
    private readonly onPointerUp   = (e: PointerEvent) => this.handleTouchEnd(e);

    protected isValid(e: PointerEvent) {
        return e.isPrimary && e.pointerType !== 'mouse';
    }

    constructor(
        handle: string | H,
        handleType: new (...args: unknown[]) => H,
        target: T
    ) {
        this.handle = getValidatedElement(handleType, handle);
        this.target  = target;
        this.handle.setAttribute('aria-controls', target.id);
    }

    public enable() {
        this.handle.style.setProperty('visibility', 'visible');
        this.handle.addEventListener('pointerdown', this.onPointerDown);
        this.handle.addEventListener('pointermove', this.onPointerMove);
        this.handle.addEventListener('pointerup',   this.onPointerUp);
    }

    public disable() {
        this.handle.style.setProperty('visibility', 'hidden');
        this.handle.removeEventListener('pointerdown', this.onPointerDown);
        this.handle.removeEventListener('pointermove', this.onPointerMove);
        this.handle.removeEventListener('pointerup',   this.onPointerUp);
        this.reset();
    }

    protected abstract reset(): void;

    protected abstract handleTouchStart(e: PointerEvent): void;
    protected abstract handleTouchMove(e: PointerEvent): void;
    protected abstract handleTouchEnd(e: PointerEvent): void;
}

interface HasNumberProperties {
    [key: string]: number
}
interface VerticalFadeHandleOptions extends HasNumberProperties  {
    closeThresholdYPercentage: number,
    minOpacity: number
}

function isUnitary(val: number) {
    return val <= 1 && val >= 0;
}
function hasUnitaryProperties(target: HasNumberProperties):boolean {
    return Object.values(target).every(isUnitary);
}

class VerticalFadeHandle extends Handle {

    private startY: number | null = null;
    private currentY: number = 0;

    private readonly CLOSE_THRESHOLD_Y_PERCENTAGE: number;
    private readonly MIN_OPACITY: number;

    constructor(
        handle: string | HTMLElement, 
        target: HandleTarget,
        options?: VerticalFadeHandleOptions
    ) {
        super(handle, HTMLElement, target);
        if(options && !hasUnitaryProperties(options))
            throw new Error(
                "Vertical handle's options must be not smaller than 0 and not greater than 1"
        );
        this.CLOSE_THRESHOLD_Y_PERCENTAGE = options?.closeThresholdYPercentage ?? 0.25;
        this.MIN_OPACITY = options?.minOpacity ?? 0.2;
    }

    private get closingThresholdY() {
        return this.CLOSE_THRESHOLD_Y_PERCENTAGE * window.innerHeight;
    }

    private setTop(dY: number) {
        this.target.style.setProperty('top', `${dY}px`);
        if(this.MIN_OPACITY !== 1) 
            this.target.style.setProperty(
                'opacity',
                `clamp(${this.MIN_OPACITY}, ${1 - dY / this.closingThresholdY}, 1)`
            );
    }

    private unsetTop() {
        this.target.style.removeProperty('top');
        this.target.style.removeProperty('opacity');
    }

    private applyDrag(dY: number) {
        dY > 0 ? this.setTop(dY) : this.unsetTop();
    }

    protected override reset() {
        this.startY   = null;
        this.currentY = 0;
        this.unsetTop();
    }

    protected handleTouchStart(e: PointerEvent) {
        if(!this.isValid(e)) return;
        this.startY = e.clientY;
    }

    protected handleTouchMove(e: PointerEvent) {
        if (!this.isValid(e) || this.startY === null) return;
        this.currentY = e.clientY;
        this.applyDrag(this.currentY - this.startY);
    }

    protected handleTouchEnd(e: PointerEvent) {
        if (!this.isValid(e) || this.startY === null) return;

        if (this.currentY - this.startY > this.closingThresholdY) {
                this.target.close();
        } else {
            this.unsetTop();
        }
        this.reset();
    }
}

class DraggableModal extends Modal {
    private readonly modalHandle: VerticalFadeHandle;
    constructor(
        modal: string | HTMLElement, 
        modalCloser: string | HTMLButtonElement,
        modalHandle: string | HTMLElement
    ) {
        super(modal, modalCloser);
        this.modalHandle = new VerticalFadeHandle(modalHandle, this);
    }
    override open(...callbacks: (() => void)[]): void {
        super.open(() => this.modalHandle.enable(), ...callbacks);
    }
    override close(...callbacks: (() => void)[]): void {
        super.close(...callbacks);
        this.modalHandle.disable();
    }
}