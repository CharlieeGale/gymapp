/**
 * Food logging: name search, barcode scanning, the quantity dialog, and the
 * list of what has been eaten today.
 */

import { FOOD_SEARCH_MIN_CHARS, ZXING_MODULE_URL } from './config.js';
import { byId, el, renderList } from './dom.js';
import { FoodApiError, lookupBarcode, searchFoods } from './food-api.js';
import { addFoodEntry, getFoodEntries, removeFoodEntry } from './state.js';
import { toFiniteNumber, todayISO } from './utils.js';
import { closeDialog, isDialogOpen, openDialogById, showToast } from './ui.js';

/** @type {import('./food-api.js').FoodItem|null} */
let pendingItem = null;

/** @type {{stop: () => void}|null} */
let scannerControls = null;

/* -------------------------------------------------------------------------- */
/* Today's food list                                                          */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} entry
 * @returns {HTMLElement}
 */
function buildFoodRow(entry) {
  const deleteButton = el('button', {
    class: 'del-btn',
    text: '✕',
    attrs: { type: 'button', 'aria-label': `Remove ${entry.name}` },
    dataset: { action: 'delete-food', id: entry.id },
  });

  return el('div', { class: 'set-row', dataset: { id: entry.id } }, [
    el('div', {}, [
      el('div', { class: 'ex-name', text: entry.name }),
      el('div', { class: 'ex-sub', text: `${Math.round(entry.grams)} g` }),
    ]),
    el('div', { class: 'row-actions' }, [
      el('div', { class: 'ex-detail' }, [
        String(Math.round(entry.kcal)),
        el('span', { class: 'unit', text: ' kcal' }),
      ]),
      deleteButton,
    ]),
  ]);
}

/** Renders today's food entries, newest first. */
export function renderFoodToday() {
  const today = todayISO();
  const rows = getFoodEntries()
    .filter((entry) => entry.date === today)
    .sort((a, b) => b.ts - a.ts)
    .map(buildFoodRow);

  renderList(byId('foodTodayList'), rows, 'No food logged yet today.');
}

/**
 * Handles clicks on any remove control in the food list.
 *
 * @param {Event} event
 * @param {() => void} onChange
 */
export function handleFoodListClick(event, onChange) {
  const button = event.target.closest('[data-action="delete-food"]');
  if (!button) return;
  removeFoodEntry(button.dataset.id);
  onChange();
}

/* -------------------------------------------------------------------------- */
/* Quantity dialog                                                            */
/* -------------------------------------------------------------------------- */

/** Recomputes the calorie preview from the grams field. */
export function updateQuantityPreview() {
  const grams = toFiniteNumber(byId('addFoodGrams').value) ?? 0;
  const kcal = pendingItem ? (pendingItem.kcal100 / 100) * grams : 0;
  byId('addFoodKcalValue').textContent = String(Math.round(kcal));
}

/**
 * Opens the quantity dialog for a chosen product.
 *
 * @param {import('./food-api.js').FoodItem} item
 */
function openQuantityDialog(item) {
  pendingItem = item;
  byId('addFoodName').textContent = item.brand ? `${item.name} (${item.brand})` : item.name;
  byId('addFoodGrams').value = '100';
  updateQuantityPreview();
  openDialogById('addFoodModal', {
    initialFocus: '#addFoodGrams',
    onClose: () => {
      pendingItem = null;
    },
  });
}

/**
 * Saves the pending item at the chosen quantity.
 *
 * @param {() => void} onChange
 */
export function confirmQuantity(onChange) {
  if (!pendingItem) return;

  const grams = toFiniteNumber(byId('addFoodGrams').value);
  if (grams === null || grams <= 0) {
    showToast('Enter an amount in grams.', 'error');
    byId('addFoodGrams').focus();
    return;
  }

  const factor = grams / 100;
  const name = pendingItem.name;

  addFoodEntry({
    name,
    grams,
    kcal: pendingItem.kcal100 * factor,
    protein: pendingItem.protein100 * factor,
    carbs: pendingItem.carbs100 * factor,
    fat: pendingItem.fat100 * factor,
  });

  closeDialog();
  byId('foodSearchInput').value = '';
  byId('foodSearchResults').replaceChildren();
  showToast(`Added ${name}.`);
  onChange();
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Runs a name search and renders the results as selectable buttons.
 *
 * Results are buttons rather than clickable `div`s so they are reachable by
 * keyboard and announced as controls by screen readers.
 *
 * @param {string} query
 */
export async function runFoodSearch(query) {
  const resultsEl = byId('foodSearchResults');

  if (query.length < FOOD_SEARCH_MIN_CHARS) {
    resultsEl.replaceChildren();
    return;
  }

  try {
    const products = await searchFoods(query);

    if (products.length === 0) {
      renderList(resultsEl, [], 'No matches. Try a different search term.');
      return;
    }

    resultsEl.replaceChildren(
      ...products.map((product) => {
        const kcalNote = product.kcal100 ? ` · ${Math.round(product.kcal100)} kcal/100g` : '';
        const button = el('button', { class: 'search-result-row', attrs: { type: 'button' } }, [
          el('span', { class: 'sr-name', text: product.name }),
          el('span', { class: 'sr-sub', text: `${product.brand}${kcalNote}`.trim() }),
        ]);
        button.addEventListener('click', () => openQuantityDialog(product));
        return button;
      }),
    );
  } catch (error) {
    const message =
      error instanceof FoodApiError ? error.message : 'Search failed. Check your connection.';
    renderList(resultsEl, [], message);
  }
}

/* -------------------------------------------------------------------------- */
/* Barcode scanner                                                            */
/* -------------------------------------------------------------------------- */

/** Stops the camera stream and closes the scanner overlay. */
export function stopScanner() {
  if (scannerControls) {
    try {
      scannerControls.stop();
    } catch (error) {
      // The reader is already torn down; nothing further to release.
      console.warn('Scanner stop failed', error);
    }
    scannerControls = null;
  }
  if (isDialogOpen('scannerModal')) closeDialog();
}

/**
 * Looks up a scanned barcode and opens the quantity dialog for it.
 *
 * @param {string} barcode
 */
async function handleScannedCode(barcode) {
  try {
    openQuantityDialog(await lookupBarcode(barcode));
  } catch (error) {
    const message =
      error instanceof FoodApiError
        ? `${error.message} Try searching by name instead.`
        : 'Lookup failed. Try searching by name instead.';
    showToast(message, 'error');
  }
}

/**
 * Opens the camera and starts decoding barcodes.
 *
 * The decoder is loaded on demand from a pinned CDN build, so the ~200 KB
 * module is only fetched when someone actually scans. It is unavailable
 * offline, and the failure is reported as such.
 */
export async function startScanner() {
  openDialogById('scannerModal', { initialFocus: '#closeScannerBtn' });

  try {
    const { BrowserMultiFormatReader } = await import(ZXING_MODULE_URL);
    const reader = new BrowserMultiFormatReader();
    scannerControls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      byId('scannerVideo'),
      (result) => {
        if (!result) return;
        const code = result.getText();
        stopScanner();
        handleScannedCode(code);
      },
    );
  } catch (error) {
    stopScanner();
    const offline = !navigator.onLine;
    showToast(
      offline
        ? 'Barcode scanning needs a connection. Search by name instead.'
        : 'Could not access the camera. Search by name instead.',
      'error',
    );
    console.warn('Scanner failed to start', error);
  }
}
