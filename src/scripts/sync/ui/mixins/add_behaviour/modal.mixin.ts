import { ValidationError } from "../../../../../errors/common-errors.js";
import { Backdrop } from "../../components/backdrop.js";
import { expandableCloseTransition, expandableOnTransitionEnd, expandableOpenTransition } from "./expandable.mixin.js";
import { getFocusableExtremities } from "../../../shared/getFocusableExtremities.js";
import type { Popover } from "./popover.mixin.js";
import { _getPrivateProp, _initPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.js";

// EXTENDED CONSTRUCTOR ================================================================
type Constructor<T extends {}> = new (...args: any[]) => T;

// OBFUSCATED PROPERTIES ===============================================================

// MIXIN PUBLIC INTERFACE ==============================================================
export interface Modal extends Popover { }

// PRIVATE FIELDS ======================================================================
/** Mutation Observer to refresh focusables if needed. */
const _observer = new SetOnceWeakMap<Modal, MutationObserver>();

// HELPERS =============================================================================
const BrowserSupportsDialog = document.createElement('dialog') instanceof HTMLUnknownElement;

// MIXIN FUNCTION ======================================================================
/**
 * Custom Modal Element.
 * 
 * Adds a focus trap to the element while it is open,
 * 
 * If browser supports `dialog` element, 
 * then a native dialog is wrapped around the element instead
 * of implementing its functions manually.
 * 
 * @remarks 
 * - *Requires a DOM environment*.
 * - The Focus Trap dinamically adapts to changes in the modal's subtree
 * 
 * {@link Modal}
 */
export function Modal<
    TBase extends Constructor<Popover>
>(Base: TBase) {
    if (!BrowserSupportsDialog)
        return class FocusTrap extends Base implements Modal {

            /** Backdrop of the modal. */
            private readonly backdrop: Backdrop;
            /** First focusable element within the modal. */
            private firstFocusable!: HTMLElement;
            /** Last focusable element within the modal. */
            private lastFocusable!: HTMLElement;
            /** Last focused element before focus trap activation. */
            private _lastFocus: HTMLElement | null = null;

            constructor(...args: any[]) {
                super(...args);
                brand(this);

                this.backdrop = new Backdrop('placeholder');
                this.setAttribute('role', 'dialog');
                this.setAttribute('aria-haspopup', 'dialog');
                this.setAttribute('aria-modal', 'true');
                // Observer for focusables mutations
                _initPrivateProp(this, _observer, new MutationObserver(() => this.updateFocusables()));
            }

            // DOM Insertion Callback =======================================================
            /**
             * Sets `role` to `dialog` and `aria-modal` to `true`
             * 
             * Updates focusable extremities
             * @inheritdoc
             */
            override connectedCallback(): void {
                super.connectedCallback();
                this.updateFocusables();
            }

            /** Updates focusable elements contained within the modal */
            private updateFocusables(): void {
                const { first, last } = getFocusableExtremities(this);
                this.firstFocusable = first;
                this.lastFocusable = last;
            }
            /** Activates the observer */
            private beginObserveFocusables() {
                this.updateFocusables();
                _getPrivateProp(this, _observer).observe(this, { childList: true, subtree: true });
            }
            /** Stops the observer */
            private stopObserveFocusables() {
                _getPrivateProp(this, _observer).disconnect();
            }

            // Last Focus ===================================================================
            private set lastFocus(element: any) {
                this._lastFocus = element instanceof HTMLElement
                    ? element : null;
            }
            private get lastFocus() {
                return this._lastFocus;
            }

            // OPEN & CLOSE EXPANSION =======================================================
            override[expandableOpenTransition](): void {
                super[expandableOpenTransition]();
                this.backdrop.show();
                this.activateFocusTrap();
            }
            override[expandableCloseTransition](): void {
                super[expandableCloseTransition]();
                this.backdrop.close();
                this.removeFocusTrap();
            }

            /** 
             * - **Traps focus** within an element's focusable children
             * - *When `Escape` key is pressed*:   
             * closes the modal
             * - *When `Tab` key is pressed*:   
             * if focus is on the lastFocusable element, moves it to the firstFocusable one within the modal
             * - *When `Tab` + `Shift` is pressed*:    
             * if focus is on the firstFocusable element, moves it to the lastFocusable one within the modal
             * @param {KeyboardEvent} e - Pressed key 
             */
            private focusTrapEvent = (e: KeyboardEvent): void => {

                if (e.key !== 'Tab') return;

                if (e.shiftKey && document.activeElement === this.firstFocusable) {
                    e.preventDefault();
                    this.lastFocusable.focus();
                } else if (!e.shiftKey && document.activeElement === this.lastFocusable) {
                    e.preventDefault();
                    this.firstFocusable.focus();
                }
            }

            /**
             * - Start observing for changes to focusable elements
             * - Disables document scrolling
             * - Stores currently focused element
             * - Gives focus to modal
             * - Sets Focus Trap within the modal
             */
            private activateFocusTrap() {
                this.beginObserveFocusables();
                document.documentElement.style.overflow = 'hidden';
                this.lastFocus = document.activeElement;
                this.firstFocusable.focus();
                this.addEventListener('keydown', this.focusTrapEvent);
            }
            /**
             * - Stop observing for changes to focusable elements
             * - Re-enables document scrolling
             * - Gives focus back to stored focused element
             * - Gives focus to modal
             * - Removes Focus Trap
             */
            private removeFocusTrap() {
                this.stopObserveFocusables();
                document.documentElement.style.removeProperty('overflow');
                if (this.lastFocus) this.lastFocus.focus();
                this.lastFocus = null;
                this.removeEventListener('keydown', this.focusTrapEvent);
            }

            /**     
             * - opens the modal and backdrop
             * - traps the focus in the modal
             * - gives focus to the modal's focusable
             * - locks the document's scrolling
             * @inheritdoc
             */
            override show(...callbacks: (() => void)[]) {
                super.show(...callbacks);
            }
            /** 
             * - closes the modal and backdrop
             * - returns the focus to the document
             * - gives focus to the document's last focused
             * - unlocks the document's scrolling
             * @inheritdoc
             */
            override close(...callbacks: (() => void)[]) {
                super.close(...callbacks);
            }
        };
    else {
        const _nativeDialog = new SetOnceWeakMap<Modal, HTMLDialogElement>();
        return class NativeDialog extends Base implements Modal {

            constructor(...args: any[]) {
                super(...args);
                brand(this);

                const NATIVE_DIALOG = document.createElement('dialog');
                // make the dialog completely transparent
                NATIVE_DIALOG.setAttribute('style', [
                    'background-color: transparent',
                    'border: 0', 'padding: 0',
                    'margin: 0'
                ].join(';'));
                // let the popover class handle out of bounds and Esc closes
                NATIVE_DIALOG.closedBy = 'none';
                _initPrivateProp(this, _nativeDialog, NATIVE_DIALOG);

                _initPrivateProp(this, _observer, new MutationObserver(() => this.reflectOpenDialog()));
            }
            /**
             * Wraps the element in a native dialog element to handle
             * modal-specific behaviour.
             * 
             * The native dialog'`open` attribute is observed to reflect changes on the element
             * @inheritdoc
             */
            override connectedCallback(): void {
                super.connectedCallback();
                const NATIVE_DIALOG = _getPrivateProp(this, _nativeDialog);
                if (!NATIVE_DIALOG.contains(this)) {
                    // run once
                    const parent = this.parentNode;
                    if (parent) parent.replaceChild(NATIVE_DIALOG, this);
                    else document.body.appendChild(NATIVE_DIALOG);
                    NATIVE_DIALOG.appendChild(this);
                    // fallback in case the dialog wrapper is closed manually or through attribute 
                    _getPrivateProp(this, _observer).observe(NATIVE_DIALOG, { attributeFilter: ['open'] });
                }
            }
            override[expandableOpenTransition](): void {
                _getPrivateProp(this, _nativeDialog).showModal();
                super[expandableOpenTransition]();
            }
            override[expandableOnTransitionEnd](): void {
                super[expandableOnTransitionEnd]();
                if (!this.isOpen) _getPrivateProp(this, _nativeDialog).close();
            }

            /** 
             * Reflects the dialog's open state on the inner element
             * if it has been set from the outside
             * 
             * @remarks
             * The lock is released only on transition end, 
             * meaning that, if it the attribute is changed immediately
             * after the transition has ended, it is a valid change
             * and triggers a transition
            */
            private reflectOpenDialog() {
                if (this.isLocked) return;
                _getPrivateProp(this, _nativeDialog).open
                    ? this.show()
                    : this.close();
            }
        }
    }
}

// EXPORTED NAMESPACE ==================================================================
export namespace Modal {
    /**
     * Validates an element as a `Modal`
     * 
     * @param that - Element that needs to be validated
     * @returns the validated element
     * 
     * @throws {ValidationError} If the element passed as argument 
     * has not been branded as a `Modal`
     */
    export function getValidated(that: Popover): Modal {
        if (branded.has(that)) return that as Modal;
        else throw new ValidationError(
            `${that.constructor.name} does not extend ${Modal.name}`
        );
    }
}

// PRIVATE INTERNAL IDENTIFICATION =====================================================
/** Holds all branded instances of `Modal`. */
const branded = new WeakSet();
/** Brands an element as an instance of `Modal`. */
function brand(toBrand: Modal) {
    branded.add(toBrand);
}