/**
 * The single source of truth for application data.
 *
 * Views never touch localStorage directly. They read through the getters here
 * and mutate through the exported actions, each of which persists immediately.
 * That keeps persistence in one place and makes the data flow easy to follow.
 */

import { STORAGE_KEYS } from './config.js';
import { readArray, readObject, write } from './storage.js';
import { todayISO, uid } from './utils.js';

/**
 * @typedef {object} WorkoutSet
 * @property {string} id
 * @property {string} exercise
 * @property {number} weight Kilograms.
 * @property {number} reps
 * @property {number} setCount
 * @property {string} date ISO `YYYY-MM-DD`.
 * @property {number} ts Epoch milliseconds, used for ordering within a day.
 */

/**
 * @typedef {object} FoodEntry
 * @property {string} id
 * @property {string} name
 * @property {number} grams
 * @property {number} kcal
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 * @property {string} date
 * @property {number} ts
 */

/**
 * @typedef {object} WeightEntry
 * @property {string} id
 * @property {number} weight Kilograms.
 * @property {string} date
 * @property {number} ts
 */

const state = {
  sets: /** @type {WorkoutSet[]} */ (readArray(STORAGE_KEYS.sets)),
  food: /** @type {FoodEntry[]} */ (readArray(STORAGE_KEYS.food)),
  weight: /** @type {WeightEntry[]} */ (readArray(STORAGE_KEYS.weight)),
};

/* -------------------------------------------------------------------------- */
/* Workout sets                                                               */
/* -------------------------------------------------------------------------- */

/** @returns {readonly WorkoutSet[]} */
export function getSets() {
  return state.sets;
}

/**
 * @param {{exercise: string, weight: number, reps: number, setCount: number}} input
 * @returns {WorkoutSet}
 */
export function addSet({ exercise, weight, reps, setCount }) {
  const record = {
    id: uid(),
    exercise,
    weight,
    reps,
    setCount,
    date: todayISO(),
    ts: Date.now(),
  };
  state.sets.push(record);
  write(STORAGE_KEYS.sets, state.sets);
  return record;
}

/** @param {string} id */
export function removeSet(id) {
  state.sets = state.sets.filter((set) => set.id !== id);
  write(STORAGE_KEYS.sets, state.sets);
}

/**
 * Distinct exercise names, alphabetically sorted.
 *
 * @returns {string[]}
 */
export function getExerciseNames() {
  return [...new Set(state.sets.map((set) => set.exercise))].sort((a, b) => a.localeCompare(b));
}

/* -------------------------------------------------------------------------- */
/* Food entries                                                               */
/* -------------------------------------------------------------------------- */

/** @returns {readonly FoodEntry[]} */
export function getFoodEntries() {
  return state.food;
}

/**
 * @param {Omit<FoodEntry, 'id' | 'date' | 'ts'>} entry
 * @returns {FoodEntry}
 */
export function addFoodEntry(entry) {
  const record = { ...entry, id: uid(), date: todayISO(), ts: Date.now() };
  state.food.push(record);
  write(STORAGE_KEYS.food, state.food);
  return record;
}

/** @param {string} id */
export function removeFoodEntry(id) {
  state.food = state.food.filter((entry) => entry.id !== id);
  write(STORAGE_KEYS.food, state.food);
}

/* -------------------------------------------------------------------------- */
/* Weigh-ins                                                                  */
/* -------------------------------------------------------------------------- */

/** @returns {readonly WeightEntry[]} */
export function getWeightEntries() {
  return state.weight;
}

/**
 * Records today's weigh-in, replacing any earlier value for the same day.
 *
 * @param {number} weightKg
 */
export function upsertTodayWeight(weightKg) {
  const date = todayISO();
  const existing = state.weight.find((entry) => entry.date === date);
  if (existing) {
    existing.weight = weightKg;
    existing.ts = Date.now();
  } else {
    state.weight.push({ id: uid(), weight: weightKg, date, ts: Date.now() });
  }
  write(STORAGE_KEYS.weight, state.weight);
}

/**
 * @param {string} date ISO `YYYY-MM-DD`.
 * @returns {WeightEntry|undefined}
 */
export function findWeightEntry(date) {
  return state.weight.find((entry) => entry.date === date);
}

/* -------------------------------------------------------------------------- */
/* Profile and target snapshot                                                */
/* -------------------------------------------------------------------------- */

/** @returns {object|null} */
export function getProfile() {
  return readObject(STORAGE_KEYS.profile);
}

/** @param {object} profile */
export function saveProfile(profile) {
  write(STORAGE_KEYS.profile, profile);
}

/** @returns {object|null} */
export function getTargetSnapshot() {
  return readObject(STORAGE_KEYS.tdee);
}

/** @param {object} snapshot */
export function saveTargetSnapshot(snapshot) {
  write(STORAGE_KEYS.tdee, snapshot);
}
