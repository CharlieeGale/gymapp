/**
 * Shared UI behaviour: non-blocking status messages and accessible dialogs.
 *
 * `alert()` is deliberately not used anywhere in the app. It blocks the main
 * thread, cannot be styled, is dismissed differently on every platform, and on
 * iOS standalone PWAs it is easy to miss entirely.
 */

import { TOAST_DURATION_MS } from './config.js';
import { byId, el } from './dom.js';

let toastTimer = null;

/**
 * Shows a transient message in the live region at the top of the app.
 *
 * @param {string} message
 * @param {'info'|'error'} [tone]
 */
export function showToast(message, tone = 'info') {
  const host = byId('toast');
  host.replaceChildren(el('div', { class: `toast toast--${tone}`, text: message }));
  host.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    host.replaceChildren();
    host.hidden = true;
  }, TOAST_DURATION_MS);
}

/* -------------------------------------------------------------------------- */
/* Dialogs                                                                    */
/* -------------------------------------------------------------------------- */

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** @type {{element: HTMLElement, previousFocus: Element|null, onClose: (() => void)|null}|null} */
let openDialog = null;

/**
 * Keeps Tab focus inside the open dialog and closes it on Escape.
 *
 * @param {KeyboardEvent} event
 */
function handleDialogKeydown(event) {
  if (!openDialog) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = [...openDialog.element.querySelectorAll(FOCUSABLE)].filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Opens a modal dialog: shows it, moves focus into it, traps Tab, and marks the
 * rest of the app inert for assistive technology.
 *
 * @param {string} id Element id of the dialog root.
 * @param {{initialFocus?: string, onClose?: () => void}} [options]
 */
export function openDialogById(id, options = {}) {
  if (openDialog) closeDialog();

  const element = byId(id);
  const previousFocus = document.activeElement;

  element.hidden = false;
  byId('app-root').setAttribute('aria-hidden', 'true');
  document.body.classList.add('has-dialog');

  openDialog = { element, previousFocus, onClose: options.onClose ?? null };
  document.addEventListener('keydown', handleDialogKeydown);

  const target = options.initialFocus
    ? element.querySelector(options.initialFocus)
    : element.querySelector(FOCUSABLE);
  if (target instanceof HTMLElement) target.focus();
}

/** Closes the currently open dialog and restores focus to whatever opened it. */
export function closeDialog() {
  if (!openDialog) return;

  const { element, previousFocus, onClose } = openDialog;
  openDialog = null;

  document.removeEventListener('keydown', handleDialogKeydown);
  element.hidden = true;
  byId('app-root').removeAttribute('aria-hidden');
  document.body.classList.remove('has-dialog');

  if (previousFocus instanceof HTMLElement) previousFocus.focus();
  if (onClose) onClose();
}

/**
 * True when the given dialog is the one currently open.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isDialogOpen(id) {
  return openDialog !== null && openDialog.element.id === id;
}
