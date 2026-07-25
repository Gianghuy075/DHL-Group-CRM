let previousFocus = null;
// Fires once when the CURRENT modal is dismissed (× / overlay / Modal.close()).
// Reset on every open() so it only ever belongs to the modal on screen.
let onCloseHook = null;

export const Modal = {
  mount() {
    document.querySelector('[data-modal-close]')?.addEventListener('click', Modal.close);
    document.querySelector('[data-modal-overlay]')?.addEventListener('click', (event) => {
      if (event.target.matches('[data-modal-overlay]')) Modal.close();
    });
  },

  open({ title, body, className = '', onClose = null }) {
    const overlay = document.querySelector('[data-modal-overlay]');
    const modal = document.querySelector('[data-modal]');
    if (overlay?.classList.contains('hidden')) {
      previousFocus = document.activeElement;
    }
    if (modal) {
      modal.className = ['modal', className].filter(Boolean).join(' ');
    }
    onCloseHook = onClose;
    document.querySelector('[data-modal-title]').textContent = title;
    document.querySelector('[data-modal-body]').innerHTML = body;
    overlay?.classList.remove('hidden');
    document.querySelector('[data-modal-close]')?.focus();
  },

  close() {
    const hook = onCloseHook;
    onCloseHook = null;
    document.querySelector('[data-modal-overlay]')?.classList.add('hidden');
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    previousFocus = null;
    if (typeof hook === 'function') hook();
  },
};
