/**
 * Entry point: wires the DOM to the view modules and performs first render.
 *
 * All event binding lives here so there is one place to see how the UI is
 * connected, and no behaviour is embedded in markup attributes.
 */

import { FOOD_SEARCH_DEBOUNCE_MS } from './config.js';
import { byId } from './dom.js';
import {
  confirmQuantity,
  handleFoodListClick,
  renderFoodToday,
  runFoodSearch,
  startScanner,
  stopScanner,
  updateQuantityPreview,
} from './nutrition.js';
import { renderProgress } from './progress.js';
import { storageAvailable } from './storage.js';
import {
  openProfileDialog,
  renderDashboard,
  refreshTargets,
  submitProfileForm,
  submitWeighIn,
  syncRateFieldVisibility,
} from './targets.js';
import { closeDialog, showToast } from './ui.js';
import {
  handleSetListClick,
  renderExerciseOptions,
  renderHistory,
  renderTodayList,
  submitSetForm,
} from './workouts.js';

/** Re-renders every view. Cheap enough at this data scale to keep simple. */
function renderAll() {
  renderExerciseOptions();
  renderTodayList();
  renderHistory();
  renderProgress();
  renderDashboard();
  renderFoodToday();
}

/** Re-renders only the nutrition surfaces. */
function renderNutrition() {
  renderDashboard();
  renderFoodToday();
}

/* -------------------------------------------------------------------------- */
/* Tab navigation                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Activates a tab and its panel, keeping ARIA state in step with the visuals.
 *
 * @param {HTMLElement} tab
 */
function activateTab(tab) {
  for (const button of document.querySelectorAll('.tab-btn')) {
    const selected = button === tab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }

  const targetId = `view-${tab.dataset.view}`;
  for (const panel of document.querySelectorAll('.view')) {
    panel.classList.toggle('active', panel.id === targetId);
  }

  if (tab.dataset.view === 'progress') renderProgress();
  if (tab.dataset.view === 'food') renderNutrition();
}

/**
 * Implements the standard tablist roving-focus keyboard pattern.
 *
 * @param {KeyboardEvent} event
 */
function handleTabKeydown(event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;

  const tabs = [...document.querySelectorAll('.tab-btn')];
  const current = tabs.indexOf(event.currentTarget);
  let next = current;

  if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else next = tabs.length - 1;

  event.preventDefault();
  tabs[next].focus();
  activateTab(tabs[next]);
}

/* -------------------------------------------------------------------------- */
/* Wiring                                                                     */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  for (const tab of document.querySelectorAll('.tab-btn')) {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', handleTabKeydown);
  }

  // Workout logging. Using a form means Enter submits, as users expect.
  byId('addSetForm').addEventListener('submit', (event) => {
    event.preventDefault();
    submitSetForm(renderAll);
  });
  byId('todayList').addEventListener('click', (event) => handleSetListClick(event, renderAll));
  byId('historyList').addEventListener('click', (event) => handleSetListClick(event, renderAll));

  byId('progressExercise').addEventListener('change', renderProgress);

  // Nutrition.
  byId('foodTodayList').addEventListener('click', (event) =>
    handleFoodListClick(event, renderNutrition),
  );

  let searchTimer = null;
  byId('foodSearchForm').addEventListener('submit', (event) => event.preventDefault());
  byId('foodSearchInput').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    const query = event.target.value.trim();
    searchTimer = setTimeout(() => runFoodSearch(query), FOOD_SEARCH_DEBOUNCE_MS);
  });

  byId('scanBarcodeBtn').addEventListener('click', startScanner);
  byId('closeScannerBtn').addEventListener('click', stopScanner);

  byId('addFoodGrams').addEventListener('input', updateQuantityPreview);
  byId('addFoodForm').addEventListener('submit', (event) => {
    event.preventDefault();
    confirmQuantity(renderNutrition);
  });
  byId('cancelAddFoodBtn').addEventListener('click', closeDialog);

  // Weight and targets.
  byId('weighInForm').addEventListener('submit', (event) => {
    event.preventDefault();
    submitWeighIn(renderNutrition);
  });
  byId('recalcTargetsBtn').addEventListener('click', () => {
    refreshTargets(true);
    renderNutrition();
    showToast('Targets recalculated.');
  });

  byId('openProfileBtn').addEventListener('click', openProfileDialog);
  byId('editProfileBtn').addEventListener('click', openProfileDialog);
  byId('cancelProfileBtn').addEventListener('click', closeDialog);
  byId('profileGoal').addEventListener('change', syncRateFieldVisibility);
  byId('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    submitProfileForm(renderNutrition);
  });

  // Clicking the backdrop of a dialog dismisses it.
  for (const dialog of document.querySelectorAll('[data-dialog-backdrop]')) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      if (dialog.id === 'scannerModal') stopScanner();
      else closeDialog();
    });
  }
}

/** Registers the service worker that makes the app usable offline. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

function init() {
  byId('todayDate').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  bindEvents();
  renderAll();
  registerServiceWorker();

  if (!storageAvailable) {
    showToast('Storage is blocked, so nothing you log will be saved.', 'error');
  }
}

init();
