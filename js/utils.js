/**
 * Small, dependency-free helpers. Everything here is a pure function so it can
 * be reasoned about (and later unit-tested) without a DOM.
 */

import { MS_PER_DAY } from './config.js';

/**
 * Today's date as an ISO `YYYY-MM-DD` string, in the user's local timezone.
 *
 * `toISOString()` is deliberately avoided: it converts to UTC first, so anyone
 * west of Greenwich would see the previous day's date after their local
 * midnight-adjacent hours.
 *
 * @returns {string}
 */
export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` string into a local-midnight Date.
 *
 * @param {string} iso
 * @returns {Date}
 */
export function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whole days from `fromISO` to `toISO`. Negative if `toISO` is earlier.
 *
 * @param {string} fromISO
 * @param {string} toISO
 * @returns {number}
 */
export function daysBetween(fromISO, toISO) {
  return Math.round((parseISODate(toISO) - parseISODate(fromISO)) / MS_PER_DAY);
}

/**
 * Shifts an ISO date by a number of days.
 *
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO date for display, e.g. "Mon, 7 Sep".
 *
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * A collision-resistant identifier for locally stored records.
 *
 * @returns {string}
 */
export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Epley one-rep-max estimate.
 *
 * @param {number} weight Load lifted, in kg.
 * @param {number} reps Repetitions completed.
 * @returns {number} Estimated 1RM in kg, rounded.
 */
export function estimateOneRepMax(weight, reps) {
  if (reps <= 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Reads a finite number from a form field value.
 *
 * @param {string} value
 * @returns {number|null} The number, or null if it is missing or not finite.
 */
export function toFiniteNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Constrains a number to an inclusive range.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Groups items into a Map keyed by the result of `keyFn`, preserving insertion
 * order of first appearance.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
export function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
