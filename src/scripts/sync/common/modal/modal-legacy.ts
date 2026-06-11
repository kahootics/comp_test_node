
export const backdrop = document.getElementById('modal-backdrop');
const DURATION = 500;
backdrop?.style.setProperty('--js-calc-duration',`${DURATION}ms`)

const allModalOpeners = document.querySelectorAll('[aria-haspopup][aria-controls]');

const FOCUSABLES = 'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
const FOCUSABLES_NO_CLOSER = 'a, button:not(.modal-closer), input, textarea, select, [tabindex]:not([tabindex="-1"])';

let lastFocus: Element | null;

let releaseFocusTrap: Function | null;

if(allModalOpeners && backdrop) {
    allModalOpeners.forEach((opener) => {
        const modalId = opener.getAttribute('aria-controls');
        if(!modalId) throw new Error(`Opener ${opener.id} has no associated modal`);
        const modal = document.getElementById(modalId);
        if(!modal) throw new Error(`Opener ${opener.id} has no associated modal`);
        const closer = document.getElementById(`${modal.id}-closer`);
        if(!closer) throw new Error(`Id of closer for modal ${modal.id} is not correct or the element does not exist`);
        
        opener.addEventListener('click', () => openModal(modal, backdrop, closer));
        closer.addEventListener('click', () => closeModal(modal, backdrop));
        backdrop.addEventListener('click', (e) => {
            if(e.target === backdrop) closeModal(modal, backdrop);
        });
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal(modal, backdrop);
        });
        
    });
}


/**
 * Traps focus within an element's focusable children
 * @param modal - HTMLElement that has role: dialog
 * @returns a function that removes the focusTrapEvent
 */
function trapFocus(modal: HTMLElement) {
    const focusables = modal.querySelectorAll<HTMLElement>(FOCUSABLES);

    const first = focusables[0];
    const last = focusables[focusables.length - 1];    

    /**
     * 
     * When Tab key is pressed:
     * if focus is on the last focusable element, moves it to the first one within the modal
     * 
     * When Tab + Shift is pressed: 
     * if focus is on the first focusable element, moves it to the last one within the modal
     * 
     * @param e - Pressed key Event object
     */
    function focusTrapEvent(e: KeyboardEvent): void {

        if(!(first && last)) throw new Error('Modal has no focusable element');;
    
        if (e.key !== 'Tab') return;

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    
    }

    modal.addEventListener('keydown',focusTrapEvent);
    return (() => modal.removeEventListener('keydown',focusTrapEvent));
}

export function openModal(modal: HTMLElement, backdrop: HTMLElement, closer: HTMLElement) {
    backdrop.hidden = false;
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    lastFocus = document.activeElement;
    requestAnimationFrame(() => modal.setAttribute('data-shown', 'true'));
    releaseFocusTrap = trapFocus(modal);
    const focusable = modal.querySelector(FOCUSABLES_NO_CLOSER);
    focusable instanceof HTMLElement ? focusable.focus() : closer.focus();
}

export function closeModal(modal: HTMLElement, backdrop: HTMLElement) {
    requestAnimationFrame(() => modal.setAttribute('data-shown', 'false'));
    document.documentElement.style.removeProperty('overflow');
    if(lastFocus && lastFocus instanceof HTMLElement) lastFocus.focus();
    if(releaseFocusTrap instanceof Function) releaseFocusTrap();
    setTimeout(() => {
        modal.hidden = true;
        backdrop.hidden = true;
    }, DURATION);

}



