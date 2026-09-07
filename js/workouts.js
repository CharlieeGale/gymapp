/**
 * Workout logging: the Log view's entry form and today's list, plus the History
 * view. Both lists share one row builder rather than carrying duplicate markup.
 */

import { byId, el, renderList } from './dom.js';
import { addSet, getExerciseNames, getSets, removeSet } from './state.js';
import { formatDate, groupBy, toFiniteNumber, todayISO } from './utils.js';
import { showToast } from './ui.js';

/**
 * Builds the "80 kg × 5 × 3 sets" detail line.
 *
 * @param {object} set
 * @returns {HTMLElement}
 */
function buildDetail(set) {
  const detail = el('div', { class: 'ex-detail' }, [
    String(set.weight),
    el('span', { class: 'unit', text: 'kg' }),
    ` × ${set.reps}`,
  ]);
  if (set.setCount > 1) {
    detail.append(` × ${set.setCount}`, el('span', { class: 'unit', text: ' sets' }));
  }
  return detail;
}

/**
 * Builds one logged-set row.
 *
 * The delete control carries the record id in a data attribute and is handled
 * by a delegated listener, so no markup-embedded `onclick` is needed and the
 * app stays compatible with a strict Content-Security-Policy.
 *
 * @param {object} set
 * @returns {HTMLElement}
 */
function buildSetRow(set) {
  const deleteButton = el('button', {
    class: 'del-btn',
    text: '✕',
    attrs: {
      type: 'button',
      'aria-label': `Delete ${set.exercise}, ${set.weight} kg for ${set.reps} reps`,
    },
    dataset: { action: 'delete-set', id: set.id },
  });

  return el('div', { class: 'set-row', dataset: { id: set.id } }, [
    el('div', { class: 'ex-name', text: set.exercise }),
    el('div', { class: 'row-actions' }, [buildDetail(set), deleteButton]),
  ]);
}

/** Refreshes the exercise autocomplete list and the progress-view picker. */
export function renderExerciseOptions() {
  const names = getExerciseNames();

  byId('exerciseOptions').replaceChildren(
    ...names.map((name) => el('option', { attrs: { value: name } })),
  );

  const picker = byId('progressExercise');
  const previous = picker.value;
  picker.replaceChildren(
    ...names.map((name) => el('option', { text: name, attrs: { value: name } })),
  );
  if (names.includes(previous)) picker.value = previous;
}

/** Renders today's logged sets, newest first. */
export function renderTodayList() {
  const today = todayISO();
  const rows = getSets()
    .filter((set) => set.date === today)
    .sort((a, b) => b.ts - a.ts)
    .map(buildSetRow);

  renderList(byId('todayList'), rows, 'No sets logged yet today. Add one above.');
}

/** Renders every logged set, grouped by day, most recent day first. */
export function renderHistory() {
  const sorted = [...getSets()].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const byDate = groupBy(sorted, (set) => set.date);

  const groups = [...byDate.entries()].map(([date, sets]) =>
    el('section', { class: 'day-group' }, [
      el('h2', { class: 'day-header', text: formatDate(date) }),
      ...sets.map(buildSetRow),
    ]),
  );

  renderList(byId('historyList'), groups, 'Your logged sets will show up here, grouped by day.');
}

/**
 * Validates the entry form and records a set.
 *
 * @param {() => void} onChange Called after a successful save.
 */
export function submitSetForm(onChange) {
  const exercise = byId('exerciseInput').value.trim();
  const weight = toFiniteNumber(byId('weightInput').value);
  const reps = toFiniteNumber(byId('repsInput').value);
  const setCount = toFiniteNumber(byId('setsInput').value) ?? 1;

  if (!exercise) {
    showToast('Enter an exercise name.', 'error');
    byId('exerciseInput').focus();
    return;
  }
  if (weight === null || weight < 0) {
    showToast('Enter a valid weight.', 'error');
    byId('weightInput').focus();
    return;
  }
  if (reps === null || reps < 1) {
    showToast('Enter at least one rep.', 'error');
    byId('repsInput').focus();
    return;
  }

  addSet({
    exercise,
    weight,
    reps,
    setCount: Math.max(1, Math.round(setCount)),
  });

  byId('weightInput').value = '';
  byId('repsInput').value = '';
  byId('setsInput').value = '1';
  byId('exerciseInput').focus();

  showToast(`Logged ${exercise}.`);
  onChange();
}

/**
 * Handles clicks on any delete control within the workout lists.
 *
 * @param {Event} event
 * @param {() => void} onChange
 */
export function handleSetListClick(event, onChange) {
  const button = event.target.closest('[data-action="delete-set"]');
  if (!button) return;
  removeSet(button.dataset.id);
  onChange();
}
