/**
 * The nutrition dashboard: weigh-in card, weight trend, adaptive calorie and
 * macro targets, and the profile dialog that seeds them.
 */

import { renderSparkline } from './charts.js';
import { TARGET_REFRESH_DAYS, MS_PER_DAY } from './config.js';
import { byId } from './dom.js';
import {
  computeAdaptiveTDEE,
  computeInitialTDEE,
  computeTargets,
  computeTrendSeries,
  computeWeeklyRate,
  getDailyCalorieTotals,
  getMacroTotals,
} from './coaching.js';
import {
  findWeightEntry,
  getFoodEntries,
  getProfile,
  getTargetSnapshot,
  getWeightEntries,
  saveProfile,
  saveTargetSnapshot,
  upsertTodayWeight,
} from './state.js';
import { clamp, toFiniteNumber, todayISO } from './utils.js';
import { closeDialog, openDialogById, showToast } from './ui.js';

/**
 * Recomputes and stores the target snapshot when it is missing, stale, or can
 * finally be upgraded from a formula estimate to a data-driven one.
 *
 * @param {boolean} forced Recompute regardless of age.
 * @returns {object|null} The current snapshot, or null without a profile.
 */
export function refreshTargets(forced) {
  const profile = getProfile();
  if (!profile) return null;

  const series = computeTrendSeries(getWeightEntries());
  const currentWeight =
    series.length > 0 ? series[series.length - 1].trendWeight : profile.weightKg;
  const adaptive = computeAdaptiveTDEE(series, getDailyCalorieTotals(getFoodEntries()));

  let snapshot = getTargetSnapshot();
  const now = Date.now();
  const daysSinceUpdate = snapshot ? (now - snapshot.computedAt) / MS_PER_DAY : Infinity;
  const canUpgrade = snapshot?.source === 'estimate' && adaptive !== null;

  if (forced || !snapshot || daysSinceUpdate >= TARGET_REFRESH_DAYS || canUpgrade) {
    const tdee = adaptive ?? computeInitialTDEE(profile, currentWeight);
    snapshot = {
      tdee,
      source: adaptive !== null ? 'adaptive' : 'estimate',
      computedAt: now,
      ...computeTargets(tdee, profile, currentWeight),
    };
    saveTargetSnapshot(snapshot);
  }

  return snapshot;
}

/**
 * Renders the weigh-in field, trend readout and weight chart.
 *
 * @param {import('./coaching.js').TrendPoint[]} series
 */
function renderWeightCard(series) {
  const todayEntry = findWeightEntry(todayISO());
  byId('weightInputField').value = todayEntry ? String(todayEntry.weight) : '';

  const valueEl = byId('trendWeightValue');
  const subEl = byId('trendWeightSub');
  const latest = series[series.length - 1];

  if (!latest) {
    valueEl.textContent = '—';
    subEl.textContent = 'Log a weigh-in to start a trend';
  } else {
    valueEl.textContent = `${latest.trendWeight.toFixed(1)} kg`;
    const rate = computeWeeklyRate(series);
    subEl.textContent =
      rate === null
        ? 'Trend weight · log again to see a rate'
        : `Trend weight · ${rate > 0 ? '+' : ''}${rate.toFixed(1)} kg / wk`;
  }

  renderSparkline(byId('weightChart'), {
    line: series.map((point) => point.trendWeight),
    scatter: series.map((point) => point.weight),
    emptyMessage: 'Log a weigh-in to start a trend.',
    singlePointMessage: 'Log again tomorrow to start a trend line.',
    label: 'Body weight trend over time',
  });
}

/**
 * Renders the calorie and macro targets against today's intake.
 *
 * @param {object|null} snapshot
 */
function renderTargetsCard(snapshot) {
  if (!snapshot) return;

  const totals = getMacroTotals(getFoodEntries(), todayISO());

  byId('calorieProgressText').textContent =
    `${Math.round(totals.kcal)} / ${snapshot.targetCalories} kcal`;

  byId('tdeeLine').textContent =
    snapshot.source === 'adaptive'
      ? `Adaptive TDEE ≈ ${snapshot.tdee} kcal, from your own logs`
      : `Initial estimate ≈ ${snapshot.tdee} kcal — refines once you've logged ~10+ days`;

  const percent = clamp((totals.kcal / snapshot.targetCalories) * 100, 0, 100);
  const bar = byId('calorieBar');
  bar.style.setProperty('--bar-width', `${percent.toFixed(1)}%`);
  bar.setAttribute('aria-valuenow', String(Math.round(totals.kcal)));
  bar.setAttribute('aria-valuemax', String(snapshot.targetCalories));
  bar.setAttribute(
    'aria-valuetext',
    `${Math.round(totals.kcal)} of ${snapshot.targetCalories} kcal`,
  );

  byId('proteinTargetText').textContent = `${Math.round(totals.protein)} / ${snapshot.proteinG} g`;
  byId('carbsTargetText').textContent = `${Math.round(totals.carbs)} / ${snapshot.carbsG} g`;
  byId('fatTargetText').textContent = `${Math.round(totals.fat)} / ${snapshot.fatG} g`;
}

/** Renders the whole nutrition dashboard, or the setup prompt if no profile. */
export function renderDashboard() {
  const profile = getProfile();
  const banner = byId('profileSetupBanner');
  const dashboard = byId('nutritionDashboard');

  if (!profile) {
    banner.hidden = false;
    dashboard.hidden = true;
    return;
  }

  banner.hidden = true;
  dashboard.hidden = false;

  renderWeightCard(computeTrendSeries(getWeightEntries()));
  renderTargetsCard(refreshTargets(false));
}

/** Shows or hides the target-rate field, which is meaningless when maintaining. */
export function syncRateFieldVisibility() {
  byId('profileRateField').hidden = byId('profileGoal').value === 'maintain';
}

/** Opens the profile dialog, pre-filled from the stored profile. */
export function openProfileDialog() {
  const profile = getProfile();
  if (profile) {
    byId('profileSex').value = profile.sex;
    byId('profileAge').value = String(profile.age);
    byId('profileHeight').value = String(profile.heightCm);
    byId('profileWeight').value = String(profile.weightKg);
    byId('profileActivity').value = profile.activity;
    byId('profileGoal').value = profile.goal;
    byId('profileRate').value = String(profile.rateKgWk);
  }
  syncRateFieldVisibility();
  openDialogById('profileModal', { initialFocus: '#profileSex' });
}

/**
 * Validates and saves the profile form.
 *
 * @param {() => void} onChange
 */
export function submitProfileForm(onChange) {
  const age = toFiniteNumber(byId('profileAge').value);
  const heightCm = toFiniteNumber(byId('profileHeight').value);
  const weightKg = toFiniteNumber(byId('profileWeight').value);
  const rateKgWk = toFiniteNumber(byId('profileRate').value) ?? 0;

  if (age === null || age < 13 || age > 120) {
    showToast('Enter an age between 13 and 120.', 'error');
    byId('profileAge').focus();
    return;
  }
  if (heightCm === null || heightCm < 100 || heightCm > 250) {
    showToast('Enter a height in centimetres.', 'error');
    byId('profileHeight').focus();
    return;
  }
  if (weightKg === null || weightKg <= 0 || weightKg > 400) {
    showToast('Enter a weight in kilograms.', 'error');
    byId('profileWeight').focus();
    return;
  }

  saveProfile({
    sex: byId('profileSex').value,
    age,
    heightCm,
    weightKg,
    activity: byId('profileActivity').value,
    goal: byId('profileGoal').value,
    rateKgWk: Math.abs(rateKgWk),
  });

  // Seed today's weigh-in from the form so the trend has a starting point.
  if (!findWeightEntry(todayISO())) upsertTodayWeight(weightKg);

  refreshTargets(true);
  closeDialog();
  showToast('Targets updated.');
  onChange();
}

/**
 * Records the weight typed into the quick-log field.
 *
 * @param {() => void} onChange
 */
export function submitWeighIn(onChange) {
  const field = byId('weightInputField');
  const value = toFiniteNumber(field.value);

  if (value === null || value <= 0 || value > 400) {
    showToast('Enter a valid weight in kilograms.', 'error');
    field.focus();
    return;
  }

  upsertTodayWeight(value);
  showToast('Weigh-in saved.');
  onChange();
}
