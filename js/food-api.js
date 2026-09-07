/**
 * Open Food Facts client.
 *
 * Network access is isolated here so the views deal only with the normalised
 * shape below, and so every request gets the same timeout and error handling.
 */

import { FOOD_REQUEST_TIMEOUT_MS, FOOD_SEARCH_PAGE_SIZE, OFF_BASE } from './config.js';

/**
 * @typedef {object} FoodItem
 * @property {string} name
 * @property {string} brand
 * @property {number} kcal100 Calories per 100 g.
 * @property {number} protein100
 * @property {number} carbs100
 * @property {number} fat100
 */

/** Raised when a lookup fails for a reason worth showing the user. */
export class FoodApiError extends Error {}

/**
 * Fetches JSON with a timeout, so a hanging request cannot leave the UI stuck.
 *
 * @param {string} url
 * @returns {Promise<object>}
 */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FOOD_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new FoodApiError(`Food database returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof FoodApiError) throw error;
    throw new FoodApiError('Could not reach the food database.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads a nutriment value, tolerating the several key spellings the API uses.
 *
 * @param {object} nutriments
 * @param {string[]} keys
 * @returns {number}
 */
function readNutriment(nutriments, keys) {
  for (const key of keys) {
    const value = Number(nutriments[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

/**
 * Normalises an Open Food Facts product into the app's own shape.
 *
 * @param {object} product
 * @returns {FoodItem}
 */
export function normaliseProduct(product) {
  const nutriments = product.nutriments ?? {};
  return {
    name: product.product_name || product.generic_name || 'Unknown item',
    brand: product.brands || '',
    kcal100: readNutriment(nutriments, ['energy-kcal_100g', 'energy-kcal']),
    protein100: readNutriment(nutriments, ['proteins_100g']),
    carbs100: readNutriment(nutriments, ['carbohydrates_100g']),
    fat100: readNutriment(nutriments, ['fat_100g']),
  };
}

/**
 * Looks a product up by barcode.
 *
 * @param {string} barcode
 * @returns {Promise<FoodItem>}
 * @throws {FoodApiError} When the product is unknown or the request fails.
 */
export async function lookupBarcode(barcode) {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const data = await fetchJson(url);
  if (data.status !== 1 || !data.product) {
    throw new FoodApiError('No product found for that barcode.');
  }
  return normaliseProduct(data.product);
}

/**
 * Searches products by name.
 *
 * @param {string} query
 * @returns {Promise<FoodItem[]>}
 * @throws {FoodApiError} When the request fails.
 */
export async function searchFoods(query) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(FOOD_SEARCH_PAGE_SIZE),
  });
  const data = await fetchJson(`${OFF_BASE}/cgi/search.pl?${params}`);
  return (data.products ?? [])
    .filter((product) => product.product_name)
    .slice(0, FOOD_SEARCH_PAGE_SIZE)
    .map(normaliseProduct);
}
