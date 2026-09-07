/**
 * Thin, defensive wrapper around localStorage.
 *
 * Every read validates the shape it gets back: a corrupt or hand-edited entry
 * should degrade to an empty value rather than throw during start-up and leave
 * the user with a blank screen.
 */

/**
 * True when localStorage is usable. It throws outright in Safari private mode
 * and when a browser is configured to block site data.
 *
 * @returns {boolean}
 */
function isAvailable() {
  try {
    const probe = '__ironlog_probe__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = isAvailable();

/**
 * Reads and parses a JSON array.
 *
 * @param {string} key
 * @returns {unknown[]} The stored array, or an empty array.
 */
export function readArray(key) {
  if (!available) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reads and parses a JSON object.
 *
 * @param {string} key
 * @returns {object|null} The stored object, or null.
 */
export function readObject(key) {
  if (!available) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Serialises and stores a value.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} False if the write failed (quota exceeded, storage blocked).
 */
export function write(key, value) {
  if (!available) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** True when persistence is working; the UI warns the user when it is not. */
export const storageAvailable = available;
