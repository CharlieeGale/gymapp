/**
 * Application-wide constants.
 *
 * Everything that is a tunable number, a storage key or an external URL lives
 * here so it can be changed in one place rather than hunted through the code.
 */

/** localStorage keys. The `.vN` suffix lets us migrate shapes later. */
export const STORAGE_KEYS = Object.freeze({
  sets: 'ironlog.sets.v1',
  food: 'ironlog.food.v1',
  weight: 'ironlog.weight.v1',
  profile: 'ironlog.profile.v1',
  tdee: 'ironlog.tdee.v1',
});

/** Approximate energy density of 1 kg of stored body mass, in kcal. */
export const KCAL_PER_KG = 7700;

/**
 * Per-day smoothing factor for the weight trend line.
 * Lower is smoother and slower to react. This is expressed *per day* and is
 * compounded across gaps, so a fortnightly weigh-in moves the trend more than
 * a daily one does.
 */
export const TREND_ALPHA_PER_DAY = 0.1;

/** Minimum overlapping weight + food days before the adaptive TDEE is trusted. */
export const MIN_ADAPTIVE_DAYS = 10;

/** Rolling window, in days, used for the adaptive TDEE calculation. */
export const ADAPTIVE_WINDOW_DAYS = 28;

/** Minimum span, in days, the adaptive window must cover to be usable. */
export const MIN_ADAPTIVE_SPAN_DAYS = 6;

/** Recompute stored targets after this many days (weekly check-in). */
export const TARGET_REFRESH_DAYS = 7;

/** Never prescribe fewer calories than this, whatever the goal. */
export const CALORIE_FLOOR = 1200;

/** Grams of protein per kg of bodyweight, by goal. */
export const PROTEIN_PER_KG = Object.freeze({ gain: 1.8, default: 2.2 });

/** Share of total calories allocated to fat. */
export const FAT_CALORIE_SHARE = 0.25;

/** Activity multipliers applied to BMR (Mifflin-St Jeor). */
export const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
});

export const DEFAULT_ACTIVITY_MULTIPLIER = ACTIVITY_MULTIPLIERS.light;

/** Calories per gram, by macronutrient. */
export const KCAL_PER_GRAM = Object.freeze({ protein: 4, carbs: 4, fat: 9 });

/** Milliseconds in a day. */
export const MS_PER_DAY = 86_400_000;

/** Open Food Facts endpoints. */
export const OFF_BASE = 'https://world.openfoodfacts.org';
export const FOOD_SEARCH_PAGE_SIZE = 8;
export const FOOD_SEARCH_MIN_CHARS = 3;
export const FOOD_SEARCH_DEBOUNCE_MS = 400;
export const FOOD_REQUEST_TIMEOUT_MS = 10_000;

/** Pinned barcode-reader module. Loaded on demand, only when scanning. */
export const ZXING_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm';

/** Sparkline viewBox geometry, shared by every chart in the app. */
export const CHART = Object.freeze({
  width: 100,
  height: 40,
  paddingTop: 4,
  paddingBottom: 2,
});

/** How long a toast stays on screen, in milliseconds. */
export const TOAST_DURATION_MS = 4000;
