/**
 * Progress view: estimated one-rep-max trend for a chosen exercise.
 */

import { renderSparkline } from './charts.js';
import { byId } from './dom.js';
import { getSets } from './state.js';
import { estimateOneRepMax } from './utils.js';

/** Renders the stat cards and the 1RM sparkline for the selected exercise. */
export function renderProgress() {
  const exercise = byId('progressExercise').value;
  const bestEl = byId('bestOneRM');
  const lastEl = byId('lastLogged');
  const chart = byId('progressChart');

  if (!exercise) {
    bestEl.textContent = '—';
    lastEl.textContent = '—';
    renderSparkline(chart, {
      line: [],
      emptyMessage: 'Log a set to see progress here.',
      singlePointMessage: 'Log one more set to see a trend line.',
      label: 'Estimated one-rep-max over time',
    });
    return;
  }

  const rows = getSets()
    .filter((set) => set.exercise === exercise)
    .sort((a, b) => a.ts - b.ts);

  const oneRepMaxes = rows.map((row) => estimateOneRepMax(row.weight, row.reps));

  bestEl.textContent = oneRepMaxes.length > 0 ? `${Math.max(...oneRepMaxes)} kg` : '—';

  const latest = rows[rows.length - 1];
  lastEl.textContent = latest ? `${latest.weight}×${latest.reps}` : '—';

  renderSparkline(chart, {
    line: oneRepMaxes,
    emptyMessage: 'Log a set to see progress here.',
    singlePointMessage: 'Log one more set to see a trend line.',
    label: `Estimated one-rep-max for ${exercise} over time`,
  });
}
