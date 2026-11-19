/* eslint-disable baseline-js/use-baseline */
import { Backdrop } from "../../components/backdrop.js";
import { getFocusableExtremities } from "../../../utilities/get-focusable-extremities.js";
import type { Popover } from "./popover.mixin.js";
import { _getPrivateProp, _initPrivateProp, _setPrivateProp, SetOnceWeakMap } from "../../../../../tools/encapsulation.mjs";
import { type ExpandableChangeEvent, expandableChangeEvent } from "./expandable-change-event.js";
import { createMixin } from "../../../../../tools/create-mixin.mjs";
import type { Constructor } from "../../../../../tools/create-mixin.mjs";

// MIXIN PUBLIC INTERFACE ==============================================================
export interface Modal extends Popover { }

// #FIELDS ======================================================================
/** Mutation Observer to refresh focusables if needed. */
const _observer = new SetOnceWeakMap<Modal, MutationObserver>();
/** Native dialog element to wrap around expandable. */
const _nativeDialog = new SetOnceWeakMap<Modal, HTMLDialogElement>();

// POLYFILL =====================================
/** Backdrop of the modal. */
const _backdrop = new SetOnceWeakMap<Modal, Backdrop>();
/** First focusable element within the modal. */
const _firstFocusable = new WeakMap<Modal, HTMLElement>();
/** Last focusable element within the modal. */
const _lastFocusable = new WeakMap<Modal, HTMLElement>();
/** Controls the event listener for the focus trap. */
const _controller = new WeakMap<Modal, AbortController | null>();

/** Updates focusable elements contained within the modal */
function _updateFocusables(self: Modal): void {
    const { first, last } = getFocusableExtremities(self);
    _setPrivateProp(self, _firstFocusable, first);
    _setPrivateProp(self, _lastFocusable, last);
}
/** Activates the observer */
function _beginObserveFocusables(self: Modal) {
    _updateFocusables(self);
    _getPrivateProp(self, _observer).observe(self, { childList: true, subtree: true });
}
/** Stops the observer */
function _stopObserveFocusables(self: Modal) {
    _getPrivateProp(self, _observer).disconnect();
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
function _focusTrapEvent(this: Modal, e: KeyboardEvent): void {

    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === _getPrivateProp(this, _firstFocusable)) {
        e.preventDefault();
        _getPrivateProp(this, _lastFocusable).focus();
    } else if (!e.shiftKey && document.activeElement === _getPrivateProp(this, _lastFocusable)) {
        e.preventDefault();
        _getPrivateProp(this, _firstFocusable).focus();
    }
}
/**
 * - Start observing for changes to focusable elements
 * - Disables document scrolling
 * - Gives focus to modal
 * - Sets Focus Trap within the modal
 */
function _activateFocusTrap(self: Modal) {
    const signal = _setPrivateProp(self, _controller, new AbortController()).signal;
    _beginObserveFocusables(self);
    document.documentElement.style.overflow = 'hidden';
    _getPrivateProp(self, _firstFocusable).focus();
    self.addEventListener('keydown', _focusTrapEvent.bind(self), { signal });
}
/**
 * - Stop observing for changes to focusable elements
 * - Re-enables document scrolling
 * - Removes Focus Trap
 */
function _removeFocusTrap(self: Modal) {
    _stopObserveFocusables(self);
    document.documentElement.style.removeProperty('overflow');
    _getPrivateProp(self, _controller)?.abort();
    _setPrivateProp(self, _controller, null);
}

// NATIVE ==========================================
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
function _reflectOpenDialog(self: Modal) {
    _getPrivateProp(self, _nativeDialog).open
        ? self.show()
        : self.close();
}

// HELPERS =============================================================================
const BrowserSupportsDialog = !(document.createElement('dialog') instanceof HTMLUnknownElement);

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
export const Modal = createMixin<
    Popover, Modal
>('Modal', (brand) => <
    TBase extends Constructor<Popover>
>(Base: TBase, forceCustom?: boolean) => {
    if (forceCustom || !BrowserSupportsDialog)
        return class FocusTrap extends Base implements Modal {

            constructor(...args: any[]) {
                super(...args);
                brand.add(this);

                const placeholder = document.createElement('div');
                _initPrivateProp(this, _backdrop, new Backdrop('placeholder'));
                _initPrivateProp(this, _firstFocusable, placeholder);
                _initPrivateProp(this, _lastFocusable, placeholder);
                _initPrivateProp(this, _controller, new AbortController());

                // Observer for focusables mutations
                _initPrivateProp(this, _observer, new MutationObserver(() => _updateFocusables(this)));
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
                this.setAttribute('role', 'dialog');
                this.setAttribute('aria-haspopup', 'dialog');
                this.setAttribute('aria-modal', 'true');
                _updateFocusables(this);
            }

            // OPEN & CLOSE EXPANSION =======================================================
            override _onExpandableOpen(): void {
                super._onExpandableOpen?.();
                _getPrivateProp(this, _backdrop).show();
                _activateFocusTrap(this);
            }
            override _onExpandableClose(): void {
                super._onExpandableClose?.();
                _getPrivateProp(this, _backdrop).close();
                _removeFocusTrap(this);
            }

            /**     
             * - opens the modal and backdrop
             * - traps the focus in the modal
             * - gives focus to the modal's focusable
             * - locks the document's scrolling
             * @inheritdoc
             */
            override show() {
                return super.show();
            }
            /** 
             * - closes the modal and backdrop
             * - returns the focus to the document
             * - gives focus to the document's last focused
             * - unlocks the document's scrolling
             * @inheritdoc
             */
            override close() {
                return super.close();
            }
        };
    else {
        const NATIVE_DIALOG_STYLE = [
            'background-color: transparent',
            'border: 0', 'padding: 0', 'margin: 0',
            'max-width: none', 'max-height: none',
            'width: auto', 'height: auto'
        ].join('; ') + ';';
        return class NativeDialog extends Base implements Modal {

            constructor(...args: any[]) {
                super(...args);
                brand.add(this);

                const NATIVE_DIALOG = document.createElement('dialog');
                // make the dialog completely transparent
                NATIVE_DIALOG.setAttribute('style', NATIVE_DIALOG_STYLE);
                // let the popover class handle out of bounds and Esc closes
                NATIVE_DIALOG.closedBy = 'none';
                _initPrivateProp(this, _nativeDialog, NATIVE_DIALOG);
                _initPrivateProp(this, _observer, new MutationObserver(() => _reflectOpenDialog(this)));

                this.addEventListener(expandableChangeEvent, (e) => {
                    if (e.stage === 'start' && !e.open)
                        _getPrivateProp(this, _nativeDialog).showModal();
                });
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
                    // run once: wrap dialog around element
                    const parent = this.parentNode;
                    if (parent) parent.replaceChild(NATIVE_DIALOG, this);
                    else document.body.appendChild(NATIVE_DIALOG);
                    NATIVE_DIALOG.appendChild(this);
                }
                // fallback in case the dialog wrapper is closed manually or through attribute 
                _getPrivateProp(this, _observer).observe(NATIVE_DIALOG, { attributeFilter: ['open'] });
            }
            disconnectedCallback(): void {
                _getPrivateProp(this, _observer).disconnect();
            }
            override _onExpandableClose(): void {
                super._onExpandableClose?.();
                if (!this.open) _getPrivateProp(this, _nativeDialog).close();
            }
        }
    }
});