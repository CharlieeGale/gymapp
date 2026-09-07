/**
 * Weight-trend smoothing and adaptive calorie coaching.
 *
 * Every function here is pure: it takes data and returns data, with no DOM and
 * no storage access. That keeps the nutrition maths independently checkable.
 *
 * The approach mirrors adaptive-TDEE trackers: smooth a noisy daily weight
 * series into a trend, then back-calculate real expenditure from logged intake
 * versus that trend, rather than trusting a static formula forever.
 */

import {
  ACTIVITY_MULTIPLIERS,
  ADAPTIVE_WINDOW_DAYS,
  CALORIE_FLOOR,
  DEFAULT_ACTIVITY_MULTIPLIER,
  FAT_CALORIE_SHARE,
  KCAL_PER_GRAM,
  KCAL_PER_KG,
  MIN_ADAPTIVE_DAYS,
  MIN_ADAPTIVE_SPAN_DAYS,
  PROTEIN_PER_KG,
  TREND_ALPHA_PER_DAY,
} from './config.js';
import { addDays, daysBetween } from './utils.js';

/**
 * @typedef {object} TrendPoint
 * @property {string} date
 * @property {number} weight Raw weigh-in.
 * @property {number} trendWeight Smoothed value.
 */

/**
 * Exponentially smooths weigh-ins to separate the real trend from day-to-day
 * noise (water, sodium, gut contents).
 *
 * The smoothing factor is compounded across the gap between consecutive
 * weigh-ins. A fixed per-entry factor — as used previously — makes the trend
 * depend on how often you happen to step on the scale rather than on elapsed
 * time, so someone weighing in weekly would see a trend line lagging reality by
 * several kilograms indefinitely.
 *
 * @param {ReadonlyArray<{date: string, weight: number}>} entries
 * @returns {TrendPoint[]} Chronologically sorted.
 */
export function computeTrendSeries(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let trend = null;
  let previousDate = null;

  return sorted.map((entry) => {
    if (trend === null) {
      trend = entry.weight;
    } else {
      const gapDays = Math.max(1, daysBetween(previousDate, entry.date));
      const alpha = 1 - (1 - TREND_ALPHA_PER_DAY) ** gapDays;
      trend = alpha * entry.weight + (1 - alpha) * trend;
    }
    previousDate = entry.date;
    return { date: entry.date, weight: entry.weight, trendWeight: trend };
  });
}

/**
 * Rate of trend-weight change, normalised to kg per week.
 *
 * The previous implementation subtracted the first point falling inside the
 * last seven days from the latest point. When weigh-ins were sparse that
 * "first point" was the latest point itself, so the app reported a flat
 * 0.0 kg/wk however much weight had actually been lost; and when the two points
 * spanned more than a week the raw difference was labelled per-week without
 * ever being divided by the elapsed time.
 *
 * @param {TrendPoint[]} series
 * @returns {number|null} kg per week, or null when there is not enough data.
 */
export function computeWeeklyRate(series) {
  if (series.length < 2) return null;

  const latest = series[series.length - 1];
  const cutoff = addDays(latest.date, -7);

  // Prefer the oldest point still inside the seven-day window; fall back to the
  // previous weigh-in so a sparse log still reports a real rate.
  const earlier = series.slice(0, -1);
  const reference = earlier.find((point) => point.date >= cutoff) ?? earlier[earlier.length - 1];

  const elapsedDays = daysBetween(reference.date, latest.date);
  if (elapsedDays <= 0) return null;

  return ((latest.trendWeight - reference.trendWeight) / elapsedDays) * 7;
}

/**
 * Totals logged calories per day.
 *
 * @param {ReadonlyArray<{date: string, kcal: number}>} foodEntries
 * @returns {Map<string, number>}
 */
export function getDailyCalorieTotals(foodEntries) {
  const totals = new Map();
  for (const entry of foodEntries) {
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + entry.kcal);
  }
  return totals;
}

/**
 * Sums today's macros.
 *
 * @param {ReadonlyArray<object>} foodEntries
 * @param {string} date
 * @returns {{kcal: number, protein: number, carbs: number, fat: number}}
 */
export function getMacroTotals(foodEntries, date) {
  return foodEntries
    .filter((entry) => entry.date === date)
    .reduce(
      (acc, entry) => ({
        kcal: acc.kcal + entry.kcal,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

/**
 * Mifflin-St Jeor resting expenditure, scaled by activity level. Used only
 * until there is enough real data to replace it.
 *
 * @param {object} profile
 * @param {number} weightKg
 * @returns {number} kcal per day.
 */
export function computeInitialTDEE(profile, weightKg) {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  const bmr = profile.sex === 'male' ? base + 5 : base - 161;
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activity] ?? DEFAULT_ACTIVITY_MULTIPLIER;
  return Math.round(bmr * multiplier);
}

/**
 * Back-calculates expenditure from logged intake versus trend-weight change
 * over the same window:
 *
 *   TDEE = average intake − daily energy balance implied by the weight change
 *
 * @param {TrendPoint[]} series
 * @param {Map<string, number>} dailyCalories
 * @returns {number|null} kcal per day, or null when there is not enough data.
 */
export function computeAdaptiveTDEE(series, dailyCalories) {
  const trendByDate = new Map(series.map((point) => [point.date, point.trendWeight]));
  const eligibleDates = [...trendByDate.keys()].filter((date) => dailyCalories.has(date)).sort();

  if (eligibleDates.length < MIN_ADAPTIVE_DAYS) return null;

  const window = eligibleDates.slice(-ADAPTIVE_WINDOW_DAYS);
  const first = window[0];
  const last = window[window.length - 1];
  const spanDays = daysBetween(first, last);

  if (spanDays < MIN_ADAPTIVE_SPAN_DAYS) return null;

  const weightChangeKg = trendByDate.get(last) - trendByDate.get(first);
  const averageIntake =
    window.reduce((sum, date) => sum + dailyCalories.get(date), 0) / window.length;
  const dailyEnergyBalance = (weightChangeKg * KCAL_PER_KG) / spanDays;

  return Math.round(averageIntake - dailyEnergyBalance);
}

/**
 * Turns an expenditure figure and a goal into daily calorie and macro targets.
 *
 * @param {number} tdee
 * @param {object} profile
 * @param {number} currentWeightKg
 * @returns {{targetCalories: number, proteinG: number, carbsG: number, fatG: number}}
 */
export function computeTargets(tdee, profile, currentWeightKg) {
  const dailyAdjustment = (profile.rateKgWk * KCAL_PER_KG) / 7;

  let targetCalories = tdee;
  if (profile.goal === 'lose') targetCalories = tdee - dailyAdjustment;
  else if (profile.goal === 'gain') targetCalories = tdee + dailyAdjustment;
  targetCalories = Math.max(Math.round(targetCalories), CALORIE_FLOOR);

  const proteinPerKg = profile.goal === 'gain' ? PROTEIN_PER_KG.gain : PROTEIN_PER_KG.default;
  const proteinG = Math.round((currentWeightKg || profile.weightKg) * proteinPerKg);
  const fatG = Math.round((targetCalories * FAT_CALORIE_SHARE) / KCAL_PER_GRAM.fat);
  const carbsG = Math.max(
    Math.round(
      (targetCalories - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat) /
        KCAL_PER_GRAM.carbs,
    ),
    0,
  );

  return { targetCalories, proteinG, fatG, carbsG };
}
